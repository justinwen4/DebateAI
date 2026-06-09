import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Message } from "@/app/components/MessageList";
import { useSendMessage } from "./useSendMessage";

const { persistMessage, streamGenerate, reveal } = vi.hoisted(() => {
  const persistMessage = vi.fn();
  const streamGenerate = vi.fn();
  const reveal = {
    push: vi.fn(),
    flush: vi.fn(),
    cancel: vi.fn(),
    getTarget: vi.fn(() => "Accumulated reply"),
  };
  return { persistMessage, streamGenerate, reveal };
});

vi.mock("@/app/lib/persistMessage", () => ({ persistMessage }));
vi.mock("@/app/lib/streamGenerate", () => ({ streamGenerate }));
vi.mock("@/app/lib/smoothStreamReveal", () => ({
  createSmoothStreamReveal: () => reveal,
}));
vi.mock("@/app/lib/supabase", () => ({
  supabase: {
    from: () => ({
      update: () => ({
        eq: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      }),
    }),
  },
}));

function makeParams(overrides: Partial<Parameters<typeof useSendMessage>[0]> = {}) {
  const setMessages = vi.fn<(update: Message[] | ((prev: Message[]) => Message[])) => void>();
  const setUsageBanner = vi.fn();

  return {
    user: { id: "user-1", email: "test@example.com" } as never,
    messages: [] as Message[],
    setMessages,
    setInput: vi.fn(),
    activeConversationId: "conv-1",
    createConversation: vi.fn().mockResolvedValue("conv-new"),
    updateConversationTitle: vi.fn(),
    touchConversation: vi.fn().mockResolvedValue(undefined),
    generateConversationTitle: vi.fn().mockResolvedValue(undefined),
    setStreamingMessageId: vi.fn(),
    scheduleScroll: vi.fn(),
    setUsageBanner,
    ...overrides,
  };
}

describe("useSendMessage", () => {
  afterEach(() => {
    vi.clearAllMocks();
    reveal.getTarget.mockReturnValue("Accumulated reply");
  });

  it("persists partial reply when stream ends without done event", async () => {
    async function* generator() {
      yield { type: "chunk" as const, text: "Partial" };
    }
    streamGenerate.mockReturnValue(generator());

    const params = makeParams();
    const { result } = renderHook(() => useSendMessage(params));

    await act(async () => {
      await result.current.sendMessage("Why fairness?");
    });

    await waitFor(() => {
      expect(persistMessage).toHaveBeenCalledWith("conv-1", "assistant", "Accumulated reply");
    });
    expect(params.generateConversationTitle).toHaveBeenCalledWith(
      "conv-1",
      "Why fairness?",
      "Accumulated reply",
    );
  });

  it("surfaces daily limit message on 429 stream error", async () => {
    async function* generator() {
      yield {
        type: "error" as const,
        detail: "Rate limit exceeded. Try again later.",
        status: 429,
      };
    }
    streamGenerate.mockReturnValue(generator());

    const setMessages = vi.fn<(update: Message[] | ((prev: Message[]) => Message[])) => void>();
    const params = makeParams({ setMessages });
    const { result } = renderHook(() => useSendMessage(params));

    await act(async () => {
      await result.current.sendMessage("Another prompt");
    });

    await waitFor(() => {
      expect(setMessages).toHaveBeenCalled();
    });
    const setMessagesMock = setMessages;
    const lastCall = setMessagesMock.mock.calls.at(-1)?.[0];
    const nextMessages = typeof lastCall === "function" ? lastCall([]) : lastCall;
    const assistant = (nextMessages as Message[]).find((m) => m.role === "assistant");
    expect(assistant?.content).toBe("Daily limit reached. Try again tomorrow.");
  });

  it("sets usage banner on standard tier done event", async () => {
    async function* generator() {
      yield { type: "chunk" as const, text: "Reply" };
      yield {
        type: "done" as const,
        model_tier: "standard" as const,
        monthly_usage: 31,
        premium_monthly_limit: 30,
        notice: "Downgraded to Haiku.",
      };
    }
    streamGenerate.mockReturnValue(generator());
    reveal.getTarget.mockReturnValue("Reply");

    const params = makeParams();
    const { result } = renderHook(() => useSendMessage(params));

    await act(async () => {
      await result.current.sendMessage("Test prompt");
    });

    await waitFor(() => {
      expect(params.setUsageBanner).toHaveBeenCalledWith({
        tier: "standard",
        monthlyUsage: 31,
        premiumLimit: 30,
        message: "Downgraded to Haiku.",
      });
    });
  });
});
