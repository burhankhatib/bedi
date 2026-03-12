export type MasterCatalogSeedItem = {
  nameEn: string
  nameAr: string
  category: 'grocery' | 'retail' | 'pharmacy' | 'bakery' | 'other' | 'restaurant' | 'cafe'
  searchQuery: string
  unitType: 'kg' | 'piece' | 'pack'
}

/**
 * Starter master catalog templates used by quick-add for supermarkets and shops.
 * `searchQuery` intentionally uses practical English prompts for better Unsplash results.
 */
export const MASTER_CATALOG_SEED: MasterCatalogSeedItem[] = [
  { nameEn: 'Tomatoes', nameAr: 'طماطم', category: 'grocery', searchQuery: 'fresh tomatoes on wooden table', unitType: 'kg' },
  { nameEn: 'Cucumbers', nameAr: 'خيار', category: 'grocery', searchQuery: 'fresh cucumbers market produce', unitType: 'kg' },
  { nameEn: 'Potatoes', nameAr: 'بطاطا', category: 'grocery', searchQuery: 'fresh potatoes in basket', unitType: 'kg' },
  { nameEn: 'Onions', nameAr: 'بصل', category: 'grocery', searchQuery: 'red onions grocery market', unitType: 'kg' },
  { nameEn: 'Bananas', nameAr: 'موز', category: 'grocery', searchQuery: 'ripe bananas bunch supermarket', unitType: 'kg' },
  { nameEn: 'Apples', nameAr: 'تفاح', category: 'grocery', searchQuery: 'fresh apples grocery store', unitType: 'kg' },
  { nameEn: 'Oranges', nameAr: 'برتقال', category: 'grocery', searchQuery: 'fresh oranges close up', unitType: 'kg' },
  { nameEn: 'Lettuce', nameAr: 'خس', category: 'grocery', searchQuery: 'green lettuce head fresh', unitType: 'piece' },
  { nameEn: 'Eggs', nameAr: 'بيض', category: 'grocery', searchQuery: 'carton of eggs professional food photo', unitType: 'pack' },
  { nameEn: 'Milk', nameAr: 'حليب', category: 'grocery', searchQuery: 'milk bottle on kitchen counter', unitType: 'piece' },
  { nameEn: 'Yogurt', nameAr: 'لبن', category: 'grocery', searchQuery: 'yogurt cup dairy product', unitType: 'pack' },
  { nameEn: 'White Cheese', nameAr: 'جبنة بيضاء', category: 'grocery', searchQuery: 'white cheese package dairy', unitType: 'pack' },
  { nameEn: 'Rice', nameAr: 'أرز', category: 'grocery', searchQuery: 'bag of rice grains closeup', unitType: 'pack' },
  { nameEn: 'Sugar', nameAr: 'سكر', category: 'grocery', searchQuery: 'white sugar package pantry', unitType: 'pack' },
  { nameEn: 'Salt', nameAr: 'ملح', category: 'grocery', searchQuery: 'salt package kitchen product', unitType: 'pack' },
  { nameEn: 'Flour', nameAr: 'طحين', category: 'grocery', searchQuery: 'flour bag bakery ingredient', unitType: 'pack' },
  { nameEn: 'Olive Oil', nameAr: 'زيت زيتون', category: 'grocery', searchQuery: 'olive oil bottle product photo', unitType: 'piece' },
  { nameEn: 'Sunflower Oil', nameAr: 'زيت دوار الشمس', category: 'grocery', searchQuery: 'sunflower oil bottle grocery', unitType: 'piece' },
  { nameEn: 'Pasta', nameAr: 'معكرونة', category: 'grocery', searchQuery: 'pasta package grocery shelf', unitType: 'pack' },
  { nameEn: 'Tomato Paste', nameAr: 'معجون طماطم', category: 'grocery', searchQuery: 'tomato paste can product', unitType: 'piece' },
  { nameEn: 'Tuna Can', nameAr: 'علبة تونة', category: 'grocery', searchQuery: 'tuna can grocery product photo', unitType: 'piece' },
  { nameEn: 'Tea', nameAr: 'شاي', category: 'grocery', searchQuery: 'tea box grocery product', unitType: 'pack' },
  { nameEn: 'Instant Coffee', nameAr: 'قهوة سريعة', category: 'grocery', searchQuery: 'instant coffee jar product', unitType: 'pack' },
  { nameEn: 'Bread', nameAr: 'خبز', category: 'bakery', searchQuery: 'fresh bread loaf bakery display', unitType: 'piece' },
  { nameEn: 'Pita Bread', nameAr: 'خبز بيتا', category: 'bakery', searchQuery: 'pita bread stack bakery', unitType: 'pack' },
  { nameEn: 'Croissant', nameAr: 'كرواسون', category: 'bakery', searchQuery: 'fresh croissant bakery pastry', unitType: 'piece' },
  { nameEn: 'Shampoo', nameAr: 'شامبو', category: 'retail', searchQuery: 'shampoo bottle product photography', unitType: 'piece' },
  { nameEn: 'Toothpaste', nameAr: 'معجون أسنان', category: 'retail', searchQuery: 'toothpaste tube product shot', unitType: 'piece' },
  { nameEn: 'Dish Soap', nameAr: 'صابون جلي', category: 'retail', searchQuery: 'dish soap bottle cleaning product', unitType: 'piece' },
  { nameEn: 'Laundry Detergent', nameAr: 'مسحوق غسيل', category: 'retail', searchQuery: 'laundry detergent package', unitType: 'pack' },
  { nameEn: 'Garbage Bags', nameAr: 'أكياس نفايات', category: 'retail', searchQuery: 'garbage bags package product', unitType: 'pack' },
  { nameEn: 'Paracetamol', nameAr: 'باراسيتامول', category: 'pharmacy', searchQuery: 'paracetamol medicine box', unitType: 'pack' },
  { nameEn: 'Vitamin C', nameAr: 'فيتامين سي', category: 'pharmacy', searchQuery: 'vitamin c supplements bottle', unitType: 'pack' },
  { nameEn: 'Hand Sanitizer', nameAr: 'معقم يدين', category: 'pharmacy', searchQuery: 'hand sanitizer bottle product', unitType: 'piece' },
]

