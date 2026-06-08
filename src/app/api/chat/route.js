import Anthropic from '@anthropic-ai/sdk';
import { searchHotels, getHotelDetails, searchDestinations, checkRate, createBooking } from '../../lib/hotelbeds';

const client = new Anthropic();

function getSystemPrompt() {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
  const readable = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return `You are Pargo AI, an AI hotel booking assistant.
Today's date is ${readable} (${dateStr}). Always use this as your reference for interpreting dates.
When a user mentions dates (e.g. "20 June", "next Friday", "20th to 28th"), always resolve them to future dates relative to today (${dateStr}). If the date has already passed this year, use next year. Never search or book dates in the past.

You help users find and book hotels worldwide. Only answer questions related to hotels, accommodations, travel destinations, and bookings.

---

STRICT RULES — follow these in order, never skip a step:

STEP 1 — COLLECT INFO BEFORE ANY API CALL
Before calling any tool, you must have ALL three of these from the user:
  - Destination (city or area)
  - Check-in date
  - Check-out date
If any of these are missing, ask for all missing ones together in a single conversational sentence. Do NOT call any tool until all three are confirmed.
Number of adults is optional — default to 2 if not given, do not ask for it unless the user brings it up.

STEP 2 — SEARCH
Once you have destination + check-in + check-out, call search_destinations to get the destination code, then immediately call search_hotels with that code and the dates.

STEP 3 — SHOW RESULTS
Format results clearly with hotel name, price per night, and 1-2 key features. Ask if the user wants details on any hotel or is ready to book.

STEP 4 — BOOKING
Once the user picks a hotel and confirms they want to book, collect their full name, email, and phone number if not already provided. Then call check_rate followed by book_hotel. Do not ask the user to go elsewhere — call the tools directly.

---

Style rules:
Never use bullet points to collect information from the user — ask in plain prose.
Keep responses warm but concise and professional.
If no hotels are found, suggest alternative dates or nearby destinations.
When declining an off-topic question, say in one sentence that you are focused on hotel searches, then ask for their destination and travel dates.
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
  {
    name: 'book_hotel',
    description: 'Complete a hotel booking after the user has confirmed they want to proceed and provided their name, email, and phone number.',
    input_schema: {
      type: 'object',
      properties: {
        rateKey:        { type: 'string', description: 'Rate key from search_hotels results' },
        holderName:     { type: 'string', description: 'First name of the lead guest' },
        holderSurname:  { type: 'string', description: 'Surname/last name of the lead guest' },
        email:          { type: 'string', description: 'Email address of the guest' },
        phone:          { type: 'string', description: 'Phone number of the guest' },
      },
      required: ['rateKey', 'holderName', 'holderSurname', 'email', 'phone'],
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
      case 'book_hotel':          result = await createBooking(input); break;
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
            max_tokens: 1024,
            system: getSystemPrompt(),
            tools: TOOLS,
            messages: apiMessages,
          });

          // Stream any text blocks
          for (const block of response.content) {
            if (block.type === 'text') {
              controller.enqueue(encoder.encode(block.text));
            }
          }

          if (response.stop_reason === 'tool_use') {
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
