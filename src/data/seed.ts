import type { Item, Tag, WizardStep } from '../types'
import { rawSeedItems } from './seed-items'

/** Seed items that get used up and need restocking, rather than owned outright. */
export const CONSUMABLE_IDS = new Set([
  'toothpaste',
  'toilet-paper',
  'paper-towels',
  'propane',
  'coffee-filters',
  'trash-bags',
  'newspaper',
  'kindling-firewood',
  'maya-dust',
  'ziplocs',
  'batteries',
  'sunscreen',
  'earplugs',
  'bug-spray',
  'lighters-matches',
  'tissues',
  'baby-wipes',
  'hand-soap',
  'shampoo-conditioner-bodywash',
  'neosporin-medications-allergy',
  'sponges',
  'feminine-products',
  'gaff-tape',
])

/**
 * Items that stay on Base when camping gear moves to Camp Basics: anything
 * toiletries-tagged, plus these genuinely-universal ids.
 */
const UNIVERSAL_BASE_IDS = new Set(['sunscreen', 'neosporin-medications-allergy'])

/** Items that must never ride on Base, whatever their other tags say. */
export const BASE_EXCLUDED_IDS = new Set(['collapseable-water-jug', 'power-bank-solar-panel'])

/** Move camping-specific gear off the auto-applied Base list onto Camp Basics. */
export function rehomeBaseTags(tags: string[], id: string): string[] {
  if (!tags.includes('always')) return tags
  if (BASE_EXCLUDED_IDS.has(id))
    return [...tags.filter(t => t !== 'always' && t !== 'camping'), 'camping']
  if (tags.includes('toiletries') || UNIVERSAL_BASE_IDS.has(id)) return tags
  return [...tags.filter(t => t !== 'always'), 'camping']
}

/** Clothing basics — the CSV had none; Base should cover clothes. */
export const CLOTHING_ITEMS: Item[] = [
  { id: 'underwear', name: 'Underwear', kind: 'gear', stock: null, tags: ['always'] },
  { id: 'socks', name: 'Socks', kind: 'gear', stock: null, tags: ['always'] },
  { id: 't-shirts', name: 'T-Shirts', kind: 'gear', stock: null, tags: ['always'] },
  { id: 'pants-shorts', name: 'Pants / Shorts', kind: 'gear', stock: null, tags: ['always'] },
  { id: 'warm-layer', name: 'Warm Layer', kind: 'gear', stock: null, tags: ['always'] },
  { id: 'sleepwear', name: 'Sleepwear', kind: 'gear', stock: null, tags: ['always'] },
  { id: 'phone-charger', name: 'Phone Charger', kind: 'gear', stock: null, tags: ['always'] },
]

/** Starter items for lists that shipped empty (seed v5). */
export const STARTER_LIST_ITEMS: Item[] = [
  { id: 'changes-of-clothes', name: 'Changes of Clothes (one per day)', kind: 'gear', stock: null, tags: ['always'] },
  { id: 'computer', name: 'Computer', kind: 'gear', stock: null, tags: ['lan'] },
  { id: 'mousepad', name: 'Mousepad', kind: 'gear', stock: null, tags: ['lan'] },
  { id: 'mouse', name: 'Mouse', kind: 'gear', stock: null, tags: ['lan'] },
  { id: 'laptop', name: 'Laptop', kind: 'gear', stock: null, tags: ['business'] },
  { id: 'laptop-charger', name: 'Laptop Charger', kind: 'gear', stock: null, tags: ['business', 'lan'] },
  { id: 'business-casual-outfits', name: 'Business Casual Outfits', kind: 'gear', stock: null, tags: ['business'] },
  { id: 'day-bag', name: 'Day Bag', kind: 'gear', stock: null, tags: ['hotel'] },
  { id: 'dopp-kit', name: 'Dopp Kit', kind: 'gear', stock: null, tags: ['hotel'] },
  { id: 'passport-id', name: 'Passport / ID', kind: 'gear', stock: null, tags: ['all-inclusive'] },
  { id: 'swimsuit', name: 'Swimsuit', kind: 'gear', stock: null, tags: ['all-inclusive', 'water'] },
  { id: 'sea-sickness-meds', name: 'Sea-Sickness Meds', kind: 'consumable', stock: null, tags: ['all-inclusive'] },
  { id: 'shared-snacks', name: 'Shared Snacks', kind: 'consumable', stock: null, tags: ['group'] },
  { id: 'serving-utensils', name: 'Serving Utensils', kind: 'gear', stock: null, tags: ['group', 'kitchen'] },
]

/** Menu-planning starters for the meal prep step (seed v6). */
export const MEAL_ITEMS: Item[] = [
  { id: 'pancake-breakfast', name: 'Pancake Breakfast', kind: 'meal', stock: null, tags: ['meals'] },
  { id: 'breakfast-burritos', name: 'Breakfast Burritos', kind: 'meal', stock: null, tags: ['meals'] },
  { id: 'chili-night', name: 'Chili Night', kind: 'meal', stock: null, tags: ['meals'] },
  { id: 'hot-dogs-burgers', name: 'Hot Dogs & Burgers', kind: 'meal', stock: null, tags: ['meals'] },
  { id: 'foil-packet-dinners', name: 'Foil Packet Dinners', kind: 'meal', stock: null, tags: ['meals', 'fire'] },
  { id: 'coffee-cocoa', name: 'Coffee & Cocoa', kind: 'meal', stock: null, tags: ['meals'] },
  { id: 'smores-kit', name: "S'mores Kit", kind: 'meal', stock: null, tags: ['snacks', 'fire'] },
  { id: 'sandwiches-wraps', name: 'Sandwiches & Wraps', kind: 'meal', stock: null, tags: ['snacks'] },
  { id: 'trail-snacks', name: 'Trail Snacks', kind: 'meal', stock: null, tags: ['snacks'] },
  { id: 'fruit-veggies', name: 'Fruit & Veggies', kind: 'meal', stock: null, tags: ['snacks'] },
]

export const seedItems: Item[] = [
  ...rawSeedItems.map(i => ({
    ...i,
    kind: (CONSUMABLE_IDS.has(i.id) ? 'consumable' : 'gear') as Item['kind'],
    tags: rehomeBaseTags(i.tags, i.id),
  })),
  ...CLOTHING_ITEMS,
  ...STARTER_LIST_ITEMS,
  ...MEAL_ITEMS,
]

export const seedTags: Tag[] = [
  { id: 'always', name: 'Base', icon: 'Star', auto: true, description: 'Clothes, toiletries, and basics — goes on every trip' },
  { id: 'camping', name: 'Camp Basics', icon: 'TreePine', description: 'Core camp gear for any campsite' },
  { id: 'toiletries', name: 'Toiletries', icon: 'Droplets', description: 'Hygiene and bathroom gear' },
  { id: 'festival', name: 'Festival', icon: 'PartyPopper', description: 'Festival camps — decor, shade, and crowd comforts' },
  { id: 'tent', name: 'Tent', icon: 'Tent', description: 'Sleeping in a tent' },
  { id: 'survival', name: 'Survival', icon: 'Compass', description: 'Off-grid essentials and safety gear' },
  { id: 'kitchen', name: 'Kitchen', icon: 'CookingPot', description: 'Camp cooking and food prep' },
  { id: 'living', name: 'Living', icon: 'Armchair', description: 'Camp comfort — chairs, tables, hangout gear' },
  { id: 'glamping', name: 'Glamping', icon: 'Sparkles', description: 'The fancy comforts' },
  { id: 'car', name: 'Car', icon: 'Car', description: 'Car-accessible camp gear and hauling' },
  { id: 'fire', name: 'Fire', icon: 'Flame', description: 'Campfire gear — only when fires are allowed' },
  { id: 'water', name: 'Water', icon: 'Waves', description: 'Lake or river gear — boats, boards, paddles' },
  { id: 'solo', name: 'Solo', icon: 'User', description: 'Traveling light, party of one' },
  { id: 'group', name: 'Group', icon: 'Users', description: 'Extra supplies for when the whole crew comes' },
  { id: 'lan', name: 'LAN', icon: 'Gamepad2', description: 'LAN party — rig, peripherals, cables, caffeine' },
  { id: 'business', name: 'Business', icon: 'Briefcase', description: 'Work travel — laptop, chargers, presentable clothes' },
  { id: 'hotel', name: 'Hotel', icon: 'Building2', description: 'Hotel stays — day bag, chargers, dopp kit' },
  { id: 'all-inclusive', name: 'All-Inclusive', icon: 'Ship', description: 'Cruises & resorts — documents, swimwear, sea-sickness meds' },
  { id: 'meals', name: 'Meals', icon: 'Utensils', description: 'Cooked meals and menu planning' },
  { id: 'snacks', name: 'Snacks', icon: 'Sandwich', description: 'No-cook food and easy eats' },
]

/** Bump when seed tags/cards are added so existing saves pick them up. */
export const SEED_VERSION = 6

export const wizardSteps: WizardStep[] = [
  {
    id: 'style',
    title: 'Trip style',
    prompt: 'What kind of trip is this?',
    multi: true,
    cards: [
      {
        id: 'car-camping',
        title: 'Car Camping',
        subtitle: 'Drive right up to the site — bring the comforts',
        icon: 'Car',
        tags: ['camping', 'toiletries', 'tent', 'car', 'kitchen', 'living'],
      },
      {
        id: 'hike-in',
        title: 'Hike-In',
        subtitle: 'Carry it on your back — pack light, pack smart',
        icon: 'Mountain',
        tags: ['camping', 'toiletries', 'tent', 'survival'],
      },
      {
        id: 'festival',
        title: 'Festival',
        subtitle: 'Music, decor, shade, and a good camp scene',
        icon: 'PartyPopper',
        tags: ['camping', 'toiletries', 'festival', 'living', 'car'],
      },
      {
        id: 'glamping',
        title: 'Glamping',
        subtitle: 'All the fancy comforts, none of the roughing it',
        icon: 'Sparkles',
        tags: ['camping', 'toiletries', 'glamping', 'kitchen', 'living'],
      },
      {
        id: 'lan-event',
        title: 'LAN Event',
        subtitle: 'Rig, peripherals, cables, and caffeine',
        icon: 'Gamepad2',
        tags: ['lan'],
      },
      {
        id: 'business-trip',
        title: 'Business Trip',
        subtitle: 'Work travel — pack light and presentable',
        icon: 'Briefcase',
        tags: ['business', 'toiletries'],
      },
      {
        id: 'weekend-getaway',
        title: 'Weekend Getaway',
        subtitle: 'Two nights, light bags, big reset',
        icon: 'Sun',
        tags: ['toiletries', 'hotel'],
      },
      {
        id: 'road-trip',
        title: 'Road Trip',
        subtitle: 'Miles of highway and good snacks',
        icon: 'MapPin',
        tags: ['car', 'snacks', 'toiletries'],
      },
      {
        id: 'cruise',
        title: 'Cruise',
        subtitle: 'Set sail — resort life on the water',
        icon: 'Ship',
        tags: ['toiletries'],
      },
    ],
  },
  {
    id: 'site',
    title: 'Accommodations & site',
    prompt: 'Where are you staying — and what does it offer?',
    multi: true,
    optional: true,
    cards: [
      {
        id: 'fire-ok',
        title: 'Fires Allowed',
        subtitle: 'Firewood, kindling, and marshmallow sticks',
        icon: 'Flame',
        tags: ['fire'],
      },
      {
        id: 'water-access',
        title: 'Water Nearby',
        subtitle: 'Lake or river — bring the boats and boards',
        icon: 'Waves',
        tags: ['water'],
      },
      {
        id: 'off-grid',
        title: 'Off-Grid',
        subtitle: 'No facilities — bring survival and safety gear',
        icon: 'Compass',
        tags: ['survival'],
      },
      {
        id: 'full-kitchen',
        title: 'Cooking Camp',
        subtitle: 'Full camp kitchen — stove, cooler, the works',
        icon: 'CookingPot',
        tags: ['kitchen'],
      },
      {
        id: 'hotel-room',
        title: 'Hotel Room',
        subtitle: 'A real bed and a shower — pack for the room, not the site',
        icon: 'Building2',
        tags: ['hotel'],
      },
      {
        id: 'all-inclusive',
        title: 'All-Inclusive',
        subtitle: 'Cruise ship or resort — they handle the rest',
        icon: 'Ship',
        tags: ['all-inclusive'],
      },
    ],
  },
  {
    id: 'meals',
    title: 'Meal prep',
    prompt: "What's cooking?",
    multi: true,
    optional: true,
    requiresTag: 'kitchen',
    cards: [
      {
        id: 'cooked-meals',
        title: 'Camp Cooking',
        subtitle: 'Real meals on the stove or fire',
        icon: 'CookingPot',
        tags: ['meals'],
      },
      {
        id: 'easy-eats',
        title: 'Snacks & Easy Eats',
        subtitle: 'No-cook food for the cooler',
        icon: 'Sandwich',
        tags: ['snacks'],
      },
    ],
  },
  {
    id: 'crew',
    title: 'Crew',
    prompt: "Who's going?",
    multi: false,
    cards: [
      {
        id: 'solo',
        title: 'Going Solo',
        subtitle: 'Just you — travel light',
        icon: 'User',
        tags: ['solo'],
      },
      {
        id: 'group',
        title: 'With the Crew',
        subtitle: 'Friends, family, the whole camp',
        icon: 'Users',
        tags: ['group'],
      },
    ],
  },
]
