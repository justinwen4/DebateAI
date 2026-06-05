const MAX_PROVISIONAL_LENGTH = 42;
export const MAX_CONVERSATION_TITLE_LENGTH = 120;
export const DEFAULT_CONVERSATION_TITLE = "New conversation";

export function provisionalConversationTitle(content: string): string {
  const trimmed = content.trim().replace(/\s+/g, " ");
  if (!trimmed) return DEFAULT_CONVERSATION_TITLE;
  if (trimmed.length <= MAX_PROVISIONAL_LENGTH) return trimmed;

  const truncated = trimmed.slice(0, MAX_PROVISIONAL_LENGTH);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > 20) {
    return `${truncated.slice(0, lastSpace)}…`;
  }
  return `${truncated}…`;
}

export function normalizeConversationTitle(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return DEFAULT_CONVERSATION_TITLE;
  if (trimmed.length <= MAX_CONVERSATION_TITLE_LENGTH) return trimmed;
  return trimmed.slice(0, MAX_CONVERSATION_TITLE_LENGTH);
}
