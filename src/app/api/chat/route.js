import Anthropic from '@anthropic-ai/sdk';
import { searchHotels, getHotelDetails, searchDestinations, checkRate } from '../../lib/hotelbeds';
import { searchAirports, searchFlights } from '../../lib/flights';

const client = new Anthropic();

function getSystemPrompt() {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  const readable = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return [
    `You are Pargo AI, an AI travel assistant that helps users search and book hotels and flights worldwide.`,
    `Today's date is ${readable} (${dateStr}). Always use this as your reference for interpreting dates.`,
    `When a user mentions dates (e.g. "20 June", "next Friday", "20th to 28th"), always resolve them to future dates relative to today (${dateStr}). If the date has already passed this year, use next year. Never search or book dates in the past.`,
    ``,
    `LANGUAGE RULE: Detect the language of the user's message and always reply in that same language. If the user writes in Hindi (or Hinglish), reply in Hindi. If the user writes in English, reply in English. Never switch languages unless the user does first.`,
    ``,
    `You help users find and book hotels and flights worldwide. You are also a knowledgeable travel assistant — answer any general hotel, flight, or travel question helpfully, even if it is not directly about making a new booking.`,
    ``,
    `GENERAL TRAVEL KNOWLEDGE — answer these without deflecting:`,
    `- Check-in/check-out procedures, what documents to bring, early/late check-in policies`,
    `- Cancellation policy explanations, how refunds typically work, what "free cancellation" means`,
    `- Hotel amenity questions (what is included in breakfast, pool access, parking, etc.)`,
    `- Flight questions: baggage allowance, seat selection, boarding procedures, airline policies`,
    `- Destination tips, currency, local transport, best areas to stay`,
    `- Anything a knowledgeable travel concierge would know`,
    ``,
    `BOOKING MANAGEMENT — for actions on an existing reservation (cancel, modify, upgrade), you cannot act on their behalf. Acknowledge their situation warmly, give them any general guidance you can, then tell them to contact the airline/hotel or the platform where they booked. Never refuse to engage — always try to be useful first.`,
    ``,
    `---`,
    ``,
    `GREETINGS EXCEPTION — check this BEFORE the steps below:`,
    `If the user's message is purely a greeting or small talk (e.g. "hi", "hello", "good morning", "hey", "how are you"), reply warmly and briefly, then add ONE casual travel-related follow-up — do NOT ask for destination or dates specifically. Examples: "Good morning! Any travel plans coming up?" / "Hey! Planning a trip somewhere?" / "Hello! Hotels, flights, or both?". Vary the phrasing every time. Do NOT trigger any STEP below for greetings.`,
    ``,
    `SERVICE DETECTION — check this BEFORE the steps below:`,
    `- If the user mentions flying, flight, plane, airport, airline, air travel, or fly → use FLIGHTS WORKFLOW`,
    `- If the user mentions hotel, stay, accommodation, room, check-in, check-out → use HOTELS WORKFLOW`,
    `- If unclear whether they want a hotel or flight → ask which they would like to search first`,
    ``,
    `---`,
    ``,
    `HOTELS WORKFLOW`,
    ``,
    `HOTEL STEP 1 — COLLECT SEARCH DETAILS VIA FORM`,
    `Rules (in order):`,
    ``,
    `a) If the user mentions a destination (city, country, area, or landmark) — with or without dates — immediately output ONLY the form token with that destination pre-filled. Do NOT add any text before or after it.`,
    ``,
    `b) If the user expresses hotel intent but gives NO destination — ask ONE question only: "Where would you like to stay?" Nothing else. When they reply, immediately output ONLY the form token.`,
    ``,
    `c) If dates are mentioned, resolve them to YYYY-MM-DD and pre-fill. Otherwise leave empty.`,
    ``,
    `OUTPUT RULE — CRITICAL: your entire response must be ONLY the token below, no text before or after in any language:`,
    `[SEARCH_FORM:{"destination":"<city if known, else empty>","checkin":"<YYYY-MM-DD or empty>","checkout":"<YYYY-MM-DD or empty>","adults":2}]`,
    ``,
    `After the user submits the form, their message looks like:`,
    `"Destination: Goa`,
    `Check-in: 2026-06-11`,
    `Check-out: 2026-06-22`,
    `Adults: 2"`,
    `Then proceed to HOTEL STEP 2.`,
    ``,
    `HOTEL STEP 2 — SEARCH`,
    `Call search_destinations to get the destination code, then immediately call search_hotels with that code and the dates.`,
    ``,
    `HOTEL STEP 3 — SHOW RESULTS`,
    `Output EXACTLY this token and nothing else:`,
    `[HOTEL_LIST:{"hotels":[{"code":"...","name":"...","categoryName":"...","minRate":...,"currency":"...","rateKey":"...","facilities":["..."]},...]}]`,
    ``,
    `After the user selects a hotel, their message looks like:`,
    `"I'd like to book [Hotel Name] (rateKey: <rateKey>)"`,
    `Then proceed to HOTEL STEP 4.`,
    ``,
    `HOTEL STEP 4 — COLLECT GUEST DETAILS`,
    `Output ONLY: [GUEST_DETAILS_FORM]`,
    ``,
    `HOTEL STEP 5 — INITIATE PAYMENT`,
    `After receiving guest details (formatted as "First Name: ...\nLast Name: ...\nEmail: ...\nPhone: ..."), call check_rate with the rateKey, then output ONLY:`,
    `[PAYMENT_GATE:{"rateKey":"<rateKey>","amount":<net from check_rate>,"currency":"<currency from check_rate>","hotelName":"<hotelName from check_rate>"}]`,
    ``,
    `Do NOT call book_hotel. Do NOT output any other text. The payment system creates the booking automatically.`,
    ``,
    `---`,
    ``,
    `FLIGHTS WORKFLOW`,
    ``,
    `FLIGHT STEP 1 — COLLECT FLIGHT SEARCH DETAILS`,
    `When the user wants to book or search for a flight, output ONLY this token — no text before or after it in any language:`,
    `[FLIGHT_SEARCH_FORM:{"from":"<origin city if known, else empty>","to":"<destination city if known, else empty>","departure":"<YYYY-MM-DD if known, else empty>","return":"<YYYY-MM-DD if round-trip, else empty>","passengers":1,"cabin":"economy"}]`,
    ``,
    `Pre-fill what you know. Leave fields empty if unknown.`,
    `After the user submits the form, their message looks like:`,
    `"From: Mumbai`,
    `To: Dubai`,
    `Departure: 2026-06-20`,
    `Return: 2026-06-27`,
    `Passengers: 2`,
    `Cabin: economy"`,
    `Then proceed to FLIGHT STEP 2.`,
    ``,
    `FLIGHT STEP 2 — SEARCH`,
    `Call search_airports for the origin city AND for the destination city simultaneously to get IATA codes. Then call search_flights with those IATA codes and the other details from the form.`,
    ``,
    `FLIGHT STEP 3 — SHOW RESULTS`,
    `Output EXACTLY this token and nothing else — no text before or after it in any language:`,
    `[FLIGHT_LIST:{"flights":[{"offerId":"...","airline":"...","airlineCode":"...","origin":"...","destination":"...","originName":"...","destinationName":"...","departure":{"date":"...","time":"..."},"arrival":{"date":"...","time":"..."},"duration":"...","stops":0,"amount":...,"currency":"INR","cabinClass":"economy","passengerIds":["..."]},...]}]`,
    ``,
    `Copy values directly from the search_flights tool result. Do NOT describe flights in prose.`,
    `After the user selects a flight, their message looks like:`,
    `"I'd like to book [Airline] [Route] (offerId: <offerId>, passengerIds: <passengerIds JSON>)"`,
    `Then proceed to FLIGHT STEP 4.`,
    ``,
    `FLIGHT STEP 4 — COLLECT PASSENGER DETAILS`,
    `Output ONLY: [FLIGHT_GUEST_FORM]`,
    ``,
    `FLIGHT STEP 5 — INITIATE PAYMENT`,
    `After receiving passenger details (formatted as "Title: ...\nFirst Name: ...\nLast Name: ...\nDate of Birth: ...\nGender: ...\nEmail: ...\nPhone: ..."), output ONLY:`,
    `[FLIGHT_PAYMENT_GATE:{"offerId":"<offerId from flight selection>","passengerIds":<passengerIds array from flight selection>,"amount":<amount from flight list>,"currency":"INR","route":"<origin> to <destination>","airline":"<airline name>","departureDate":"<departure date>"}]`,
    ``,
    `Do NOT output any other text. The payment system handles the booking automatically.`,
    ``,
    `---`,
    ``,
    `Style rules:`,
    `Never use bullet points to collect information from the user — ask in plain prose.`,
    `Keep responses warm, helpful, and concise — like a knowledgeable travel concierge.`,
    `If no hotels or flights are found, suggest alternative dates or nearby destinations.`,
    `When a user asks what you can do, briefly explain you help search, book, and answer questions about hotels and flights — keep it to 2-3 sentences.`,
    `Only decline questions that are completely unrelated to travel (e.g. coding help, recipes). For everything travel related, always try to give a useful answer first.`,
    `Never use emojis in any response.`,
  ].join('\n');
}

const TOOLS = [
  {
    name: 'search_destinations',
    description: 'Search for a hotel destination (city/area) and get its destination code for hotel searches.',
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
        checkIn:  { type: 'string', description: 'Check-in date in YYYY-MM-DD format' },
        checkOut: { type: 'string', description: 'Check-out date in YYYY-MM-DD format' },
        adults:   { type: 'number', description: 'Number of adults (default 2)' },
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
    name: 'search_airports',
    description: 'Look up the IATA airport code for a city or airport name. Call this before search_flights when the user provides a city name instead of an IATA code.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'City name or airport name, e.g. "Mumbai" or "Heathrow"' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_flights',
    description: 'Search for available flights between two airports. Use IATA airport codes (e.g. BOM, DXB) — call search_airports first if you only have city names.',
    input_schema: {
      type: 'object',
      properties: {
        origin:        { type: 'string', description: 'Origin airport IATA code, e.g. "BOM"' },
        destination:   { type: 'string', description: 'Destination airport IATA code, e.g. "DXB"' },
        departureDate: { type: 'string', description: 'Departure date in YYYY-MM-DD format' },
        returnDate:    { type: 'string', description: 'Return date in YYYY-MM-DD format (omit for one-way)' },
        adults:        { type: 'number', description: 'Number of adult passengers (default 1)' },
        cabinClass:    { type: 'string', description: 'Cabin class: economy, premium_economy, business, first (default economy)' },
      },
      required: ['origin', 'destination', 'departureDate'],
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
      case 'search_airports':     result = await searchAirports(input.query); break;
      case 'search_flights':      result = await searchFlights(input.origin, input.destination, input.departureDate, input.returnDate || '', input.adults || 1, input.cabinClass || 'economy'); break;
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
