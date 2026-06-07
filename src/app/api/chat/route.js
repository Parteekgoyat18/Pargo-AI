import Anthropic from '@anthropic-ai/sdk';
import { searchHotels, getHotelDetails, searchDestinations, checkRate, createBooking } from '../../lib/hotelbeds';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are HotelGPT, an AI hotel booking assistant.
You help users find and book hotels worldwide. Only answer questions related to hotels, accommodations, travel destinations, and bookings.

When a user asks about hotels, use the available tools to:
1. Search for destinations to get destination codes
2. Search for available hotels with dates and occupancy
3. Fetch hotel details when users want more info
4. Check rates before confirming prices
5. Call book_hotel to complete the booking once the user says they want to book and provides their name, email, and phone — do not tell the user to book elsewhere, call the tool directly

Keep responses warm but concise and professional.
When declining an off-topic question, say in one sentence that you are focused on hotel searches and cannot answer general questions, then in a second sentence tell the user to provide their destination and travel dates if they need help finding a hotel. Do not ask "where would you like to stay?" as a standalone question.
When the user provides partial details, acknowledge what they gave, ask for the one missing required detail, then offer to accept optional preferences (number of guests, budget, star rating, location) in a single follow-up sentence.
Never use bullet points to collect information — ask in plain prose instead.
Format hotel results clearly with name, price, and key features.
If no hotels are found, suggest alternative dates or nearby destinations.
Never use emojis in any response.`;

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
            system: SYSTEM_PROMPT,
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
