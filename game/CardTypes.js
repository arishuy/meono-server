// Card type constants and metadata for Exploding Kittens

export const CARD_TYPES = {
  EXPLODING_KITTEN: 'EXPLODING_KITTEN',
  DEFUSE: 'DEFUSE',
  ATTACK: 'ATTACK',
  SKIP: 'SKIP',
  SEE_THE_FUTURE: 'SEE_THE_FUTURE',
  SHUFFLE: 'SHUFFLE',
  FAVOR: 'FAVOR',
  NOPE: 'NOPE',
  // Cat cards (pairs)
  TACO_CAT: 'TACO_CAT',
  HAIRY_POTATO_CAT: 'HAIRY_POTATO_CAT',
  RAINBOW_RALPHING_CAT: 'RAINBOW_RALPHING_CAT',
  BEARD_CAT: 'BEARD_CAT',
  CATTERMELON: 'CATTERMELON',
};

export const CAT_CARD_TYPES = [
  CARD_TYPES.TACO_CAT,
  CARD_TYPES.HAIRY_POTATO_CAT,
  CARD_TYPES.RAINBOW_RALPHING_CAT,
  CARD_TYPES.BEARD_CAT,
  CARD_TYPES.CATTERMELON,
];

export const CARD_META = {
  [CARD_TYPES.EXPLODING_KITTEN]: {
    name: 'Exploding Kitten',
    emoji: '💣',
    description: 'You explode! Unless you have a Defuse card.',
    color: '#E74C3C',
    bgColor: '#2C0B0B',
  },
  [CARD_TYPES.DEFUSE]: {
    name: 'Defuse',
    emoji: '🛡️',
    description: 'Defuse an Exploding Kitten and secretly re-insert it into the deck.',
    color: '#2ECC71',
    bgColor: '#0B2C15',
  },
  [CARD_TYPES.ATTACK]: {
    name: 'Attack',
    emoji: '⚔️',
    description: 'End your turn without drawing. The next player takes 2 turns.',
    color: '#E67E22',
    bgColor: '#2C1A07',
  },
  [CARD_TYPES.SKIP]: {
    name: 'Skip',
    emoji: '⏭️',
    description: 'End your turn without drawing a card.',
    color: '#3498DB',
    bgColor: '#071E2C',
  },
  [CARD_TYPES.SEE_THE_FUTURE]: {
    name: 'See the Future',
    emoji: '🔮',
    description: 'Peek at the top 3 cards in the draw pile.',
    color: '#9B59B6',
    bgColor: '#1A0B2C',
  },
  [CARD_TYPES.SHUFFLE]: {
    name: 'Shuffle',
    emoji: '🔀',
    description: 'Shuffle the draw pile.',
    color: '#1ABC9C',
    bgColor: '#072C22',
  },
  [CARD_TYPES.FAVOR]: {
    name: 'Favor',
    emoji: '🙏',
    description: 'Force another player to give you a card of their choice.',
    color: '#F39C12',
    bgColor: '#2C1F03',
  },
  [CARD_TYPES.NOPE]: {
    name: 'Nope',
    emoji: '🚫',
    description: 'Cancel any action card just played. Can be stacked!',
    color: '#E74C3C',
    bgColor: '#2C0707',
  },
  [CARD_TYPES.TACO_CAT]: {
    name: 'Taco Cat',
    emoji: '🌮',
    description: 'Collect a pair to steal a random card from any player.',
    color: '#F1C40F',
    bgColor: '#2C2703',
  },
  [CARD_TYPES.HAIRY_POTATO_CAT]: {
    name: 'Hairy Potato Cat',
    emoji: '🥔',
    description: 'Collect a pair to steal a random card from any player.',
    color: '#D4A574',
    bgColor: '#2C1F0F',
  },
  [CARD_TYPES.RAINBOW_RALPHING_CAT]: {
    name: 'Rainbow Cat',
    emoji: '🌈',
    description: 'Collect a pair to steal a random card from any player.',
    color: '#E91E63',
    bgColor: '#2C071A',
  },
  [CARD_TYPES.BEARD_CAT]: {
    name: 'Beard Cat',
    emoji: '🧔',
    description: 'Collect a pair to steal a random card from any player.',
    color: '#8D6E63',
    bgColor: '#2C1A10',
  },
  [CARD_TYPES.CATTERMELON]: {
    name: 'Cattermelon',
    emoji: '🍉',
    description: 'Collect a pair to steal a random card from any player.',
    color: '#4CAF50',
    bgColor: '#0B2C10',
  },
};

// Card counts in the base deck (before dealing)
export const CARD_COUNTS = {
  [CARD_TYPES.DEFUSE]: 6,
  [CARD_TYPES.ATTACK]: 4,
  [CARD_TYPES.SKIP]: 4,
  [CARD_TYPES.SEE_THE_FUTURE]: 4,
  [CARD_TYPES.SHUFFLE]: 4,
  [CARD_TYPES.FAVOR]: 4,
  [CARD_TYPES.NOPE]: 5,
  [CARD_TYPES.TACO_CAT]: 4,
  [CARD_TYPES.HAIRY_POTATO_CAT]: 4,
  [CARD_TYPES.RAINBOW_RALPHING_CAT]: 4,
  [CARD_TYPES.BEARD_CAT]: 4,
  [CARD_TYPES.CATTERMELON]: 4,
};
