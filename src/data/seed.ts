import type { Tag, WizardStep } from '../types'
export { seedItems } from './seed-items'

export const seedTags: Tag[] = [
  { id: 'always', name: 'Always', icon: 'Star', description: 'The core kit — comes on every trip' },
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
]

export const wizardSteps: WizardStep[] = [
  {
    id: 'style',
    title: 'Trip style',
    prompt: 'What kind of trip is this?',
    multi: false,
    cards: [
      {
        id: 'car-camping',
        title: 'Car Camping',
        subtitle: 'Drive right up to the site — bring the comforts',
        icon: 'Car',
        tags: ['always', 'toiletries', 'tent', 'car', 'kitchen', 'living'],
      },
      {
        id: 'hike-in',
        title: 'Hike-In',
        subtitle: 'Carry it on your back — pack light, pack smart',
        icon: 'Mountain',
        tags: ['always', 'toiletries', 'tent', 'survival'],
      },
      {
        id: 'festival',
        title: 'Festival',
        subtitle: 'Music, decor, shade, and a good camp scene',
        icon: 'PartyPopper',
        tags: ['always', 'toiletries', 'festival', 'living', 'car'],
      },
      {
        id: 'glamping',
        title: 'Glamping',
        subtitle: 'All the fancy comforts, none of the roughing it',
        icon: 'Sparkles',
        tags: ['always', 'toiletries', 'glamping', 'kitchen', 'living'],
      },
    ],
  },
  {
    id: 'site',
    title: 'Site conditions',
    prompt: 'What does the site allow and offer?',
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
        tags: [],
      },
    ],
  },
]
