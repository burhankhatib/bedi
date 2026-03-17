/**
 * Maps menu subcategory titles to product search keywords for context-aware catalog filtering.
 * When a user opens Global Catalog from e.g. Fresh Produce → Vegetables, we filter/boost
 * products matching these keywords (Tomatoes, Potatoes, Onions, etc.).
 *
 * Keys: normalized title_en (lowercase, trimmed). Values: arrays of keyword stems for GROQ match.
 */
export const SUBCATEGORY_SEARCH_KEYWORDS: Record<string, string[]> = {
  // Fresh Produce
  vegetables: [
    'tomato', 'potato', 'onion', 'cucumber', 'eggplant', 'pepper', 'carrot', 'lettuce',
    'garlic', 'lemon', 'lime', 'celery', 'cabbage', 'broccoli', 'cauliflower', 'zucchini',
    'squash', 'pumpkin', 'beet', 'radish', 'turnip', 'spinach', 'kale', 'asparagus',
    'corn', 'green bean', 'pea', 'artichoke', 'okra', 'mushroom', 'ginger',
    'طماطم', 'بطاطا', 'بصل', 'خيار', 'باذنجان', 'جزر', 'خس', 'ثوم', 'ليمون',
  ],
  'leafy vegetables & herbs': [
    'lettuce', 'spinach', 'parsley', 'cilantro', 'mint', 'dill', 'basil', 'arugula',
    'kale', 'chard', 'coriander', 'oregano', 'thyme', 'rosemary', 'sage',
    'خس', 'سبانخ', 'بقدونس', 'كزبرة', 'نعناع', 'شبت', 'ريحان',
  ],
  'organic leafy vegetables & herbs': [
    'lettuce', 'spinach', 'parsley', 'organic', 'خضروات', 'عضوي',
  ],
  fruits: [
    'apple', 'orange', 'banana', 'grape', 'melon', 'peach', 'pear', 'plum', 'apricot',
    'cherry', 'strawberry', 'watermelon', 'mango', 'pineapple', 'kiwi', 'avocado',
    'pomegranate', 'fig', 'date', 'coconut', 'berry', 'citrus', 'tangerine',
    'تفاح', 'برتقال', 'موز', 'عنب', 'بطيخ', 'خوخ', 'مانجو', 'فراولة', 'رمان',
  ],
  'organic fruits': ['apple', 'orange', 'banana', 'organic', 'فواكه', 'عضوي'],
  'dried fruits': ['raisin', 'date', 'fig', 'apricot', 'prune', 'cranberry', 'فواكه مجففة'],
  'nuts & seeds': [
    'almond', 'walnut', 'cashew', 'pistachio', 'hazelnut', 'peanut', 'sunflower',
    'sesame', 'pumpkin seed', 'pinoli', 'مكسرات', 'لوز', 'جوز', 'فستق', 'سمسم',
  ],
  // Dairy & Eggs
  eggs: ['egg', 'بيض'],
  milk: ['milk', 'حليب'],
  'cottage cheese & white cheeses': ['cheese', 'cottage', 'white', 'جبنة', 'قريش'],
  'yellow cheeses': ['cheese', 'yellow', 'cheddar', 'gouda', 'جبنة', 'صفراء'],
  yogurt: ['yogurt', 'yoghurt', 'لبن', 'زبادي'],
  butter: ['butter', 'زبدة', 'سمن'],
  // Baked Goods
  bread: ['bread', 'loaf', 'خبز', 'طحين'],
  'pita bread': ['pita', 'bread', 'خبز', 'بيتا'],
  cakes: ['cake', 'كعك', 'حلوى'],
  biscuits: ['biscuit', 'cookie', 'بسكويت'],
  // Frozen
  'frozen vegetables': ['frozen', 'vegetable', 'خضروات', 'مجمدة'],
  'frozen fruits': ['frozen', 'fruit', 'فواكه', 'مجمدة'],
  pizza: ['pizza', 'بيتزا'],
  // Drinks & Juices
  water: ['water', 'مياه', 'ماء'],
  'carbonated drinks': ['cola', 'soda', 'fanta', 'sprite', 'مشروبات', 'غازية'],
  juices: ['juice', 'عصير', 'عصائر'],
  tea: ['tea', 'شاي'],
  'instant coffee': ['coffee', 'instant', 'قهوة', 'سريعة'],
  // Grocery & Pantry
  'sugar and salt': ['sugar', 'salt', 'سكر', 'ملح'],
  flour: ['flour', 'طحين', 'دقيق'],
  spices: ['spice', 'بهارات', 'توابل'],
  oils: ['oil', 'olive', 'sunflower', 'vegetable', 'زيت', 'زيتون'],
  'canned vegetables': ['canned', 'tomato', 'beans', 'peas', 'معلبة', 'خضروات'],
  'canned tuna and fish': ['tuna', 'fish', 'سردين', 'تونة', 'سمك'],
  'pasta and vermicelli': ['pasta', 'noodle', 'spaghetti', 'معكرونة', 'شعيرية'],
  'rice and couscous': ['rice', 'couscous', 'أرز', 'كسكس'],
  legumes: ['lentil', 'chickpea', 'bean', 'hummus', 'بقوليات', 'عدس', 'حمص'],
  // Sweets & Snacks
  chocolate: ['chocolate', 'شوكولاتة'],
  sweets: ['sweet', 'candy', 'حلويات'],
  'nuts and seeds': [
    'almond', 'walnut', 'pistachio', 'peanut', 'مكسرات', 'لوز', 'فستق',
  ],
  snacks: ['bamba', 'bisli', 'chips', 'cracker', 'popcorn', 'وجبات', 'بامبا', 'بيسلي'],
  // Cleaning & Hygiene
  detergents: ['detergent', 'soap', 'منظف', 'صابون'],
  'garbage bags': ['garbage', 'bag', 'أكياس', 'نفايات'],
  // Health & Beauty
  shampoo: ['shampoo', 'شامبو'],
  toothpaste: ['toothpaste', 'معجون', 'أسنان'],
  // Ready Meals
  'hummus and tahini salad': ['hummus', 'tahini', 'طحينة', 'حمص'],
  'pickles and olives': ['pickle', 'olive', 'مخلل', 'زيتون'],
  salami: ['salami', 'pastrami', 'سلامي', 'بسطرمة'],
}

/** Normalize subcategory title for lookup (lowercase, trim). */
export function normalizeSubcategoryKey(title: string): string {
  return (title ?? '').toLowerCase().trim()
}

/** Get search keywords for a menu subcategory. Returns empty array if no match. */
export function getKeywordsForSubcategory(menuCategoryTitle: string): string[] {
  const key = normalizeSubcategoryKey(menuCategoryTitle)
  return SUBCATEGORY_SEARCH_KEYWORDS[key] ?? []
}
