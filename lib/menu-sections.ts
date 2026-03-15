/**
 * Common menu section names by business type.
 * Used when a tenant adds a new section to the menu.
 * Pick from these for better categorization and search, or add custom.
 */

export type MenuSection = { title_en: string; title_ar: string }

/** Hierarchical section: main category with sub-categories. Sub-categories shown only when category is selected. */
export type MenuSectionGroup = {
  key: string
  title_en: string
  title_ar: string
  subCategories: MenuSection[]
}

/** Restaurant, cafe, bakery: food-service sections (e.g. Appetizers, Main Dishes). */
export const RESTAURANT_MENU_SECTIONS: MenuSection[] = [
  { title_en: 'Appetizers', title_ar: 'مقبلات' },
  { title_en: 'Main Dishes', title_ar: 'أطباق رئيسية' },
  { title_en: 'Desserts', title_ar: 'حلويات' },
  { title_en: 'Drinks', title_ar: 'مشروبات' },
  { title_en: 'Sides', title_ar: 'أطباق جانبية' },
  { title_en: 'Salads', title_ar: 'سلطات' },
  { title_en: 'Sandwiches', title_ar: 'شطائر' },
  { title_en: 'Breakfast', title_ar: 'فطور' },
  { title_en: 'Kids Menu', title_ar: 'قائمة أطفال' },
  { title_en: 'Combos', title_ar: 'كومبو' },
  { title_en: 'Extras', title_ar: 'إضافات' },
  { title_en: 'Soups', title_ar: 'شوربات' },
  { title_en: 'Juices', title_ar: 'عصائر' },
  { title_en: 'Hot Drinks', title_ar: 'مشروبات ساخنة' },
  { title_en: 'Cold Drinks', title_ar: 'مشروبات باردة' },
]

/** Grocery / Market: supermarket-style sections (e.g. Baladi, Shufersal). */
export const GROCERY_MENU_SECTIONS: MenuSection[] = [
  { title_en: 'Fresh Produce', title_ar: 'المنتجات الطازجة' },
  { title_en: 'Dairy & Eggs', title_ar: 'منتجات الألبان والبيض' },
  { title_en: 'Baked Goods', title_ar: 'المخبوزات' },
  { title_en: 'Meats, Chicken & Fish', title_ar: 'اللحوم والدجاج والأسماك' },
  { title_en: 'Frozen Products', title_ar: 'مجمدات' },
  { title_en: 'Drinks & Juices', title_ar: 'مشروبات وعصائر' },
  { title_en: 'Sweets & Snacks', title_ar: 'حلويات ووجبات خفيفة' },
  { title_en: 'Ready Meals & Appetizers', title_ar: 'وجبات سريعة ومقبلات' },
  { title_en: 'Cereals & Breakfast', title_ar: 'حبوب ووجبات الإفطار' },
  { title_en: 'Grocery & Pantry', title_ar: 'منتجات البقالة' },
  { title_en: 'Rice & Grains', title_ar: 'أرز وحبوب' },
  { title_en: 'Oil & Condiments', title_ar: 'زيوت وتوابل' },
  { title_en: 'Cleaning & Hygiene', title_ar: 'نظافة' },
  { title_en: 'Health & Beauty', title_ar: 'الصحة والتجميل' },
  { title_en: 'Personal Hygiene', title_ar: 'النظافة الشخصية' },
  { title_en: 'Health & Specialized Diets', title_ar: 'الصحة والأنظمة الغذائية المتخصصة' },
  { title_en: 'Pet Products', title_ar: 'حيوانات أليفة' },
  { title_en: 'Baby & Kids', title_ar: 'أطفال ورضع' },
  { title_en: 'Household & Entertainment', title_ar: 'أدوات منزلية وترفيه' },
  { title_en: 'Organic', title_ar: 'عضوي' },
]

/** Grocery hierarchical sections: select category → then show sub-categories. */
export const GROCERY_MENU_SECTION_GROUPS: MenuSectionGroup[] = [
  {
    key: 'fresh-produce',
    title_en: 'Fresh Produce',
    title_ar: 'المنتجات الطازجة',
    subCategories: [
      { title_en: 'Vegetables', title_ar: 'خضراوات' },
      { title_en: 'Leafy Vegetables & Herbs', title_ar: 'خضراوات ورقية وأعشاب' },
      { title_en: 'Organic Leafy Vegetables & Herbs', title_ar: 'خضراوات ورقية وأعشاب عضوية' },
      { title_en: 'Fruits', title_ar: 'فواكه' },
      { title_en: 'Organic Fruits', title_ar: 'فواكه عضوية' },
      { title_en: 'Dried Fruits', title_ar: 'فواكه مجففة' },
      { title_en: 'Dried Fruits by Weight', title_ar: 'الفواكه المجففة بالوزن' },
      { title_en: 'Nuts & Seeds', title_ar: 'مكسرات وبذور' },
    ],
  },
  {
    key: 'dairy-eggs',
    title_en: 'Dairy & Eggs',
    title_ar: 'منتجات الألبان والبيض',
    subCategories: [
      { title_en: 'Eggs', title_ar: 'بيض' },
      { title_en: 'Milk', title_ar: 'حليب' },
      { title_en: 'Unfrozen Milk', title_ar: 'حليب غير مثلج' },
      { title_en: 'Chocolate or Flavored Milk', title_ar: 'حليب بالشوكولاتة أو بالنكهات' },
      { title_en: 'Cottage Cheese & White Cheeses', title_ar: 'أجبان قريش وأجبان بيضاء' },
      { title_en: 'Yellow Cheeses', title_ar: 'أجبان صفراء' },
      { title_en: 'Cream Cheeses', title_ar: 'أجبان الكريمة' },
      { title_en: 'Salty Cheeses', title_ar: 'أجبان مالحة' },
      { title_en: 'Goat Cheeses', title_ar: 'أجبان الماعز' },
      { title_en: 'Butter and Vegetable Ghee', title_ar: 'الزبدة والسمن النباتي' },
      { title_en: 'Yogurt', title_ar: 'زبادي' },
      { title_en: 'Fruit Yogurt', title_ar: 'زبادي بالفواكه' },
      { title_en: 'Sheep Yogurt', title_ar: 'زبادي الغنم' },
      { title_en: 'Desserts', title_ar: 'حلويات' },
      { title_en: 'Yogurt Drinks', title_ar: 'مشروبات الزبادي' },
      { title_en: 'Cream and Coffee Creamers', title_ar: 'الكريمة ومبيضات القهوة' },
      { title_en: 'Sour Cream', title_ar: 'كريمة حامضة' },
      { title_en: 'Yeast', title_ar: 'خميرة' },
    ],
  },
  {
    key: 'baked-goods',
    title_en: 'Baked Goods',
    title_ar: 'المخبوزات',
    subCategories: [
      { title_en: 'Bread', title_ar: 'خبز' },
      { title_en: 'Halla Bread', title_ar: 'خبز حلة' },
      { title_en: 'Bread Discs and Arabic Bread', title_ar: 'أقراص الخبز والخبز العربي' },
      { title_en: 'Tortilla', title_ar: 'تورتيلا' },
      { title_en: 'Cakes', title_ar: 'كعك' },
      { title_en: 'Biscuits', title_ar: 'بسكويت' },
      { title_en: 'Premium Cookies', title_ar: 'Premium Cookies' },
      { title_en: 'Wafer Biscuits and Ice Cream Cones', title_ar: 'بسكويت ويفر وقراطيس آيس كريم' },
      { title_en: 'Frozen Cakes', title_ar: 'كعك مجمد' },
      { title_en: 'Crisps', title_ar: 'مقرمشات' },
      { title_en: 'Toasted Bread', title_ar: 'خبز محمص' },
      { title_en: 'Rice Cakes', title_ar: 'كعك الأرز' },
      { title_en: 'Fresh Bread', title_ar: 'خبز طازج' },
      { title_en: 'Fresh Pastries', title_ar: 'معجنات طازجة' },
      { title_en: 'Fresh Cake', title_ar: 'كيك طازج' },
    ],
  },
  {
    key: 'meats-chicken-fish',
    title_en: 'Meats, Chicken & Fish',
    title_ar: 'اللحوم والدجاج والأسماك',
    subCategories: [
      { title_en: 'Fresh Chicken', title_ar: 'دجاج طازج' },
      { title_en: 'Frozen Chicken', title_ar: 'دجاج مجمد' },
      { title_en: 'Frozen Prepared Products', title_ar: 'منتجات جاهزة مجمدة' },
      { title_en: 'Fresh Beef', title_ar: 'لحم بقري طازج' },
      { title_en: 'Lamb', title_ar: 'لحم ضأن' },
      { title_en: 'Frozen Kebab, Hamburger, and Sausage', title_ar: 'كباب وهمبرغر وسجق مجمد' },
      { title_en: 'Shellfish', title_ar: 'محاريات' },
      { title_en: 'Caviar', title_ar: 'كافيار' },
      { title_en: 'Frozen Fish', title_ar: 'أسماك مجمدة' },
    ],
  },
  {
    key: 'frozen',
    title_en: 'Frozen Products',
    title_ar: 'مجمدات',
    subCategories: [
      { title_en: 'Pizza', title_ar: 'بيتزا' },
      { title_en: 'Borekas', title_ar: 'البوريكاس' },
      { title_en: 'Zalabya / Kreplach', title_ar: 'زلابية / كريبلاخ' },
      { title_en: 'Blintz', title_ar: 'بلينتز' },
      { title_en: 'Jachnun / Malawach', title_ar: 'جحنون / ملواح' },
      { title_en: 'Frozen Dough and Pastries', title_ar: 'عجين وفطائر مجمدة' },
      { title_en: 'Frozen Vegetables', title_ar: 'خضروات مجمدة' },
      { title_en: 'Frozen Fruits', title_ar: 'فواكه مجمدة' },
      { title_en: 'French Fries and Onion Rings', title_ar: 'بطاطس مقلية وحلقات بصل' },
      { title_en: 'Vegetable Products', title_ar: 'المنتجات النباتية' },
      { title_en: 'Grilled Meats', title_ar: 'لحوم مشوية' },
      { title_en: 'Breaded Frozen Chicken and Chicken Products', title_ar: 'دجاج مجمد بالبقسماط ومنتجات الدجاج' },
      { title_en: 'Frozen Ready Meals', title_ar: 'طعام جاهز مجمد' },
      { title_en: 'Family Ice Cream', title_ar: 'بوظة عائلية' },
      { title_en: 'Individual Ice Cream', title_ar: 'آيس كريم فردي' },
      { title_en: 'Ice Cream Sticks', title_ar: 'أصابع الآيس كريم' },
      { title_en: 'Frozen Desserts and Ice Pops', title_ar: 'مثلجات ومصاصات مثلجة' },
    ],
  },
  {
    key: 'drinks-juices',
    title_en: 'Drinks & Juices',
    title_ar: 'مشروبات وعصائر',
    subCategories: [
      { title_en: 'Water', title_ar: 'مياه' },
      { title_en: 'Carbonated Drinks', title_ar: 'المشروبات الغازية' },
      { title_en: 'Juices', title_ar: 'العصائر' },
      { title_en: 'Juices and Nectars', title_ar: 'العصائر والنكترات' },
      { title_en: 'Fresh Juices', title_ar: 'عصائر طازجة' },
      { title_en: 'Energy Drinks', title_ar: 'مشروبات الطاقة' },
      { title_en: 'Iced Tea and Iced Coffee', title_ar: 'الشاي المثلج والقهوة المثلجة' },
      { title_en: 'Concentrated Drinks and Liquids', title_ar: 'مشروبات وسوائل مركزة' },
      { title_en: 'Tea', title_ar: 'شاي' },
      { title_en: 'Instant Coffee', title_ar: 'قهوة فورية' },
      { title_en: 'Black Coffee', title_ar: 'قهوة سوداء' },
      { title_en: 'Capsules', title_ar: 'كبسولات' },
      { title_en: 'Chocolate and Drink Mixes', title_ar: 'شوكولاتة ومزيج مشروبات' },
      { title_en: 'Coffee Alternatives', title_ar: 'بدائل القهوة' },
      { title_en: 'Coffee Beans', title_ar: 'Coffee Beans' },
      { title_en: 'Non-alcoholic Beer', title_ar: 'بيرة بدون كحول' },
      { title_en: 'Grape Juice', title_ar: 'عصير عنب' },
    ],
  },
  {
    key: 'sweets-snacks',
    title_en: 'Sweets & Snacks',
    title_ar: 'حلويات ووجبات خفيفة',
    subCategories: [
      { title_en: 'Chocolate', title_ar: 'شوكولاتة' },
      { title_en: 'Chocolate Treats', title_ar: 'مسليات شوكولاتة' },
      { title_en: 'Sweets', title_ar: 'حلويات' },
      { title_en: 'Chewing Gum', title_ar: 'العلكة' },
      { title_en: 'Marshmallows', title_ar: 'مارشملو' },
      { title_en: 'Family Packs', title_ar: 'مجموعات عائلية' },
      { title_en: 'Chocolate Boxes', title_ar: 'علب الشوكولاتة' },
      { title_en: 'Eid Boxes', title_ar: 'علب العيد' },
      { title_en: 'Nuts and Seeds', title_ar: 'مكسرات وبذور' },
      { title_en: 'Bisli and Bamba', title_ar: 'بيسلي وبامبا' },
      { title_en: 'Snacks, Crackers, and Chips', title_ar: 'وجبات خفيفة وعقدية ورقائق' },
      { title_en: 'Popcorn', title_ar: 'فشار' },
    ],
  },
  {
    key: 'ready-meals',
    title_en: 'Ready Meals & Appetizers',
    title_ar: 'وجبات لذيذة وسلطات',
    subCategories: [
      { title_en: 'Fresh Sandwiches', title_ar: 'ساندويشات طازجة' },
      { title_en: 'Soups', title_ar: 'الحساء' },
      { title_en: 'Salami', title_ar: 'سلامي' },
      { title_en: 'Pastrami', title_ar: 'بسطرمة' },
      { title_en: 'Pickles and Olives', title_ar: 'مخللات و زيتون' },
      { title_en: 'Cheeses and Butter', title_ar: 'أجبان وزبدة' },
      { title_en: 'Salami and Pastrami', title_ar: 'سلامي وبسطرمة' },
      { title_en: 'Sausages', title_ar: 'نقانق' },
      { title_en: 'Fish Salads and Spreads', title_ar: 'سلطات الأسماك وطعام الدهن' },
      { title_en: 'Hummus and Tahini Salad', title_ar: 'سلطة الحمص والطحينة' },
      { title_en: 'Turkish and Cooked Salad', title_ar: 'سلطة تركية ومطبوخة' },
      { title_en: 'Eggplant and Coleslaw Salad', title_ar: 'سلطة الباذنجان وكولسلو' },
      { title_en: 'Various Salads', title_ar: 'سلطات متنوعة' },
      { title_en: 'Dipping and Spreading Food', title_ar: 'طعام للتغميس والدهن' },
      { title_en: 'Spicy Salads', title_ar: 'سلطات حارة' },
    ],
  },
  {
    key: 'cereals-breakfast',
    title_en: 'Cereals & Breakfast',
    title_ar: 'الحبوب ووجبات الإفطار',
    subCategories: [
      { title_en: 'Breakfast Cereals', title_ar: 'حبوب الإفطار' },
      { title_en: 'Breakfast Cereals for Children', title_ar: 'حبوب الإفطار للأطفال' },
      { title_en: 'Granola', title_ar: 'الجرانولا' },
      { title_en: 'Oatmeal Flour', title_ar: 'دقيق الشوفان' },
      { title_en: 'Cereal Bars', title_ar: 'أصابع الحبوب' },
      { title_en: 'Energy Bars', title_ar: 'أصابع الطاقة' },
    ],
  },
  {
    key: 'grocery-pantry',
    title_en: 'Grocery & Pantry',
    title_ar: 'منتجات البقالة',
    subCategories: [
      { title_en: 'Sugar and Salt', title_ar: 'سكر وملح' },
      { title_en: 'Flour', title_ar: 'دقيق' },
      { title_en: 'Spices', title_ar: 'بهارات' },
      { title_en: 'Oils', title_ar: 'زيوت' },
      { title_en: 'Breadcrumbs', title_ar: 'بقسماط' },
      { title_en: 'Sweeteners', title_ar: 'المحليات' },
      { title_en: 'Canned Vegetables', title_ar: 'خضروات معلبة' },
      { title_en: 'Canned Fruits', title_ar: 'فاكهة معلبة' },
      { title_en: 'Canned Tuna and Fish', title_ar: 'التونة والأسماك المعلبة' },
      { title_en: 'Canned Tomatoes and Pasta', title_ar: 'الطماطم والمعجنات المعلبة' },
      { title_en: 'Tahini and Spices', title_ar: 'طحينة وتوابل' },
      { title_en: 'Vinegar and Lemon Juice', title_ar: 'خل وعصير ليمون' },
      { title_en: 'Cooking Sauces', title_ar: 'صلصات الطبخ' },
      { title_en: 'Salad Dressings', title_ar: 'صلصات السلطة' },
      { title_en: 'Canned Meats', title_ar: 'اللحوم المعلبة' },
      { title_en: 'Dips and Spreads', title_ar: 'طعام للتغميس والدهن' },
      { title_en: 'Legumes', title_ar: 'بقوليات' },
      { title_en: 'Grains', title_ar: 'حبوب' },
      { title_en: 'Pasta and Vermicelli', title_ar: 'المعكرونة والشعيرية' },
      { title_en: 'Rice and Couscous', title_ar: 'الأرز والكسكس' },
      { title_en: 'Soups and Cooking Mixes', title_ar: 'الحساء وخلطات الطبخ' },
      { title_en: 'Croutons', title_ar: 'الكروتون' },
      { title_en: 'International Foods', title_ar: 'أطعمة عالمية' },
      { title_en: 'Baking Chocolate and Chips', title_ar: 'الشوكولاتة الخبز ورقائق' },
      { title_en: 'Baking Supplies', title_ar: 'مسلتزمات الخبز' },
      { title_en: 'Gums and Sweets', title_ar: 'حيلي وحلويات' },
      { title_en: 'Drinks and Cake Fillings', title_ar: 'مشروبات وحشوات الكعك' },
      { title_en: 'Baking Mixes and Pie Crusts', title_ar: 'خلطات الخبز وقشور الفطائر' },
      { title_en: 'Poppy Seeds, Sesame, and Coconut', title_ar: 'الخشخاش والسمسم وجوز الهند' },
      { title_en: 'Almonds and Nuts', title_ar: 'اللوز والمكسرات' },
      { title_en: 'Cake Decorations', title_ar: 'زينة للكعك' },
      { title_en: 'Honey and Date Syrup', title_ar: 'العسل وشراب التمر' },
      { title_en: 'Nut Butters and Spreads', title_ar: 'زبدة مكسرات وطعام الدهن' },
      { title_en: 'Jams', title_ar: 'المربى' },
      { title_en: 'Halva', title_ar: 'حلاوة' },
    ],
  },
  {
    key: 'household-entertainment',
    title_en: 'Household & Entertainment',
    title_ar: 'أدوات منزلية وترفيه',
    subCategories: [
      { title_en: 'Household items', title_ar: 'أدوات منزلية' },
      { title_en: 'Candles and matchsticks', title_ar: 'شموع وأعواد ثقاب' },
      { title_en: 'BBQ products', title_ar: 'منتجات الشواء' },
      { title_en: 'Stationery and office supplies', title_ar: 'القرطاسية والأدوات المكتبية' },
      { title_en: 'Car products', title_ar: 'منتجات السيارات' },
      { title_en: 'Gardening supplies', title_ar: 'مستلزمات الحدائق' },
      { title_en: 'Kitchen accessories', title_ar: 'ملحقات المطبخ' },
      { title_en: 'Electrical Fittings', title_ar: 'Electrical Fittings' },
      { title_en: 'Batteries', title_ar: 'Batteries' },
      { title_en: 'Toys and handicrafts', title_ar: 'ألعاب وحرف يدوية' },
      { title_en: 'Party supplies', title_ar: 'منتجات الاحتفال' },
      { title_en: 'Plates, cups, bowls, and trays', title_ar: 'أطباق وأكواب وأوعية وصوان' },
      { title_en: 'Food bags', title_ar: 'أكياس الطعام' },
      { title_en: 'Knives, bags, and straws', title_ar: 'السكاكين والأكياس والقش' },
      { title_en: 'Sheets and tissues', title_ar: 'شراشف ومناديل' },
      { title_en: 'Plastic wrap and aluminum foil', title_ar: 'غلاف بلاستيكي وورق القصدير' },
      { title_en: 'Cups / Baking paper', title_ar: 'أكواب/ورق الخبز' },
      { title_en: 'Aluminum molds, and paper molds', title_ar: 'قوالب الألمنيوم، وقوالب الورق' },
      { title_en: 'Plastic containers', title_ar: 'عبوات بلاستيكية' },
      { title_en: 'Biodegradable', title_ar: 'قابلة للتحلل' },
    ],
  },
  {
    key: 'cleaning',
    title_en: 'Cleaning & Hygiene',
    title_ar: 'نظافة',
    subCategories: [
      { title_en: 'Kitchen', title_ar: 'المطبخ' },
      { title_en: 'Floors and General Purpose', title_ar: 'الأرضيات والأغراض العامة' },
      { title_en: 'Bathrooms', title_ar: 'الحمامات' },
      { title_en: 'Air Fresheners', title_ar: 'معطرات الجو' },
      { title_en: 'Furniture and Carpets', title_ar: 'الأثاث والسجاد' },
      { title_en: 'Drain Cleaners', title_ar: 'مزيل الانسدادات' },
      { title_en: 'Pest Control', title_ar: 'مكافحة الآفات' },
      { title_en: 'Toilet Paper and Tissues', title_ar: 'ورق التواليت والمناديل' },
      { title_en: 'Paper Towels', title_ar: 'مناشف ورقية' },
      { title_en: 'Wet Wipes', title_ar: 'مناديل مبللة' },
      { title_en: 'Detergents', title_ar: 'منظفات' },
      { title_en: 'Fabric Softeners', title_ar: 'منعم الغسيل' },
      { title_en: 'Washing Products', title_ar: 'منتجات الغسل' },
      { title_en: 'Washing Aids', title_ar: 'مساعدات الغسل' },
      { title_en: 'Ironing Clothes', title_ar: 'كي الملابس' },
      { title_en: 'Garbage Bags', title_ar: 'أكياس القمامة' },
      { title_en: 'Sponges and Washing Tools', title_ar: 'إسفنج وأدوات غسل' },
      { title_en: 'Cleaning Cloths', title_ar: 'أقمشة التنظيف' },
      { title_en: 'Gloves', title_ar: 'قفازات' },
      { title_en: 'Brooms, Mops, and Brushes', title_ar: 'مكانس ومساحات وفرش' },
      { title_en: 'Shoe Care Products', title_ar: 'منتجات العناية بالأحذية' },
    ],
  },
  {
    key: 'health-beauty',
    title_en: 'Health & Beauty',
    title_ar: 'الصحة والتجميل',
    subCategories: [
      { title_en: 'Shampoo and Conditioner', title_ar: 'شامبو وبلسم' },
      { title_en: 'Body Wash', title_ar: 'غسول الجسم' },
      { title_en: 'Soap Bars', title_ar: 'قوالب صابون' },
      { title_en: 'Sponges', title_ar: 'إسفنج' },
      { title_en: 'Cleansing Gel', title_ar: 'جل تنظيف' },
      { title_en: "Women's Products", title_ar: 'منتجات المرأة' },
      { title_en: 'Toothpastes', title_ar: 'معاجين الأسنان' },
      { title_en: 'Toothbrushes', title_ar: 'فرش الأسنان' },
      { title_en: 'Mouthwash', title_ar: 'غسول الفم' },
      { title_en: 'Dental Sticks and Floss', title_ar: 'عيدان وخيوط الأسنان' },
      { title_en: 'Cotton Balls and Earbuds', title_ar: 'كرات قطنية وأعواد الأذن' },
      { title_en: 'Bandages', title_ar: 'ضمادات' },
      { title_en: 'Breast Pads', title_ar: 'وسادات الرضاعة' },
      { title_en: 'Adult Diapers', title_ar: 'حفاضات للكبار' },
      { title_en: 'Face Masks', title_ar: 'أقنعة حماية الوجه' },
      { title_en: 'Deodorant', title_ar: 'مزيل عرق' },
      { title_en: 'Shaving and Hair Removal Products', title_ar: 'مستحضرات الحلاقة وإزالة الشعر' },
      { title_en: 'Hand and Foot Care', title_ar: 'العناية باليدين والقدمين' },
      { title_en: 'Creams and Body Care', title_ar: 'الكريم والعناية بالجسم' },
      { title_en: 'Hair Products', title_ar: 'منتجات الشعر' },
      { title_en: 'Sun Protection', title_ar: 'الحماية من أشعة الشمس' },
      { title_en: 'Diapers', title_ar: 'حفاضات' },
      { title_en: 'Wet Wipes', title_ar: 'مناديل مبللة' },
      { title_en: 'Baby Care', title_ar: 'العناية بالطفل' },
      { title_en: 'Baby Shampoo and Wash', title_ar: 'شامبو وغسول الأطفال' },
      { title_en: 'Formula Milk', title_ar: 'الحليب الصناعي' },
      { title_en: 'Baby Cereal', title_ar: 'حبوب الأطفال' },
      { title_en: 'Pureed Food', title_ar: 'المهروسة' },
      { title_en: 'Baby Snacks', title_ar: 'وجبات خفيفة للأطفال' },
      { title_en: 'Baby Accessories', title_ar: 'ملحقات الأطفال' },
    ],
  },
  {
    key: 'health-specialized-diets',
    title_en: 'Health & Specialized Diets',
    title_ar: 'الصحة والأنظمة الغذائية المتخصصة',
    subCategories: [
      { title_en: 'Milk Alternatives', title_ar: 'بدائل الحليب' },
      { title_en: 'Yogurt Alternative', title_ar: 'بديل الزبادي' },
      { title_en: 'Cheese Alternatives', title_ar: 'بدائل الجبن' },
      { title_en: 'Meat and Chicken Alternatives', title_ar: 'بدائل اللحوم والدجاج' },
      { title_en: 'Soy and Plant-based Products', title_ar: 'منتجات صويا ونباتية' },
      { title_en: 'Bread and Pastries (Gluten-Free)', title_ar: 'الخبز والمعجنات' },
      { title_en: 'Cooking and Baking Ingredients (Gluten-Free)', title_ar: 'مكونات الطبخ والخبز' },
      { title_en: 'Gluten-Free Frozen Products', title_ar: 'منتجات مجمدة خالية من الغلوتين' },
      { title_en: 'Gluten-Free Snacks and Sweets', title_ar: 'وجبات خفيفة وحلويات خالية من الغلوتين' },
      { title_en: 'Gluten-Free Breakfast Cereals', title_ar: 'حبوب إفطار خالية من الغلوتين' },
      { title_en: 'Pastries and Biscuits (Sugar-Free)', title_ar: 'المعجنات والبسكويت' },
      { title_en: 'Breakfast Cereals and Granola (Sugar-Free)', title_ar: 'حبوب الإفطار والجرانولا' },
      { title_en: 'Sweets and Chocolates (Sugar-Free)', title_ar: 'حلوى وشوكولاتة' },
      { title_en: 'Cooking Essentials (Sugar-Free)', title_ar: 'مستلزمات الطبخ' },
      { title_en: 'Jams and Spreads (Sugar-Free)', title_ar: 'المربى وطعام الدهن' },
      { title_en: 'Dairy Products (Sugar-Free)', title_ar: 'منتجات الألبان' },
      { title_en: 'Drinks (Sugar-Free)', title_ar: 'مشروبات' },
      { title_en: 'Sweeteners', title_ar: 'المحليات' },
      { title_en: 'Ice Cream (Sugar-Free)', title_ar: 'آيس كريم' },
      { title_en: 'Minerals and Amino Acids', title_ar: 'المعادن والأحماض الأمينية' },
      { title_en: 'Medicinal Herbs', title_ar: 'الأعشاب الطبية' },
      { title_en: 'Essential Oils', title_ar: 'الزيوت العطرية' },
      { title_en: 'Sports Nutritional Supplements', title_ar: 'المكملات الغذائية للرياضيين' },
      { title_en: 'Lactose-Free', title_ar: 'خالي من اللاكتوز' },
      { title_en: 'Organic', title_ar: 'عضوي' },
      { title_en: 'Sports Nutrition', title_ar: 'غذاء الرياضيين' },
      { title_en: 'Vegan', title_ar: 'Vegan' },
    ],
  },
  {
    key: 'pets',
    title_en: 'Pet Products',
    title_ar: 'حيوانات اليفة',
    subCategories: [
      { title_en: 'Dog Food', title_ar: 'طعام كلاب' },
      { title_en: 'Cat Food', title_ar: 'طعام قطط' },
      { title_en: 'General Pet Food', title_ar: 'طعام حيوانات' },
      { title_en: 'Pet Supplies and Accessories', title_ar: 'لوازم واكسسورات الحيوانات' },
      { title_en: 'Cat Litter', title_ar: 'رمل للقطط' },
    ],
  },
]

/** Flatten hierarchical groups to flat list (for backward compatibility). */
export function getHierarchicalGrocerySections(businessType: string): MenuSectionGroup[] {
  if (businessType === 'grocery' || businessType === 'supermarket' || businessType === 'greengrocer') {
    return GROCERY_MENU_SECTION_GROUPS
  }
  return []
}

/** Retail / Shop: general retail sections. */
export const RETAIL_MENU_SECTIONS: MenuSection[] = [
  { title_en: 'New Arrivals', title_ar: 'وصل جديد' },
  { title_en: 'Best Sellers', title_ar: 'الأكثر مبيعاً' },
  { title_en: 'Seasonal', title_ar: 'موسمي' },
  { title_en: 'Accessories', title_ar: 'إكسسوارات' },
  { title_en: 'Gifts', title_ar: 'هدايا' },
  { title_en: 'Extras', title_ar: 'إضافات' },
]

/** Pharmacy: health & wellness sections. */
export const PHARMACY_MENU_SECTIONS: MenuSection[] = [
  { title_en: 'Medications', title_ar: 'أدوية' },
  { title_en: 'Vitamins & Supplements', title_ar: 'فيتامينات ومكملات' },
  { title_en: 'Personal Care', title_ar: 'العناية الشخصية' },
  { title_en: 'Baby Care', title_ar: 'العناية بالرضع' },
  { title_en: 'First Aid', title_ar: 'إسعافات أولية' },
  { title_en: 'Medical Devices', title_ar: 'أجهزة طبية' },
]

/** Map business type to its common menu sections. Fallback to restaurant for unknown types. */
export function getCommonMenuSections(businessType: string): MenuSection[] {
  switch (businessType) {
    case 'grocery':
    case 'supermarket':
    case 'greengrocer':
      return GROCERY_MENU_SECTIONS
    case 'retail':
      return RETAIL_MENU_SECTIONS
    case 'pharmacy':
      return PHARMACY_MENU_SECTIONS
    case 'restaurant':
    case 'cafe':
    case 'bakery':
    default:
      return RESTAURANT_MENU_SECTIONS
  }
}

/** @deprecated Use getCommonMenuSections(businessType) instead. Kept for backward compatibility. */
export const COMMON_MENU_SECTIONS = RESTAURANT_MENU_SECTIONS
