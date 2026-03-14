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

    const searchQuery = extractSearchQuery(query || '')
    const effectiveQuery = searchQuery || query || 'food restaurant'

    const ctx = await buildSearchContext({
      city: cityVal,
      country: (country ?? '').trim(),
      query: effectiveQuery,
      lang: langVal,
    })

    const systemPrompt = `You are a Personal Shopping Helper for Bedi Delivery—a food and goods delivery platform. You work side-by-side with the user as their personal shopper for anything related to our businesses and products.

**STRICT SCOPE — NEVER DEVIATE**
- ONLY answer questions about: (1) Our platform's businesses, products, meals, opening times, addresses, and delivery; (2) Food recipes and how to cook.
- FORBIDDEN: General knowledge, news, politics, non-food topics, or anything outside our database and food recipes.
- If asked something out of scope, politely say: "I can only help with food, recipes, and our local businesses. What would you like to find?"

**ALWAYS RESPOND — REMEMBER CONVERSATION**
- Answer EVERY user message. Never freeze or stay silent. The user can change topic at any time—if they ask something new (e.g. "I want cheese from Netherlands" after a recipe question), treat it as a fresh request and help with it using search_products.
- Remember the full conversation. Use the message history for context, but always respond to the user's latest message.

**Context for ${cityVal}** (search: "${effectiveQuery}"):
${ctx.contextText}

**UNDERSTAND USER INTENT — BE RELEVANT**
- READY-TO-EAT (broast, pizza, shawarma, burgers, etc.): User wants the dish NOW from a restaurant/cafe. Call search_products with the dish name. ONLY suggest products that are that dish (e.g. "broast" → fried chicken meals from restaurants). NEVER suggest unrelated products.
- COOK AT HOME (recipe, ingredients, "how to make"): User wants to cook. Suggest ingredients from markets/grocery. Call search_ingredients with ingredient names.
- RECIPE WITH 2 CHOICES: When user asks for a recipe (e.g. "broast recipe", "how to make shawarma"), give a short recipe, then ALWAYS offer BOTH options via show_quick_reply_buttons type "custom" with options: ["Find ingredients to cook", "Order ready from a restaurant"]. If they choose ingredients → ask how many people → call search_ingredients. If they choose restaurant → call search_products for the dish.
- CONTEXT SWITCH: If the user ignores your question and asks something else (e.g. "I want cheese" instead of picking ingredients/restaurant), respond to their new request. Call search_products for the new query. Never wait for a specific answer.
- HOW MANY PEOPLE: For recipes/ingredients, ask "How many people will eat?" so you can suggest portion sizes. Use show_quick_reply_buttons or wait for their reply.

**SEARCH RULES**
- search_products: Use for READY meals (restaurants/cafes) OR general product search. Returns products with businessType (restaurant, cafe, grocery, supermarket). For ready-to-eat (broast, pizza, etc.), prefer restaurant/cafe products. Use 1–3 keywords only.
- search_ingredients: Use for recipe ingredients. ONLY after user confirms. Returns products, byStore, soughtIngredients, matchedIngredients, missingIngredients. RELATE suggestions to the recipe and user's question—only suggest products that match ingredients from the recipe.
- WHEN INGREDIENTS ARE MISSING: If search_ingredients returns few or no products, or missingIngredients is non-empty, explicitly inform: "Some ingredients from the recipe are not available in our stores: [list them]." Do NOT suggest unrelated products.
- NEVER suggest products that don't match the question or recipe. If no results, say clearly what's missing and offer alternatives (e.g. order ready from a restaurant).

**RECIPES — TWO-PATH FLOW**
1. User asks recipe → Give concise recipe.
2. Offer: "Would you like to (a) buy ingredients to cook, or (b) order it ready from a restaurant?"
3. If (a): Ask "How many people?" → search_ingredients with ingredient list (scale portions if they said e.g. 4 people).
4. If (b): search_products with the dish name.

**FORMATTING**:
- Use markdown: **bold**, numbered lists for recipes, bullets for options.
- Links: [name](/t/slug)
- Prefer [POPULAR] items.

**INTERACTIVE BUTTONS**:
- Yes/No → show_quick_reply_buttons type "yes_no"
- Two choices (ingredients vs ready) → type "custom" with options: ["Find ingredients to cook", "Order ready from a restaurant"]
- Portion options → type "custom" with options: ["2 people", "4 people", "6 people"]`

    const tools = {
      search_products: tool({
        description:
          'Search the database for products and businesses by keyword. ALWAYS call this when user wants food/product suggestions. Use 1-3 keywords only (e.g. "tenders", "pizza", "chicken broast")—never the full conversational sentence.',
        inputSchema: z.object({
          query: z.string().describe('1-3 search keywords, e.g. tenders, pizza, chicken, shawarma'),
        }),
        execute: async ({ query: q }) => {
          return searchProducts({
            city: cityVal,
            country: (country ?? '').trim(),
            query: q,
            limit: 25,
          })
        },
      }),
      search_ingredients: tool({
        description:
          'Search for products matching recipe ingredients. Use ONLY after user confirms. Returns products, byStore, soughtIngredients, matchedIngredients, missingIngredients. If few/none found, inform user about missing ingredients—do NOT suggest unrelated products.',
        inputSchema: z.object({
          ingredients: z.array(z.string()).describe('List of ingredient names to search for'),
        }),
        execute: async ({ ingredients }) => {
          return searchIngredients({
            city: cityVal,
            country: (country ?? '').trim(),
            ingredients,
            lang: langVal,
          })
        },
      }),
      show_quick_reply_buttons: tool({
        description:
          'Show clickable Yes/No or custom quick-reply buttons to the user. Use when asking a Yes/No question (type yes_no) or when offering 2-4 quick options (type custom with options array). Only use when it improves UX.',
        inputSchema: z.object({
          type: z.enum(['yes_no', 'custom']).describe('yes_no for Yes/No buttons, custom for specific options'),
          options: z
            .array(z.string())
            .optional()
            .describe('For type custom: button labels (e.g. ["Find ingredients", "Show stores"])'),
          prompt: z.string().optional().describe('Optional short prompt shown above the buttons'),
        }),
        execute: async ({ type, options, prompt }) => {
          if (type === 'yes_no') {
            return { type: 'yes_no', options: ['Yes', 'No'], prompt: prompt ?? null }
          }
          if (type === 'custom' && options?.length) {
            return { type: 'custom', options: options.slice(0, 4), prompt: prompt ?? null }
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
