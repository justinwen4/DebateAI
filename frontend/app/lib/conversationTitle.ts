const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "can",
  "do",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "please",
  "the",
  "to",
  "we",
  "what",
  "when",
  "where",
  "why",
  "you",
]);

function toTitleCase(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function buildConversationTitle(content: string) {
  const words = content
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !STOP_WORDS.has(word));

  const uniqueWords: string[] = [];
  for (const word of words) {
    if (!uniqueWords.includes(word)) uniqueWords.push(word);
    if (uniqueWords.length === 3) break;
  }

  if (uniqueWords.length === 0) return "Conversation";
  return uniqueWords.map(toTitleCase).join(" ");
}
