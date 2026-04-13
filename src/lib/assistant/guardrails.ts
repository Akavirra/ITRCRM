const CRM_KEYWORDS = [
  'учн',
  'груп',
  'занят',
  'урок',
  'відвіду',
  'вiдвiду',
  'пропуск',
  'оплат',
  'борг',
  'борж',
  'курс',
  'викладач',
  'вчител',
  'crm',
  'статист',
  'розклад',
  'помічник crm',
  'помiчник crm',
];

const OFF_TOPIC_KEYWORDS = [
  'погод',
  'дощ',
  'сонц',
  'температур',
  'курс долар',
  'долар',
  'євро',
  'євро',
  'новин',
  'новост',
  'футбол',
  'матч',
  'спорт',
  'анекдот',
  'жарт',
  'рецепт',
  'музик',
  'фільм',
  'фильм',
  'серіал',
  'сері',
  'хто такий',
  'who is',
  'weather',
  'news',
];

function normalizeText(text: string) {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function getAssistantGuardrailReply(text: string): string | null {
  const normalized = normalizeText(text);

  if (!normalized) {
    return null;
  }

  const hasCrmKeyword = CRM_KEYWORDS.some((keyword) => normalized.includes(keyword));
  const hasOffTopicKeyword = OFF_TOPIC_KEYWORDS.some((keyword) =>
    normalized.includes(keyword),
  );

  if (hasCrmKeyword || !hasOffTopicKeyword) {
    return null;
  }

  return [
    'Я працюю тільки з даними цієї CRM-системи й не відповідаю на загальні питання на кшталт погоди, новин чи курсів валют.',
    'Можу допомогти з учнями, групами, заняттями, оплатами, боргами, відвідуваністю та короткою статистикою.',
    'Наприклад: "Які заняття сьогодні?", "Хто боржники цього місяця?" або "Покажи загальну статистику CRM".',
  ].join('\n');
}
