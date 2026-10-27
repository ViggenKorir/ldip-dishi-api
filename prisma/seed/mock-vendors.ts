export const CUISINES = [
  "Swahili",
  "Fast food",
  "Nyama choma",
  "Healthy",
] as const;
export type Cuisine = (typeof CUISINES)[number];

export const AMENITIES = [
  { id: "wifi", label: "Wi-Fi" },
  { id: "indoor", label: "Indoor seating" },
  { id: "takeaway", label: "Takeaway" },
] as const;
export type AmenityId = (typeof AMENITIES)[number]["id"];

export type Dish = {
  id: string;
  name: string;
  /** Price in KES */
  price: number;
  /** Shown under "Available right now" on Discover */
  featured?: boolean;
  description?: string;
  /** Menu section, e.g. "Mains". Dishes without one fall under "Mains". */
  category?: string;
  /** Shown under "Popular today" on the vendor page */
  popular?: boolean;
  /** The kitchen has marked it unavailable for now */
  soldOut?: boolean;
};

export const DEFAULT_CATEGORY = "Mains";

export type Vendor = {
  id: string;
  name: string;
  area: string;
  openNow: boolean;
  cuisines: Cuisine[];
  amenities: AmenityId[];
  dishes: Dish[];
  /** Cheapest and dearest item available for pickup, in KES */
  priceRange: [number, number];
  /** Display time of the earliest pickup slot */
  pickupAt: string;
  /** Minutes from now until that slot - drives the pickup filter and sort */
  pickupInMin: number;
  /** Where the pin sits on the area map, as a percentage of its width/height */
  pin: { x: number; y: number };
  /** Optional profile details for the vendor page; the page has fallbacks */
  description?: string;
  /** Opening hours today, e.g. "8:00 AM to 2:00 PM" */
  hours?: string;
  address?: string;
  pickupInstructions?: string;
  /** Extra labels beside the cuisines, e.g. "Home cooking" */
  tags?: string[];
};

/** Mock data until the vendors API exists - replace with an RTK Query hook. */
export const VENDORS: Vendor[] = [
  {
    id: "mama-njeris-kitchen",
    name: "Mama Njeri's Kitchen",
    area: "Westlands, Mpaka Rd",
    openNow: true,
    cuisines: ["Swahili"],
    amenities: ["indoor", "takeaway"],
    description:
      "Home-style Swahili cooking for the Westlands lunch crowd. Pilau, stews and chapati made fresh every morning.",
    hours: "8:00 AM to 2:00 PM",
    address: "Mpaka Rd, next to the Mpaka Plaza gate, Westlands",
    pickupInstructions: "Collect at the side window. Show your order number.",
    tags: ["Home cooking"],
    dishes: [
      {
        id: "mnk-stew",
        name: "Ugali & beef stew",
        price: 320,
        popular: true,
        category: "Mains",
        description:
          "Soft ugali with slow-cooked beef in a tomato and onion stew.",
      },
      {
        id: "mnk-chapati",
        name: "Chapati & beans",
        price: 180,
        featured: true,
        popular: true,
        category: "Mains",
        description: "Two layered chapatis with coconut beans.",
      },
      {
        id: "mnk-githeri",
        name: "Githeri special",
        price: 320,
        category: "Mains",
        description: "Maize and beans fried with carrots and fresh coriander.",
      },
      {
        id: "mnk-matoke",
        name: "Matoke & beef",
        price: 300,
        category: "Mains",
        description: "Mashed green bananas with beef in a light gravy.",
      },
      {
        id: "mnk-mukimo",
        name: "Mukimo & stew",
        price: 280,
        category: "Mains",
        description: "Potato, greens and maize mash with a bowl of beef stew.",
      },
      {
        id: "mnk-pilau",
        name: "Pilau & kachumbari",
        price: 250,
        popular: true,
        category: "Rice & pilau",
        description: "Spiced beef pilau with fresh kachumbari.",
      },
      {
        id: "mnk-chicken-pilau",
        name: "Chicken pilau",
        price: 350,
        category: "Rice & pilau",
        soldOut: true,
        description: "Spiced rice with chicken pieces and kachumbari.",
      },
      {
        id: "mnk-greengrams",
        name: "Rice & green grams",
        price: 240,
        category: "Rice & pilau",
        description: "White rice with ndengu in coconut stew.",
      },
      {
        id: "mnk-kachumbari",
        name: "Kachumbari",
        price: 60,
        category: "Sides",
        description: "Tomato, onion and coriander.",
      },
      {
        id: "mnk-sukuma",
        name: "Sukuma wiki",
        price: 80,
        category: "Sides",
        description: "Sauteed kale with onions.",
      },
      {
        id: "mnk-extra-chapati",
        name: "Extra chapati",
        price: 40,
        category: "Sides",
        description: "One soft layered chapati.",
      },
      {
        id: "mnk-ugali",
        name: "Plain ugali",
        price: 50,
        category: "Sides",
        description: "A portion of fresh ugali.",
      },
      {
        id: "mnk-tea",
        name: "Masala tea",
        price: 60,
        popular: true,
        category: "Drinks",
        description: "Spiced milk tea, served hot.",
      },
      {
        id: "mnk-juice",
        name: "Fresh passion juice",
        price: 120,
        category: "Drinks",
        description: "Pressed to order, no added sugar.",
      },
      {
        id: "mnk-soda",
        name: "Soda",
        price: 80,
        category: "Drinks",
        description: "A cold 300 ml bottle.",
      },
      {
        id: "mnk-water",
        name: "Bottled water",
        price: 50,
        category: "Drinks",
        description: "500 ml still water.",
      },
    ],
    priceRange: [180, 320],
    pickupAt: "12:40 PM",
    pickupInMin: 15,
    pin: { x: 66, y: 22 },
  },
  {
    id: "kibanda-corner",
    name: "Kibanda Corner",
    area: "Westlands, Rhapta Rd",
    openNow: true,
    cuisines: ["Swahili", "Nyama choma"],
    amenities: ["takeaway"],
    dishes: [
      {
        id: "kc-pilau",
        name: "Pilau & nyama choma",
        price: 380,
        featured: true,
      },
      { id: "kc-ugali", name: "Ugali & fry", price: 200 },
    ],
    priceRange: [200, 380],
    pickupAt: "12:45 PM",
    pickupInMin: 20,
    pin: { x: 22, y: 58 },
  },
  {
    id: "green-bowl-co",
    name: "Green Bowl Co.",
    area: "Westlands, Woodvale Grove",
    openNow: true,
    cuisines: ["Healthy"],
    amenities: ["wifi", "indoor", "takeaway"],
    dishes: [
      {
        id: "gb-quinoa",
        name: "Quinoa veggie bowl",
        price: 520,
        featured: true,
      },
      { id: "gb-salad", name: "Green garden salad", price: 350 },
      { id: "gb-chicken", name: "Grilled chicken bowl", price: 650 },
    ],
    priceRange: [350, 650],
    pickupAt: "12:50 PM",
    pickupInMin: 25,
    pin: { x: 40, y: 38 },
  },
  {
    id: "choma-hub",
    name: "Choma Hub",
    area: "Westlands, Ring Rd",
    openNow: true,
    cuisines: ["Nyama choma"],
    amenities: ["indoor", "takeaway"],
    dishes: [
      { id: "ch-pilau", name: "Beef pilau", price: 400 },
      { id: "ch-platter", name: "Nyama choma platter", price: 550 },
    ],
    priceRange: [400, 550],
    pickupAt: "12:55 PM",
    pickupInMin: 30,
    pin: { x: 27, y: 74 },
  },
  {
    id: "the-daily-plate",
    name: "The Daily Plate",
    area: "Westlands, Muthithi Rd",
    openNow: true,
    cuisines: ["Healthy", "Swahili"],
    amenities: ["wifi", "indoor"],
    dishes: [
      { id: "dp-pilau", name: "Pilau of the day", price: 250 },
      { id: "dp-githeri", name: "Githeri bowl", price: 260 },
    ],
    priceRange: [250, 260],
    pickupAt: "1:00 PM",
    pickupInMin: 35,
    pin: { x: 52, y: 12 },
  },
  {
    id: "pilau-point",
    name: "Pilau Point",
    area: "Westlands, Mpaka Rd",
    openNow: true,
    cuisines: ["Swahili"],
    amenities: ["takeaway"],
    dishes: [
      { id: "pp-beef", name: "Beef pilau", price: 300, featured: true },
      { id: "pp-chicken", name: "Chicken pilau", price: 350 },
      { id: "pp-chapati", name: "Chapati & chai", price: 200 },
    ],
    priceRange: [200, 350],
    pickupAt: "1:05 PM",
    pickupInMin: 40,
    pin: { x: 80, y: 50 },
  },
  {
    id: "burger-yard",
    name: "Burger Yard",
    area: "Westlands, Rhapta Rd",
    openNow: true,
    cuisines: ["Fast food"],
    amenities: ["takeaway"],
    dishes: [
      { id: "by-burger", name: "Chicken burger", price: 420, featured: true },
      { id: "by-fries", name: "Loaded fries", price: 250 },
    ],
    priceRange: [250, 480],
    pickupAt: "1:10 PM",
    pickupInMin: 45,
    pin: { x: 72, y: 72 },
  },
  {
    id: "chapo-express",
    name: "Chapo Express",
    area: "Westlands, Mpaka Rd",
    openNow: true,
    cuisines: ["Fast food"],
    amenities: ["takeaway"],
    dishes: [
      { id: "ce-roll", name: "Chapati rolls", price: 200 },
      { id: "ce-egg", name: "Egg chapo", price: 150 },
    ],
    priceRange: [150, 250],
    pickupAt: "1:15 PM",
    pickupInMin: 50,
    pin: { x: 15, y: 30 },
  },
];

export type DishWithVendor = { dish: Dish; vendor: Vendor };

/** Every dish paired with the vendor selling it. */
export const allDishes = (vendors: Vendor[] = VENDORS): DishWithVendor[] =>
  vendors.flatMap((vendor) => vendor.dishes.map((dish) => ({ dish, vendor })));

export const getVendor = (id: string) => VENDORS.find((v) => v.id === id);

/** Find a dish and its vendor from the dish id alone (ids are unique across vendors). */
export const getDish = (id: string): DishWithVendor | undefined =>
  allDishes().find(({ dish }) => dish.id === id);
