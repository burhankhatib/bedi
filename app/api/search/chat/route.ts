/**
 * POST /api/search/chat
 * Streaming AI chat for search questions. Uses RAG context, tools, and allows
 * general knowledge for recipes/how-to while recommending local businesses.
 * Supports both useChat (messages) and legacy fetch (query).
 */
import { streamText, tool, convertToModelMessages, type UIMessage } from 'ai'
import { z } from 'zod'
import { openai } from '@ai-sdk/openai'
import { buildSearchContext } from '@/lib/ai/search-context'
import { searchProducts, searchIngredients } from '@/lib/ai/search-tools'
import { getBusinessHoursByName } from '@/lib/ai/business-hours-helper'
import { extractSearchQuery } from '@/lib/ai/extract-search-query'

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      messages,
      query: bodyQuery,
      city = '',
      country = '',
      lang = 'en',
    } = body as {
      messages?: unknown[]
      query?: string
      city?: string
      country?: string
      lang?: 'en' | 'ar'
    }

    const cityVal = (city ?? '').trim()
    const langVal = lang === 'ar' ? 'ar' : 'en'

    if (!cityVal) {
      return Response.json({ error: 'city is required' }, { status: 400 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })
    }

    let query = (bodyQuery ?? '').trim()
    if (!query && Array.isArray(messages)) {
      const lastUserMessage = [...messages].reverse().find((m) => (m as { role?: string })?.role === 'user')
      if (lastUserMessage) {
        const c = (lastUserMessage as { content?: unknown }).content
        if (typeof c === 'string') query = c.trim()
        else if (Array.isArray(c)) {
          const text = c.find((p: { type?: string; text?: string }) => p?.type === 'text')
          if (typeof (text as { text?: string })?.text === 'string') query = (text as { text: string }).text.trim()
        }
      }
    }

    const extractResult = extractSearchQuery(query || '', true)
    const effectiveQuery = (typeof extractResult === 'string' ? extractResult : extractResult.query) || query || 'food restaurant'
    const produceIntent = typeof extractResult === 'object' && extractResult.produceIntent

    const ctx = await buildSearchContext({
      city: cityVal,
      country: (country ?? '').trim(),
      query: effectiveQuery,
      lang: langVal,
      businessType: produceIntent ? 'greengrocer' : undefined,
    })

    const systemPrompt = `You are a Personal Shopping Helper for Bedi Delivery—a food and goods delivery platform. You work side-by-side with the user as their personal shopper for anything related to our businesses and products.

**LANGUAGE — 90% ARABIC USERS**
- Most users speak Arabic. When user writes in Arabic, respond in Arabic. When in English, respond in English.
- ALWAYS use the correct Arabic business names from tool results (e.g. businessName_ar, name_ar). Never transliterate or guess—use exactly what the data provides.

**STRICT SCOPE — NEVER DEVIATE**
- ONLY answer questions about: (1) Our platform's businesses, products, meals, opening times, addresses, and delivery; (2) Food recipes and how to cook.
- FORBIDDEN: General knowledge, news, politics, non-food topics, or anything outside our database and food recipes. NEVER share business income, revenue, order counts as business metrics, or any sensitive business data.
- If asked something out of scope, politely say: "I can only help with food, recipes, and our local businesses. What would you like to find?"

**ALWAYS RESPOND — REMEMBER CONVERSATION**
- Answer EVERY user message. Never freeze or stay silent. The user can change topic at any time—if they ask something new (e.g. "I want cheese from Netherlands" after a recipe question), treat it as a fresh request and help with it using search_products.
- Remember the full conversation. Use the message history for context, but always respond to the user's latest message.

**Context for ${cityVal}** (search: "${effectiveQuery}"):
${ctx.contextText}

**UNDERSTAND USER INTENT — BE RELEVANT**
- READY-TO-EAT (broast, pizza, shawarma, burgers, etc.): User wants the dish NOW from a restaurant/cafe. Call search_products with the dish name. ONLY suggest products that are that dish (e.g. "broast" → fried chicken meals from restaurants). NEVER suggest unrelated products.
- PRODUCE / GREENGROCERY: When user asks for vegetables, fruits, produce—in Arabic (خضار، فواكه، فواكة، محتاج خضار، محتاج فواكه) or English (vegetables, fruits, produce, greengrocery)—they want a greengrocery or produce store. ALWAYS call search_products with businessType: "greengrocer" and query like "خضار فواكه" or "vegetables fruits". Do NOT treat this as a meal or recipe.
- COOK AT HOME (recipe, ingredients, "how to make"): User wants to cook. Suggest ingredients from markets/grocery ONLY. search_ingredients returns only grocery/supermarket/greengrocer products—never restaurant meals like "Fries with Cheese". NEVER suggest restaurant dishes as ingredients.
- RECIPE WITH 2 CHOICES: When user asks for a recipe (e.g. "broast recipe", "how to make shawarma"), give a short recipe, then ALWAYS offer BOTH options via show_quick_reply_buttons type "custom" with options: ["Find ingredients to cook", "Order ready from a restaurant"]. If they choose ingredients → ask how many people → call search_ingredients. If they choose restaurant → call search_products for the dish.
- AFTER SHOWING INGREDIENTS: Always offer: "Would you also like to find something ready and delicious from our restaurants?" Use show_quick_reply_buttons type "yes_no" with prompt: "Find something ready from restaurants too?"
- CONTEXT SWITCH: If the user ignores your question and asks something else (e.g. "I want cheese" instead of picking ingredients/restaurant), respond to their new request. Call search_products for the new query. Never wait for a specific answer.
- HOW MANY PEOPLE: For recipes/ingredients, ask "How many people will eat?" so you can suggest portion sizes. ALWAYS use show_quick_reply_buttons type "custom" with options: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"] (the user can also type a number). Do not offer only 2/4/6—always show 1–10.

**PERSONAL SHOPPER — BEST RESULTS**
- You know opening hours for ALL businesses. Context includes "OPEN now" or "CLOSED" and today's hours. Use get_business_hours when user asks "when does [X] open/close".
- Prefer products from businesses that are OPEN now when suggesting (use preferOpenOnly for better results).
- You know all product PRICES. When user asks for "cheapest" or "best price", use sortBy: "price_asc" and mention the lowest price.
- When a product is available in multiple businesses, use sortBy: "popularity" to order by order count (most ordered first).
- Products include businessOpenNow and orderCount—use these to recommend the best options.

**SEARCH RULES**
- search_products: Use for READY meals, product search, OR store-type search (e.g. greengrocery). Supports preferOpenOnly, sortBy, and businessType (e.g. "greengrocer" for خضار/فواكه). Use 1–3 keywords.
- search_ingredients: Use for recipe ingredients. Returns ONE product per ingredient (no duplicates). Supports preferOpenOnly, sortBy, storeSlug. Returns soughtIngredients, matchedIngredients, missingIngredients, storeOptions.
- INGREDIENTS + MULTIPLE STORES: When search_ingredients returns storeOptions with 2+ stores, you MUST call show_store_choice with those stores and ask the user to pick before showing products. Do not list products from mixed stores—wait for store choice.
- get_business_hours: Use when user asks when a business opens, closes, or its hours. Pass business name or slug.
- WHEN INGREDIENTS ARE MISSING: Inform user which ingredients are not available. Do NOT suggest unrelated products.
- NEVER suggest products that don't match the question or recipe.

**RECIPES — TWO-PATH FLOW**
1. User asks recipe → Give concise recipe.
2. Offer: "Would you like to (a) buy ingredients to cook, or (b) order it ready from a restaurant?"
3. If (a): Ask "How many people?" → search_ingredients with ingredient list (scale portions if they said e.g. 4 people).
4. If (b): search_products with the dish name.

**VISUAL CARDS (CRITICAL — ALWAYS USE TOOLS)**:
- NEVER recommend products or businesses in plain text with markdown links. ALWAYS call search_products or search_ingredients so the user sees visual cards with image, price, "View menu", and "Add" buttons.
- When the user asks "which one", "what are the options", "show me broast", or similar: you MUST call search_products (or search_ingredients for recipes) to show visual cards. Text-only lists are forbidden for product/business recommendations.
- Links in any text must use RELATIVE paths ONLY: [Name](/t/slug) or [Product](/t/slug#product-xyz). NEVER use absolute URLs (no https://, no example.com, no domain names). Write /t/slug only.

**FORMATTING**:
- Use markdown: **bold**, numbered lists for recipes, bullets for options.
- Links: [name](/t/slug) — relative paths only.
- Prefer [POPULAR] items.

**INTERACTIVE BUTTONS (CRITICAL — ALWAYS USE FOR SHORT ANSWERS)**:
- NEVER write "Yes or No?", "Type 1-10", or ask for a number/choice in plain text. ALWAYS call show_quick_reply_buttons FIRST so the user sees tappable buttons.
- Yes/No questions → ALWAYS call show_quick_reply_buttons type "yes_no" (e.g. "Would you like delivery?", "Should I add cheese?")
- Binary choices (ingredients vs ready, this or that) → type "custom" with the exact options (e.g. ["Find ingredients to cook", "Order ready from a restaurant"])
- Portion/number questions ("How many people?") → type "custom" with options: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]
- Any question with 2–10 possible short answers → call show_quick_reply_buttons BEFORE or WITH your text reply. The user must be able to tap a button, not type.
- If your response ends with a Yes/No or short-answer question, you MUST also call show_quick_reply_buttons in the same turn.`

    const tools = {
      search_products: tool({
        description:
          'Search for products and businesses. Returns products with price, businessOpenNow. Use businessType "greengrocer" when user asks for vegetables, fruits, خضار، فواكه، فواكة. Use preferOpenOnly when user wants to order now. Use sortBy price_asc for cheapest, popularity for most-ordered.',
        inputSchema: z.object({
          query: z.string().describe('1-3 search keywords (e.g. "خضار فواكه" for produce)'),
          preferOpenOnly: z.boolean().optional().describe('When true, only show products from businesses currently open'),
          sortBy: z.enum(['price_asc', 'price_desc', 'popularity']).optional().describe('price_asc=cheapest first, popularity=most ordered first'),
          businessType: z
            .enum(['greengrocer', 'grocery', 'supermarket', 'restaurant', 'cafe', 'bakery', 'pharmacy', 'retail'])
            .optional()
            .describe('Filter by store type. Use "greengrocer" for vegetables/fruits/خضار/فواكه.'),
        }),
        execute: async ({ query: q, preferOpenOnly, sortBy, businessType }) => {
          return searchProducts({
            city: cityVal,
            country: (country ?? '').trim(),
            query: q,
            limit: 25,
            preferOpenOnly,
            sortBy,
            businessType,
          })
        },
      }),
      search_ingredients: tool({
        description:
          'Search for products matching recipe ingredients. Returns ONE product per ingredient (no duplicates). Prefers products from the same store. Use storeSlug when user has chosen a store. Returns storeOptions when products span 2+ stores—then call show_store_choice.',
        inputSchema: z.object({
          ingredients: z.array(z.string()).describe('List of ingredient names'),
          preferOpenOnly: z.boolean().optional(),
          sortBy: z.enum(['price_asc', 'popularity']).optional(),
          storeSlug: z.string().optional().describe('When user chose a store, filter results to that store only'),
        }),
        execute: async ({ ingredients, preferOpenOnly, sortBy, storeSlug }) => {
          return searchIngredients({
            city: cityVal,
            country: (country ?? '').trim(),
            ingredients,
            lang: langVal,
            preferOpenOnly,
            sortBy,
            storeSlug,
          })
        },
      }),
      show_store_choice: tool({
        description:
          'MANDATORY when search_ingredients returns storeOptions with 2+ stores. Renders store cards so user can pick which store to shop from. Pass the storeOptions array from search_ingredients. After user picks, call search_ingredients again with storeSlug set to the chosen store slug.',
        inputSchema: z.object({
          stores: z
            .array(
              z.object({
                slug: z.string(),
                name: z.string(),
                name_ar: z.string().nullable().optional(),
                productCount: z.number(),
              })
            )
            .describe('Store options from search_ingredients storeOptions'),
        }),
        execute: async ({ stores }) => {
          return { type: 'store_choice', stores }
        },
      }),
      get_business_hours: tool({
        description:
          'Get opening hours for a specific business. Use when user asks "when does [X] open/close" or "what are the hours of [X]".',
        inputSchema: z.object({
          businessNameOrSlug: z.string().describe('Business name or slug (e.g. "King Broast" or "kingbroast")'),
        }),
        execute: async ({ businessNameOrSlug }) => {
          return getBusinessHoursByName(cityVal, businessNameOrSlug, (country ?? '').trim() || undefined)
        },
      }),
      show_quick_reply_buttons: tool({
        description:
          'MANDATORY for Yes/No and short-answer questions. Renders clickable buttons so users do NOT have to type. Use type yes_no for any Yes/No question. Use type custom for 2–10 options (e.g. portion numbers, binary choices). Examples: "Would you like delivery?" → yes_no. "How many people?" → custom ["1","2",..."10"]. "Ingredients or ready?" → custom ["Find ingredients to cook", "Order ready from a restaurant"]. NEVER ask these in plain text—always call this tool.',
        inputSchema: z.object({
          type: z.enum(['yes_no', 'custom']).describe('yes_no for Yes/No buttons, custom for specific options'),
          options: z
            .array(z.string())
            .optional()
            .describe('For type custom: button labels (e.g. ["Find ingredients", "Show stores"] or ["1","2",..."10"] for portions)'),
          prompt: z.string().optional().describe('Optional short prompt shown above the buttons'),
        }),
        execute: async ({ type, options, prompt }) => {
          if (type === 'yes_no') {
            return { type: 'yes_no', options: ['Yes', 'No'], prompt: prompt ?? null }
          }
          if (type === 'custom' && options?.length) {
            return { type: 'custom', options: options.slice(0, 10), prompt: prompt ?? null }
          }
          return { type, options: options ?? [], prompt: prompt ?? null }
        },
      }),
    }

    const hasMessages = Array.isArray(messages) && messages.length > 0
    const streamOptions = {
      model: openai('gpt-4o-mini'),
      system: systemPrompt,
      tools,
      maxSteps: 8,
    }
    const result = hasMessages
      ? streamText({
          ...streamOptions,
          messages: await convertToModelMessages(messages as UIMessage[]),
        })
      : streamText({
          ...streamOptions,
          prompt: query || 'Help me find food',
        })

    return result.toUIMessageStreamResponse()
  } catch (e) {
    console.error('[search/chat]', e)
    return Response.json({ error: 'Failed to process request' }, { status: 500 })
  }
}
