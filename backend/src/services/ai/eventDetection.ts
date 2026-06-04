import { EventType } from '@prisma/client';

interface EventDetectionResult {
  eventType: EventType | null;
  keywords: string[];
  confidence: number;
  subCategory?: string;
}

// Extended keyword map for richer detection
const EVENT_KEYWORDS: Record<EventType, string[]> = {
  BIRTHDAY: [
    'happy birthday', 'birthday vibes', 'its my birthday', "it's my birthday",
    'bday', 'birthday celebration', 'birthday bash', 'birthday girl', 'birthday boy',
    'celebrating my birthday', 'another year older', 'turning', 'born today',
    'जन्मदिन', 'birthday', 'my bday', 'bday bash', 'birthday month',
    '🎂', '🥳', '🎁', '🎈', 'cake cutting',
  ],
  ANNIVERSARY: [
    'anniversary', 'happy anniversary', 'years together', 'year anniversary',
    'wedding anniversary', 'work anniversary', 'years married', 'saal poora',
    'shaadi ki salgira', 'शादी की सालगिरह', 'सालगिरह',
    '💑', '💍', 'togetherness', 'years of us',
  ],
  ACHIEVEMENT: [
    'finally promoted', 'got promoted', 'new job', 'new role', 'joined',
    'graduated', 'passed', 'cleared', 'selected', 'achieved', 'milestone',
    'accomplished', 'proud moment', 'dream come true', 'nailed it',
    'offer letter', 'placed', 'admission', 'topper', 'promotion', 'increment',
    'hike', 'appraisal', 'cracked', 'selected for', 'results out',
    '🏆', '🥇', '🎓', '📜', 'congratulations to me',
  ],
  FESTIVAL: [
    'happy diwali', 'diwali', 'happy eid', 'eid mubarak', 'happy holi', 'holi',
    'happy christmas', 'merry christmas', 'happy new year', 'happy navratri',
    'ganesh chaturthi', 'durga puja', 'happy pongal', 'ugadi', 'onam',
    'baisakhi', 'lohri', 'happy raksha bandhan', 'happy karwa chauth',
    'festival', 'muharram', 'guru nanak', 'christmas', 'new year eve',
    '✨🪔', '🎊', '🪔', '☪️', '🎄',
  ],
  SAD_EMOTION: [
    'rip', 'rest in peace', 'passed away', 'no more', 'gone forever',
    'feeling sad', 'so sad', 'broken', 'heartbroken', 'crying', 'tears',
    'depressed', 'miss you', 'lost my', 'grief', 'mourning', 'farewell',
    'goodbye', 'miss them', 'never forget', 'in loving memory',
    '😢', '😭', '💔', '🕊️', '🖤',
  ],
  POSITIVE: [
    'feeling blessed', 'grateful', 'thankful', 'good news', 'excited',
    'happy day', 'best day', 'loving life', 'amazing day', 'great news',
    'feeling great', 'on top of the world', 'vibes', 'blessed',
    '😊', '🙏', '🌟', '💫',
  ],
  OTHER: [],
};

// Extended patterns for new event categories (detected via sub-category logic)
const EXTENDED_EVENT_PATTERNS: Record<string, string[]> = {
  MARRIAGE: [
    'got married', 'wedding', 'tied the knot', 'just married', 'shaadi',
    'nikah', 'nuptials', 'happily married', 'wedding day', 'reception',
    'mehendi', 'sangeet', 'haldi', 'shadi',
    '👰', '🤵', '💒', '🥂', '💐',
  ],
  ENGAGEMENT: [
    'engaged', 'got engaged', 'said yes', 'he proposed', 'she said yes',
    'engagement ceremony', 'roka', 'sagai', 'ring ceremony',
    '💍', '💒',
  ],
  NEW_BUSINESS: [
    'new shop', 'grand opening', 'opening soon', 'shop opening',
    'business launch', 'launched', 'new venture', 'startup', 'new store',
    'opening ceremony', 'opening day', 'soft launch', 'new outlet',
    'inaugurated', 'inauguration', 'showroom opening',
    '🏪', '🚀', '🎉🏪',
  ],
  NEW_CAR: [
    'new car', 'car delivery', 'got my car', 'new vehicle', 'drove home',
    'booked a car', 'car arrived', 'first drive', 'new bike', 'new scooter',
    'two-wheeler', 'car purchase',
    '🚗', '🚙', '🏎️', '🛻', '🏍️',
  ],
  TRAVEL: [
    'vacation', 'travel', 'trip', 'holiday', 'flying', 'airport',
    'exploring', 'wanderlust', 'road trip', 'getaway', 'backpacking',
    'checked in', 'hotel', 'resort', 'beach day', 'mountain trip',
    '✈️', '🌴', '🏖️', '🏔️', '🗺️', '🧳',
  ],
  HOUSEWARMING: [
    'new home', 'moved in', 'new house', 'housewarming', 'griha pravesh',
    'flat keys', 'house keys', 'moving day', 'new flat', 'new apartment',
    '🏠', '🔑', '🏡', 'our new home',
  ],
  BABY: [
    'baby', 'newborn', 'it\'s a boy', 'it\'s a girl', 'baby shower',
    'expecting', 'pregnant', 'due soon', 'bundle of joy', 'new arrival',
    'god blessed us', 'baby born', 'neonatal', 'baby announcement',
    '👶', '🍼', '🤱',
  ],
  GRADUATION: [
    'graduated', 'convocation', 'degree', 'passing out', 'farewell',
    'batch of', 'class of', 'school done', 'college done', 'final year',
    '🎓', '📜', '🏛️',
  ],
  FITNESS: [
    'gym', 'workout', 'fitness', 'transformation', 'body goals', 'gains',
    'lost weight', 'fit journey', 'running', 'marathon', 'squat', 'deadlift',
    'pr', 'new pb', 'personal best', 'fit check', 'diet',
    '💪', '🏋️', '🏃', '🧘',
  ],
  FOOD: [
    'food', 'foodie', 'restaurant', 'trying out', 'taste test', 'eat out',
    'dinner', 'lunch', 'breakfast', 'brunch', 'food review', 'cafe',
    '🍕', '🍔', '🍜', '🍱', '🥘', '👨‍🍳',
  ],
  FASHION: [
    'shopping', 'haul', 'new dress', 'new outfit', 'ootd', 'fashion',
    'new clothes', 'wore', 'styling', 'fashion haul',
    '👗', '👠', '🛍️', '👜',
  ],
};

export const detectEvent = (statusText: string): EventDetectionResult => {
  const lowerText = statusText.toLowerCase();
  const detectedKeywords: string[] = [];
  let detectedEvent: EventType | null = null;
  let highestScore = 0;
  let subCategory: string | undefined;

  // Check primary EventType enum values
  const eventOrder: EventType[] = [
    'BIRTHDAY', 'ANNIVERSARY', 'ACHIEVEMENT', 'FESTIVAL', 'SAD_EMOTION', 'POSITIVE',
  ];

  for (const eventType of eventOrder) {
    const keywords = EVENT_KEYWORDS[eventType];
    const matchedKeywords: string[] = [];
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase()) || statusText.includes(keyword)) {
        matchedKeywords.push(keyword);
      }
    }
    if (matchedKeywords.length > 0) {
      const score = matchedKeywords.length;
      if (score > highestScore) {
        highestScore = score;
        detectedEvent = eventType;
        detectedKeywords.push(...matchedKeywords);
      }
    }
  }

  // Check extended categories — mapped to closest EventType
  const extendedToEvent: Record<string, EventType> = {
    MARRIAGE: 'ACHIEVEMENT',
    ENGAGEMENT: 'ACHIEVEMENT',
    NEW_BUSINESS: 'ACHIEVEMENT',
    NEW_CAR: 'ACHIEVEMENT',
    TRAVEL: 'POSITIVE',
    HOUSEWARMING: 'ACHIEVEMENT',
    BABY: 'POSITIVE',
    GRADUATION: 'ACHIEVEMENT',
    FITNESS: 'POSITIVE',
    FOOD: 'POSITIVE',
    FASHION: 'POSITIVE',
  };

  for (const [category, keywords] of Object.entries(EXTENDED_EVENT_PATTERNS)) {
    const matchedKeywords: string[] = [];
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase()) || statusText.includes(keyword)) {
        matchedKeywords.push(keyword);
      }
    }
    if (matchedKeywords.length > 0) {
      const score = matchedKeywords.length * 1.5; // boost extended categories
      if (score > highestScore) {
        highestScore = score;
        detectedEvent = extendedToEvent[category];
        subCategory = category;
        detectedKeywords.push(...matchedKeywords);
      }
    }
  }

  const confidence = detectedEvent ? Math.min(highestScore * 0.25, 1.0) : 0;

  return {
    eventType: detectedEvent,
    keywords: [...new Set(detectedKeywords)],
    confidence,
    subCategory,
  };
};

export const shouldGenerateReply = (eventType: EventType | null): boolean => {
  if (!eventType) return false;
  const replyWorthy: EventType[] = ['BIRTHDAY', 'ANNIVERSARY', 'ACHIEVEMENT', 'FESTIVAL', 'SAD_EMOTION', 'POSITIVE'];
  return replyWorthy.includes(eventType);
};
