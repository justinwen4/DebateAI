import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONVERSATION_TITLE,
  MAX_CONVERSATION_TITLE_LENGTH,
  normalizeConversationTitle,
  provisionalConversationTitle,
} from "./conversationTitle";

describe("provisionalConversationTitle", () => {
  it("returns default for empty input", () => {
    expect(provisionalConversationTitle("   ")).toBe(DEFAULT_CONVERSATION_TITLE);
  });

  it("returns short text unchanged", () => {
    expect(provisionalConversationTitle("Fairness vs education")).toBe("Fairness vs education");
  });

  it("truncates long text with ellipsis at a word boundary", () => {
    const long =
      "Why does fairness outweigh education when the affirmative reads a plan that shifts ground?";
    const title = provisionalConversationTitle(long);
    expect(title.endsWith("…")).toBe(true);
    expect(title.length).toBeLessThanOrEqual(43);
  });
});

describe("normalizeConversationTitle", () => {
  it("returns default for empty input", () => {
    expect(normalizeConversationTitle("")).toBe(DEFAULT_CONVERSATION_TITLE);
  });

  it("trims and collapses whitespace", () => {
    expect(normalizeConversationTitle("  Fairness   debate  ")).toBe("Fairness debate");
  });

  it("clamps to max length", () => {
    const long = "x".repeat(MAX_CONVERSATION_TITLE_LENGTH + 20);
    expect(normalizeConversationTitle(long)).toHaveLength(MAX_CONVERSATION_TITLE_LENGTH);
  });
});
