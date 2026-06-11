import Anthropic from '@anthropic-ai/sdk';
import { searchHotels, getHotelDetails, searchDestinations, checkRate } from '../../lib/hotelbeds';

const client = new Anthropic();

function getSystemPrompt() {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
  const readable = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return `You are Pargo AI, an AI hotel booking assistant.
Today's date is ${readable} (${dateStr}). Always use this as your reference for interpreting dates.
When a user mentions dates (e.g. "20 June", "next Friday", "20th to 28th"), always resolve them to future dates relative to today (${dateStr}). If the date has already passed this year, use next year. Never search or book dates in the past.

LANGUAGE RULE: Detect the language of the user's message and always reply in that same language. If the user writes in Hindi (or Hinglish), reply in Hindi. If the user writes in English, reply in English. Never switch languages unless the user does first.

You help users find and book hotels worldwide. Only answer questions related to hotels, accommodations, travel destinations, and bookings.

---

GREETINGS EXCEPTION — check this BEFORE the steps below:
If the user's message is purely a greeting or small talk (e.g. "hi", "hello", "good morning", "hey", "how are you"), reply warmly and briefly, then add ONE casual travel-related follow-up — do NOT ask for destination or dates specifically. Examples: "Good morning! Any travel plans coming up?" / "Hey! Somewhere exciting on your mind?" / "Hello! Planning a trip soon?". Vary the phrasing every time. Do NOT trigger STEP 1 for greetings.

---

STRICT RULES — follow these in order, never skip a step:

STEP 1 — COLLECT SEARCH DETAILS VIA FORM
Rules (in order):

a) If the user mentions a destination (city, country, area, or landmark) — with or without dates — immediately output ONLY the form token with that destination pre-filled. Do NOT add any text before or after it.

b) If the user expresses hotel/travel intent but gives NO destination — ask ONE question only: "Where would you like to go?" (in the user's language). Nothing else. When they reply with a destination, immediately output ONLY the form token.

c) If dates or a date range are mentioned, resolve them to YYYY-MM-DD and pre-fill checkin/checkout. Otherwise leave them empty.

OUTPUT RULE — CRITICAL: When outputting the form token, your entire response must be ONLY the token below. No greeting. No confirmation text. No explanation. Not even one word before or after it — in any language including Hindi.
[SEARCH_FORM:{"destination":"<city if known, else empty>","checkin":"<YYYY-MM-DD or empty>","checkout":"<YYYY-MM-DD or empty>","adults":2}]

NEVER ask for dates in conversation — dates are handled entirely by the form.
The system renders an interactive form. After submission the message looks like:
"Destination: Goa
Check-in: 2026-06-11
Check-out: 2026-06-22
Adults: 2"
Once you receive that, proceed to STEP 2.

STEP 2 — SEARCH
Once you have destination + check-in + check-out, call search_destinations to get the destination code, then immediately call search_hotels with that code and the dates.

STEP 3 — SHOW RESULTS AS CARDS
After receiving the search_hotels tool result, output EXACTLY this token and nothing else — no text before or after it in any language:
[HOTEL_LIST:{"hotels":[{"code":"...","name":"...","categoryName":"...","minRate":...,"currency":"...","rateKey":"...","facilities":["..."]},...]}]

Copy the values directly from the tool result. Do NOT describe hotels in prose. Do NOT output any other text.
The system will render clickable hotel cards. After the user selects one, their message will look like:
"I'd like to book [Hotel Name] (rateKey: <rateKey>)"
Then proceed to STEP 4.

STEP 4 — COLLECT GUEST DETAILS
When you receive a hotel selection message (e.g. "I'd like to book ..."), output ONLY this token — no text before or after it in any language:
[GUEST_DETAILS_FORM]
The system will show the user a form to fill in their name, email, and phone number. Wait for the user to submit the form. Do NOT ask for these details in prose. Do NOT output anything other than [GUEST_DETAILS_FORM] in this step.

STEP 5 — INITIATE PAYMENT
After receiving the guest details message (formatted as "First Name: ...\nLast Name: ...\nEmail: ...\nPhone: ..."), call check_rate with the rateKey (from the hotel selection message), then output ONLY this token — no text before or after it in any language:
[PAYMENT_GATE:{"rateKey":"<rateKey>","amount":<net from check_rate>,"currency":"<currency from check_rate>","hotelName":"<hotelName from check_rate>"}]

Do NOT call book_hotel. Do NOT output any other text. The payment system verifies the transaction and creates the booking automatically.

---

Style rules:
Never use bullet points to collect information from the user — ask in plain prose.
Keep responses warm but concise and professional.
If no hotels are found, suggest alternative dates or nearby destinations.
When a user asks what you can do, briefly explain you help search and book hotels worldwide — keep it to 2-3 sentences, no follow-up question.
When declining an off-topic question, say in one sentence that you are focused on hotel searches.
Never use emojis in any response.`;
}

const TOOLS = [
  {
    name: 'search_destinations',
    description: 'Search for a destination (city/area) and get its destination code for hotel searches.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'City or destination name, e.g. "Paris" or "Bali"' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_hotels',
    description: 'Search for available hotels in a destination for specific dates.',
    input_schema: {
      type: 'object',
      properties: {
        destinationCode: { type: 'string', description: 'Destination code from search_destinations' },
        checkIn: { type: 'string', description: 'Check-in date in YYYY-MM-DD format' },
        checkOut: { type: 'string', description: 'Check-out date in YYYY-MM-DD format' },
        adults: { type: 'number', description: 'Number of adults (default 2)' },
        currency: { type: 'string', description: 'Currency code for prices, e.g. INR, USD, EUR (default INR)' },
      },
      required: ['destinationCode', 'checkIn', 'checkOut'],
    },
  },
  {
    name: 'get_hotel_details',
    description: 'Get detailed information about a specific hotel including amenities, photos and address.',
    input_schema: {
      type: 'object',
      properties: {
        hotelCode: { type: 'string', description: 'Hotel code from search_hotels results' },
      },
      required: ['hotelCode'],
    },
  },
  {
    name: 'check_rate',
    description: 'Confirm the final price and cancellation policy for a specific hotel rate.',
    input_schema: {
      type: 'object',
      properties: {
        rateKey: { type: 'string', description: 'Rate key from search_hotels results' },
      },
      required: ['rateKey'],
    },
  },
];

async function executeTool(name, input) {
  try {
    let result;
    switch (name) {
      case 'search_destinations': result = await searchDestinations(input.query); break;
      case 'search_hotels':       result = await searchHotels(input.destinationCode, input.checkIn, input.checkOut, input.adults || 2, input.currency || 'INR'); break;
      case 'get_hotel_details':   result = await getHotelDetails(input.hotelCode); break;
      case 'check_rate':          result = await checkRate(input.rateKey); break;
      default: result = { error: `Unknown tool: ${name}` };
    }
    console.log(`[tool:${name}] input:`, JSON.stringify(input), '| result:', JSON.stringify(result));
    return result;
  } catch (err) {
    console.error(`[tool:${name}] EXCEPTION:`, err.message, JSON.stringify(input));
    return { error: err.message };
  }
}

export async function POST(request) {
  const { messages } = await request.json();

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const apiMessages = messages.map(m => ({ role: m.role, content: m.content }));

        let continueLoop = true;
        while (continueLoop) {
          const response = await client.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 4096,
            system: getSystemPrompt(),
            tools: TOOLS,
            messages: apiMessages,
          });

          if (response.stop_reason === 'tool_use') {
            // Don't stream text that appears mid-loop alongside tool calls —
            // it's Claude "thinking aloud" and would confuse the user.
            // Execute all tool calls in parallel
            const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
            const toolResults = await Promise.all(
              toolUseBlocks.map(async block => ({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify(await executeTool(block.name, block.input)),
              }))
            );

            apiMessages.push({ role: 'assistant', content: response.content });
            apiMessages.push({ role: 'user', content: toolResults });
          } else {
            // Final response — only now stream text to the user
            for (const block of response.content) {
              if (block.type === 'text') {
                controller.enqueue(encoder.encode(block.text));
              }
            }
            continueLoop = false;
          }
        }

        controller.close();
      } catch (err) {
        controller.enqueue(encoder.encode('Sorry, I encountered an error. Please try again.'));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
