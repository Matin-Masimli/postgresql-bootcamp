// Fixed reference data and vocabulary. Identical for the main and hidden datasets,
// so prompts can safely mention literals like 'Germany', 'Laptops' or 'Sales'.

export const REFERENCE_DATE = '2025-06-30';
export const DATA_START = '2021-01-01';
export const LOGIN_TRACKING_START = '2023-01-01';
export const COMPANY_DOMAIN = 'atlas-merc.example';

export interface Country {
  id: number;
  iso: string;
  name: string;
  region: string;
  currency: string;
  tz: string;
  /** Extra zones customers in this country may use (first = default). */
  zones: string[];
  /** Fixed standard offset in hours, used only to place generated activity in local daytime. */
  utcOffset: number;
  dial: string;
  cities: string[];
  /** Relative share of customers. 0 = no customers (orphan countries for outer-join questions). */
  weight: number;
}

export const COUNTRIES: Country[] = [
  { id: 1, iso: 'US', name: 'United States', region: 'North America', currency: 'USD', tz: 'America/New_York', zones: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'], utcOffset: -5, dial: '1', cities: ['New York', 'Chicago', 'Austin', 'Seattle', 'Denver', 'Los Angeles', 'Boston', 'Miami'], weight: 26 },
  { id: 2, iso: 'CA', name: 'Canada', region: 'North America', currency: 'CAD', tz: 'America/Toronto', zones: ['America/Toronto', 'America/Vancouver'], utcOffset: -5, dial: '1', cities: ['Toronto', 'Vancouver', 'Montreal', 'Calgary'], weight: 7 },
  { id: 3, iso: 'MX', name: 'Mexico', region: 'North America', currency: 'MXN', tz: 'America/Mexico_City', zones: ['America/Mexico_City'], utcOffset: -6, dial: '52', cities: ['Mexico City', 'Guadalajara', 'Monterrey'], weight: 3 },
  { id: 4, iso: 'BR', name: 'Brazil', region: 'South America', currency: 'BRL', tz: 'America/Sao_Paulo', zones: ['America/Sao_Paulo'], utcOffset: -3, dial: '55', cities: ['São Paulo', 'Rio de Janeiro', 'Curitiba'], weight: 4 },
  { id: 5, iso: 'AR', name: 'Argentina', region: 'South America', currency: 'ARS', tz: 'America/Argentina/Buenos_Aires', zones: ['America/Argentina/Buenos_Aires'], utcOffset: -3, dial: '54', cities: ['Buenos Aires', 'Córdoba'], weight: 1.5 },
  { id: 6, iso: 'CL', name: 'Chile', region: 'South America', currency: 'CLP', tz: 'America/Santiago', zones: ['America/Santiago'], utcOffset: -4, dial: '56', cities: ['Santiago', 'Valparaíso'], weight: 1 },
  { id: 7, iso: 'GB', name: 'United Kingdom', region: 'Europe', currency: 'GBP', tz: 'Europe/London', zones: ['Europe/London'], utcOffset: 0, dial: '44', cities: ['London', 'Manchester', 'Bristol', 'Edinburgh', 'Leeds'], weight: 10 },
  { id: 8, iso: 'IE', name: 'Ireland', region: 'Europe', currency: 'EUR', tz: 'Europe/Dublin', zones: ['Europe/Dublin'], utcOffset: 0, dial: '353', cities: ['Dublin', 'Cork'], weight: 1.5 },
  { id: 9, iso: 'DE', name: 'Germany', region: 'Europe', currency: 'EUR', tz: 'Europe/Berlin', zones: ['Europe/Berlin'], utcOffset: 1, dial: '49', cities: ['Berlin', 'Munich', 'Hamburg', 'Köln', 'Frankfurt'], weight: 9 },
  { id: 10, iso: 'FR', name: 'France', region: 'Europe', currency: 'EUR', tz: 'Europe/Paris', zones: ['Europe/Paris'], utcOffset: 1, dial: '33', cities: ['Paris', 'Lyon', 'Marseille', 'Toulouse'], weight: 6 },
  { id: 11, iso: 'ES', name: 'Spain', region: 'Europe', currency: 'EUR', tz: 'Europe/Madrid', zones: ['Europe/Madrid'], utcOffset: 1, dial: '34', cities: ['Madrid', 'Barcelona', 'Valencia', 'Sevilla'], weight: 4 },
  { id: 12, iso: 'IT', name: 'Italy', region: 'Europe', currency: 'EUR', tz: 'Europe/Rome', zones: ['Europe/Rome'], utcOffset: 1, dial: '39', cities: ['Rome', 'Milan', 'Naples', 'Turin'], weight: 4 },
  { id: 13, iso: 'NL', name: 'Netherlands', region: 'Europe', currency: 'EUR', tz: 'Europe/Amsterdam', zones: ['Europe/Amsterdam'], utcOffset: 1, dial: '31', cities: ['Amsterdam', 'Rotterdam', 'Utrecht'], weight: 3 },
  { id: 14, iso: 'BE', name: 'Belgium', region: 'Europe', currency: 'EUR', tz: 'Europe/Brussels', zones: ['Europe/Brussels'], utcOffset: 1, dial: '32', cities: ['Brussels', 'Antwerp', 'Ghent'], weight: 1.5 },
  { id: 15, iso: 'SE', name: 'Sweden', region: 'Europe', currency: 'SEK', tz: 'Europe/Stockholm', zones: ['Europe/Stockholm'], utcOffset: 1, dial: '46', cities: ['Stockholm', 'Göteborg', 'Malmö'], weight: 2 },
  { id: 16, iso: 'NO', name: 'Norway', region: 'Europe', currency: 'NOK', tz: 'Europe/Oslo', zones: ['Europe/Oslo'], utcOffset: 1, dial: '47', cities: ['Oslo', 'Bergen'], weight: 1.5 },
  { id: 17, iso: 'DK', name: 'Denmark', region: 'Europe', currency: 'DKK', tz: 'Europe/Copenhagen', zones: ['Europe/Copenhagen'], utcOffset: 1, dial: '45', cities: ['Copenhagen', 'Aarhus'], weight: 1.5 },
  { id: 18, iso: 'PL', name: 'Poland', region: 'Europe', currency: 'PLN', tz: 'Europe/Warsaw', zones: ['Europe/Warsaw'], utcOffset: 1, dial: '48', cities: ['Warsaw', 'Kraków', 'Gdańsk'], weight: 2.5 },
  { id: 19, iso: 'PT', name: 'Portugal', region: 'Europe', currency: 'EUR', tz: 'Europe/Lisbon', zones: ['Europe/Lisbon'], utcOffset: 0, dial: '351', cities: ['Lisbon', 'Porto'], weight: 1.5 },
  { id: 20, iso: 'CH', name: 'Switzerland', region: 'Europe', currency: 'CHF', tz: 'Europe/Zurich', zones: ['Europe/Zurich'], utcOffset: 1, dial: '41', cities: ['Zürich', 'Geneva', 'Basel'], weight: 1.5 },
  { id: 21, iso: 'IS', name: 'Iceland', region: 'Europe', currency: 'ISK', tz: 'Atlantic/Reykjavik', zones: ['Atlantic/Reykjavik'], utcOffset: 0, dial: '354', cities: ['Reykjavík'], weight: 0 },
  { id: 22, iso: 'LU', name: 'Luxembourg', region: 'Europe', currency: 'EUR', tz: 'Europe/Luxembourg', zones: ['Europe/Luxembourg'], utcOffset: 1, dial: '352', cities: ['Luxembourg'], weight: 0 },
  { id: 23, iso: 'TR', name: 'Türkiye', region: 'Middle East', currency: 'TRY', tz: 'Europe/Istanbul', zones: ['Europe/Istanbul'], utcOffset: 3, dial: '90', cities: ['Istanbul', 'Ankara', 'Izmir'], weight: 2 },
  { id: 24, iso: 'AE', name: 'United Arab Emirates', region: 'Middle East', currency: 'AED', tz: 'Asia/Dubai', zones: ['Asia/Dubai'], utcOffset: 4, dial: '971', cities: ['Dubai', 'Abu Dhabi'], weight: 1.5 },
  { id: 25, iso: 'AZ', name: 'Azerbaijan', region: 'Asia', currency: 'AZN', tz: 'Asia/Baku', zones: ['Asia/Baku'], utcOffset: 4, dial: '994', cities: ['Baku', 'Ganja'], weight: 1 },
  { id: 26, iso: 'IN', name: 'India', region: 'Asia', currency: 'INR', tz: 'Asia/Kolkata', zones: ['Asia/Kolkata'], utcOffset: 5.5, dial: '91', cities: ['Bengaluru', 'Mumbai', 'Delhi', 'Pune'], weight: 4 },
  { id: 27, iso: 'JP', name: 'Japan', region: 'Asia', currency: 'JPY', tz: 'Asia/Tokyo', zones: ['Asia/Tokyo'], utcOffset: 9, dial: '81', cities: ['Tokyo', 'Osaka', 'Kyoto'], weight: 3 },
  { id: 28, iso: 'KR', name: 'South Korea', region: 'Asia', currency: 'KRW', tz: 'Asia/Seoul', zones: ['Asia/Seoul'], utcOffset: 9, dial: '82', cities: ['Seoul', 'Busan'], weight: 1.5 },
  { id: 29, iso: 'SG', name: 'Singapore', region: 'Asia', currency: 'SGD', tz: 'Asia/Singapore', zones: ['Asia/Singapore'], utcOffset: 8, dial: '65', cities: ['Singapore'], weight: 1.5 },
  { id: 30, iso: 'AU', name: 'Australia', region: 'Oceania', currency: 'AUD', tz: 'Australia/Sydney', zones: ['Australia/Sydney', 'Australia/Perth'], utcOffset: 10, dial: '61', cities: ['Sydney', 'Melbourne', 'Brisbane', 'Perth'], weight: 4 },
  { id: 31, iso: 'NZ', name: 'New Zealand', region: 'Oceania', currency: 'NZD', tz: 'Pacific/Auckland', zones: ['Pacific/Auckland'], utcOffset: 12, dial: '64', cities: ['Auckland', 'Wellington'], weight: 1 },
  { id: 32, iso: 'ZA', name: 'South Africa', region: 'Africa', currency: 'ZAR', tz: 'Africa/Johannesburg', zones: ['Africa/Johannesburg'], utcOffset: 2, dial: '27', cities: ['Johannesburg', 'Cape Town', 'Durban'], weight: 1.5 },
  { id: 33, iso: 'NG', name: 'Nigeria', region: 'Africa', currency: 'NGN', tz: 'Africa/Lagos', zones: ['Africa/Lagos'], utcOffset: 1, dial: '234', cities: ['Lagos', 'Abuja'], weight: 1 },
  { id: 34, iso: 'KE', name: 'Kenya', region: 'Africa', currency: 'KES', tz: 'Africa/Nairobi', zones: ['Africa/Nairobi'], utcOffset: 3, dial: '254', cities: ['Nairobi'], weight: 0 },
];

/** UTC offsets for the extra zones (standard time) used to place activity in local daytime. */
export const ZONE_OFFSET: Record<string, number> = Object.fromEntries([
  ...COUNTRIES.map((c) => [c.tz, c.utcOffset] as const),
  ['America/Chicago', -6], ['America/Denver', -7], ['America/Los_Angeles', -8],
  ['America/Vancouver', -8], ['Australia/Perth', 8],
]);

// ───────────── Category tree ─────────────
export interface Category { id: number; parent: number | null; name: string; slug: string }

type Node = [name: string, slug: string, children?: Node[]];
const TREE: Node[] = [
  ['Electronics', 'electronics', [
    ['Computers', 'computers', [
      ['Laptops', 'laptops'],
      ['Desktops', 'desktops'],
      ['Computer Accessories', 'computer-accessories', [
        ['Keyboards', 'keyboards'], ['Mice', 'mice'], ['Monitors', 'monitors'],
      ]],
    ]],
    ['Phones & Tablets', 'phones-tablets', [
      ['Smartphones', 'smartphones'], ['Tablets', 'tablets'], ['Phone Accessories', 'phone-accessories'],
    ]],
    ['Audio', 'audio', [['Headphones', 'headphones'], ['Speakers', 'speakers']]],
    ['Cameras', 'cameras'],
    ['Drones', 'drones'],
  ]],
  ['Home & Kitchen', 'home-kitchen', [
    ['Kitchen', 'kitchen', [['Cookware', 'cookware'], ['Small Appliances', 'small-appliances'], ['Cutlery', 'cutlery']]],
    ['Furniture', 'furniture', [['Office Furniture', 'office-furniture'], ['Living Room', 'living-room']]],
    ['Home Decor', 'home-decor'],
  ]],
  ['Sports & Outdoors', 'sports-outdoors', [
    ['Fitness', 'fitness', [['Yoga', 'yoga'], ['Weights', 'weights']]],
    ['Camping & Hiking', 'camping-hiking', [['Tents', 'tents'], ['Backpacks', 'backpacks']]],
    ['Cycling', 'cycling'],
  ]],
  ['Books', 'books', [
    ['Fiction', 'fiction'],
    ['Non-fiction', 'non-fiction', [
      ['Programming', 'programming', [['Databases', 'databases'], ['Web Development', 'web-development']]],
      ['Business', 'business'],
      ['Science', 'science'],
    ]],
    ["Children's Books", 'childrens-books'],
  ]],
  ['Fashion', 'fashion', [
    ['Men', 'men', [['Shirts', 'men-shirts'], ['Shoes', 'men-shoes']]],
    ['Women', 'women', [['Dresses', 'women-dresses'], ['Shoes', 'women-shoes']]],
    ['Accessories', 'fashion-accessories', [['Watches', 'watches'], ['Bags', 'bags']]],
  ]],
];

export const CATEGORIES: Category[] = [];
(function flatten(nodes: Node[], parent: number | null) {
  for (const [name, slug, children] of nodes) {
    const id = CATEGORIES.length + 1;
    CATEGORIES.push({ id, parent, name, slug });
    if (children) flatten(children, id);
  }
})(TREE, null);

export const LEAF_CATEGORIES = CATEGORIES.filter((c) => !CATEGORIES.some((k) => k.parent === c.id));
/** Leaf categories deliberately left without products. */
export const EMPTY_LEAF_SLUGS = ['drones', 'home-decor'];

export function rootOf(categoryId: number): Category {
  let c = CATEGORIES[categoryId - 1];
  while (c.parent !== null) c = CATEGORIES[c.parent - 1];
  return c;
}

/** Per leaf: product nouns and a price band (list price points are drawn from PRICE_POINTS inside it). */
export const LEAF_PRODUCTS: Record<string, { nouns: string[]; min: number; max: number; weight: [number, number] }> = {
  laptops: { nouns: ['Ultrabook 13"', 'Laptop 14"', 'Laptop 15.6"', 'Gaming Laptop 16"', 'Chromebook 11"'], min: 399, max: 2499, weight: [1.1, 2.8] },
  desktops: { nouns: ['Mini PC', 'Tower Desktop', 'All-in-One 24"', 'Workstation'], min: 349, max: 2999, weight: [1.5, 12] },
  keyboards: { nouns: ['Mechanical Keyboard', 'Wireless Keyboard', 'Compact Keyboard', 'Ergonomic Keyboard'], min: 19, max: 199, weight: [0.4, 1.2] },
  mice: { nouns: ['Wireless Mouse', 'Gaming Mouse', 'Vertical Mouse', 'Travel Mouse'], min: 9, max: 129, weight: [0.06, 0.15] },
  monitors: { nouns: ['Monitor 24"', 'Monitor 27"', 'Curved Monitor 34"', '4K Monitor 32"'], min: 129, max: 999, weight: [3, 9] },
  smartphones: { nouns: ['Smartphone', 'Smartphone Pro', 'Smartphone Lite', 'Rugged Phone'], min: 149, max: 1299, weight: [0.15, 0.25] },
  tablets: { nouns: ['Tablet 10"', 'Tablet 12"', 'E-Reader', 'Kids Tablet'], min: 79, max: 999, weight: [0.2, 0.7] },
  'phone-accessories': { nouns: ['Phone Case', 'USB-C Charger', 'Power Bank', 'Screen Protector', 'Car Mount'], min: 5, max: 79, weight: [0.03, 0.4] },
  headphones: { nouns: ['Wireless Earbuds', 'Over-Ear Headphones', 'Noise-Cancelling Headphones', 'Sport Earbuds'], min: 19, max: 449, weight: [0.05, 0.4] },
  speakers: { nouns: ['Bluetooth Speaker', 'Smart Speaker', 'Soundbar', 'Bookshelf Speakers'], min: 29, max: 599, weight: [0.4, 6] },
  cameras: { nouns: ['Action Camera', 'Mirrorless Camera', 'Instant Camera', 'Webcam'], min: 39, max: 1899, weight: [0.15, 0.9] },
  cookware: { nouns: ['Frying Pan 28cm', 'Cast Iron Skillet', 'Stockpot 8L', 'Cookware Set'], min: 19, max: 349, weight: [0.8, 9] },
  'small-appliances': { nouns: ['Blender', 'Air Fryer', 'Espresso Machine', 'Electric Kettle', 'Toaster'], min: 24, max: 699, weight: [1, 8] },
  cutlery: { nouns: ["Chef's Knife", 'Knife Block Set', 'Steak Knives (6)', 'Bread Knife'], min: 14, max: 299, weight: [0.2, 3] },
  'office-furniture': { nouns: ['Office Chair', 'Standing Desk', 'Desk Lamp', 'Bookshelf'], min: 39, max: 899, weight: [2, 35] },
  'living-room': { nouns: ['Coffee Table', 'Floor Lamp', 'Armchair', 'TV Stand'], min: 49, max: 799, weight: [3, 30] },
  yoga: { nouns: ['Yoga Mat', 'Yoga Block', 'Yoga Strap', 'Meditation Cushion'], min: 9, max: 99, weight: [0.2, 2.5] },
  weights: { nouns: ['Dumbbell Pair 5kg', 'Kettlebell 12kg', 'Adjustable Dumbbells', 'Weight Bench'], min: 24, max: 499, weight: [5, 30] },
  tents: { nouns: ['2-Person Tent', '4-Person Tent', 'Ultralight Tent', 'Pop-up Shelter'], min: 59, max: 699, weight: [1, 6] },
  backpacks: { nouns: ['Hiking Backpack 30L', 'Trekking Backpack 50L', 'Daypack 20L', 'Hydration Pack'], min: 29, max: 299, weight: [0.5, 2] },
  cycling: { nouns: ['Bike Helmet', 'Bike Lights Set', 'Cycling Gloves', 'Bike Lock', 'Repair Kit'], min: 9, max: 199, weight: [0.1, 1.2] },
  fiction: { nouns: ['The Quiet Harbour', 'Glass Orchard', 'Northbound', 'The Last Lantern', 'Salt and Ember', 'A Map of Small Hours'], min: 8, max: 29, weight: [0.3, 0.8] },
  databases: { nouns: ['PostgreSQL in Practice', 'Query Tuning Field Guide', 'Designing Data Models', 'SQL Puzzles & Patterns'], min: 29, max: 69, weight: [0.5, 1.2] },
  'web-development': { nouns: ['Modern Web Apps', 'TypeScript Handbook', 'CSS Layout Cookbook', 'Building APIs'], min: 24, max: 59, weight: [0.4, 1.1] },
  business: { nouns: ['The Lean Ledger', 'Pricing Playbook', 'Negotiation Essentials', 'Remote Teams'], min: 14, max: 39, weight: [0.3, 0.7] },
  science: { nouns: ['A Brief Tour of Particles', 'The Living Ocean', 'Climate Basics', 'Numbers Everywhere'], min: 12, max: 45, weight: [0.3, 0.9] },
  'childrens-books': { nouns: ['Pip the Brave Snail', 'Moon Picnic', 'Count with Otter', 'The Busy Tractor'], min: 6, max: 19, weight: [0.1, 0.4] },
  'men-shirts': { nouns: ['Oxford Shirt', 'Linen Shirt', 'Flannel Shirt', 'Polo Shirt'], min: 19, max: 89, weight: [0.2, 0.4] },
  'men-shoes': { nouns: ['Leather Sneakers', 'Running Shoes', 'Chelsea Boots', 'Loafers'], min: 49, max: 249, weight: [0.8, 1.6] },
  'women-dresses': { nouns: ['Wrap Dress', 'Summer Dress', 'Midi Dress', 'Knit Dress'], min: 29, max: 199, weight: [0.2, 0.6] },
  'women-shoes': { nouns: ['Ballet Flats', 'Running Shoes', 'Ankle Boots', 'Sandals'], min: 39, max: 229, weight: [0.5, 1.4] },
  watches: { nouns: ['Analog Watch', 'Smartwatch', 'Dive Watch', 'Fitness Tracker'], min: 39, max: 899, weight: [0.05, 0.3] },
  bags: { nouns: ['Leather Tote', 'Laptop Bag', 'Crossbody Bag', 'Weekender Bag'], min: 29, max: 399, weight: [0.4, 1.5] },
};

export const BRANDS = [
  'Arcadia', 'Brightline', 'Corvid', 'Duneport', 'Everfield', 'Foxglove', 'Granite', 'Halcyon', 'Ironbark',
  'Juniper', 'Kestrel', 'Lumen', 'Meridian', 'Nimbus', 'Orchard', 'Pinecrest', 'Quarry', 'Redwood',
  'Solstice', 'Tidewater', 'Umbra', 'Vantage', 'Willow', 'Zephyr',
];
export const PUBLISHERS = ['Larkspur Press', 'Bluefin Books', 'Atlas House', 'Quill & Co.'];

/** Retail price endings: list prices snap to "x9.99"/"x4.99"/"x9.00" style points, so ties are common. */
export function snapPrice(raw: number): number {
  if (raw < 20) return Math.max(4.99, Math.round(raw) - 0.01);
  if (raw < 200) return Math.round(raw / 5) * 5 - 0.01;
  if (raw < 1000) return Math.round(raw / 50) * 50 - 0.01;
  return Math.round(raw / 100) * 100 - 1;
}

// ───────────── Departments & job titles ─────────────
export interface Department { id: number; name: string; location: string | null; budget: number | null }
export const DEPARTMENTS: Department[] = [
  { id: 1, name: 'Executive', location: 'London', budget: 2500000 },
  { id: 2, name: 'Sales', location: 'London', budget: 4200000 },
  { id: 3, name: 'Marketing', location: 'Amsterdam', budget: 3100000 },
  { id: 4, name: 'Customer Support', location: 'Lisbon', budget: 1800000 },
  { id: 5, name: 'Engineering', location: 'Berlin', budget: 6500000 },
  { id: 6, name: 'Finance', location: 'London', budget: 1500000 },
  { id: 7, name: 'Human Resources', location: null, budget: 900000 },
  { id: 8, name: 'Operations', location: 'Rotterdam', budget: 3800000 },
  { id: 9, name: 'Procurement', location: 'Rotterdam', budget: null },
  { id: 10, name: 'Legal', location: 'London', budget: 700000 },
];
/** Department with deliberately no employees. */
export const EMPTY_DEPARTMENT_ID = 10;

/** Org levels: 1 CEO, 2 VP, 3 Director, 4 Manager, 5 Staff. Salary bands are annual, in EUR. */
export const LEVELS = [
  { level: 1, band: [240000, 260000] },
  { level: 2, band: [150000, 190000] },
  { level: 3, band: [105000, 135000] },
  { level: 4, band: [72000, 98000] },
  { level: 5, band: [38000, 70000] },
] as const;

export const STAFF_TITLES: Record<string, string[]> = {
  Sales: ['Account Executive', 'Sales Representative', 'Inside Sales Representative'],
  Marketing: ['Marketing Specialist', 'Content Writer', 'SEO Analyst'],
  'Customer Support': ['Support Agent', 'Senior Support Agent'],
  Engineering: ['Software Engineer', 'Senior Software Engineer', 'Data Engineer', 'QA Engineer'],
  Finance: ['Accountant', 'Financial Analyst'],
  'Human Resources': ['HR Generalist', 'Recruiter'],
  Operations: ['Warehouse Coordinator', 'Logistics Analyst', 'Inventory Planner'],
  Procurement: ['Buyer', 'Supplier Manager'],
};

// ───────────── People ─────────────
export const FIRST_NAMES_F = [
  'Emma', 'Olivia', 'Sofia', 'Mia', 'Amelia', 'Hannah', 'Lea', 'Chloé', 'Zoë', 'Isabella', 'Ava', 'Lucía',
  'Martina', 'Giulia', 'Freya', 'Ingrid', 'Aisha', 'Fatima', 'Priya', 'Ananya', 'Yuki', 'Hana', 'Ji-woo',
  'Mei', 'Ngozi', 'Amara', 'Leyla', 'Aysel', 'Nora', 'Maja', 'Zuzanna', 'Inês', 'Ella', 'Grace', 'Chloe',
  'Sarah', 'Laura', 'Anna', 'Maria', 'Elena',
];
export const FIRST_NAMES_M = [
  'Liam', 'Noah', 'Oliver', 'James', 'Lucas', 'Mateo', 'Leon', 'Louis', 'Hugo', 'Luca', 'Marco', 'José',
  'Diego', 'Santiago', 'Lars', 'Søren', 'Mikkel', 'Łukasz', 'Jakub', 'João', 'Omar', 'Ahmed', 'Arjun',
  'Rohan', 'Kenji', 'Haruto', 'Min-jun', 'Wei', 'Chidi', 'Tunde', 'Murad', 'Elvin', 'Emre', 'Daniel',
  'David', 'Michael', 'Thomas', 'Ethan', 'Samuel', 'François',
];
export const LAST_NAMES = [
  'Smith', 'Johnson', 'Brown', 'Garcia', 'Martínez', 'Rodríguez', 'Müller', 'Schmidt', 'Schneider', 'Fischer',
  'Dubois', 'Lefèvre', 'Rossi', 'Bianchi', 'Romano', 'Jansen', 'de Vries', 'Peeters', 'Andersson', 'Nilsen',
  'Ødegaard', 'Jensen', 'Kowalski', 'Nowak', 'Silva', 'Santos', 'Ferreira', "O'Brien", 'Murphy', 'Kelly',
  'Yılmaz', 'Kaya', 'Aliyev', 'Mammadov', 'Sharma', 'Patel', 'Singh', 'Tanaka', 'Sato', 'Kim', 'Park',
  'Tan', 'Lim', 'Okafor', 'Adeyemi', 'Nkosi', 'Wilson', 'Taylor', 'Thompson', 'Clarke', 'Novak',
  'Van der Berg', 'MacDonald', 'Nuñez', 'Hernández', 'López', 'Wong', 'Chen', 'Haddad', 'Khan',
];
export const EMAIL_DOMAINS = [
  ['gmail.com', 30], ['outlook.com', 14], ['yahoo.com', 10], ['proton.me', 5], ['icloud.com', 8],
  ['mail.example', 6], ['web.de', 3], ['hotmail.com', 6],
] as const;

// ───────────── Orders vocabulary ─────────────
export const CARRIERS = ['DHL', 'UPS', 'FedEx', 'USPS', 'Royal Mail', 'PostNL', 'DPD'];
export const COUPONS = [
  ['WELCOME10', 6], ['welcome10', 2], [' WELCOME10', 1], ['SPRING15', 3], ['SUMMER20', 3], ['summer20 ', 1],
  ['BLACKFRIDAY', 4], ['BlackFriday', 1], ['FREESHIP', 3], ['free-ship', 1], ['VIP25', 1],
] as const;

export const RETURN_REASONS = [
  ['Damaged on arrival', 10], ['damaged', 4], ['DAMAGED - box was crushed', 1], ['Wrong size', 8],
  ['wrong size, too small', 3], ['Wrong item sent', 5], ['wrong item', 2], ['Changed my mind', 7],
  ['changed mind', 2], ['Defective', 5], ['Stopped working after 2 days', 2], ['Not as described', 4],
  ['Arrived too late', 2], ['Better price elsewhere', 2], ['  Wrong colour  ', 1],
] as const;

export const REVIEW_TITLES: Record<number, string[]> = {
  5: ['Excellent!', 'Love it', 'Perfect', 'Best purchase this year', 'Highly recommend', 'Five stars', 'AMAZING quality'],
  4: ['Very good', 'Great value', 'Pretty good', 'Solid product', 'Happy with it'],
  3: ['OK', 'Average', 'Does the job', 'Mixed feelings', 'Not bad, not great'],
  2: ['Disappointed', 'Could be better', 'Meh', 'Not worth the price'],
  1: ['Terrible', 'Broke after a week', 'DO NOT BUY', 'Waste of money', 'Awful'],
};
export const REVIEW_BODY_PARTS: Record<number, string[]> = {
  5: ['Works exactly as described.', 'The build quality is excellent.', 'Shipping was fast and the packaging was great.', 'Battery life is fantastic.', 'I bought a second one for my partner.', 'Great value for money!', 'Would definitely buy again. 👍'],
  4: ['Good quality overall.', 'Shipping took a bit longer than expected.', 'Battery life is decent.', 'Does what it says.', 'Slightly smaller than I expected.', 'Good value for money.'],
  3: ['It is fine for the price.', 'Quality is average.', 'Shipping was slow.', 'The instructions were confusing.', 'Battery life could be better.', 'Colour differs from the photos.'],
  2: ['Quality feels cheap.', 'Shipping was very slow.', 'Stopped working properly after a month.', 'Customer support was not helpful.', 'Not as described.'],
  1: ['Arrived broken.', 'Complete waste of money.', 'Stopped working after two days!!', 'Customer support never replied.', 'Requested a refund.', 'The battery died immediately.'],
};
