import { afterEach, describe, expect, it, vi } from "vitest";
import { streamGenerate } from "./streamGenerate";

vi.mock("@/app/lib/api", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "@/app/lib/api";

function sseResponse(body: string, init: ResponseInit = {}) {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" }, ...init });
}

async function collectEvents(body: Parameters<typeof streamGenerate>[0]) {
  const events = [];
  for await (const event of streamGenerate(body)) {
    events.push(event);
  }
  return events;
}

describe("streamGenerate", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("parses chunk and done events from SSE blocks", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      sseResponse(
        'data: {"type":"chunk","text":"Hello"}\n\n' +
          'data: {"type":"chunk","text":" world"}\n\n' +
          'data: {"type":"done","model_tier":"premium","monthly_usage":1,"premium_monthly_limit":30,"notice":null}\n\n',
      ),
    );

    const events = await collectEvents({ prompt: "test", history: [] });

    expect(events).toEqual([
      { type: "chunk", text: "Hello" },
      { type: "chunk", text: " world" },
      {
        type: "done",
        model_tier: "premium",
        monthly_usage: 1,
        premium_monthly_limit: 30,
        notice: null,
      },
    ]);
  });

  it("yields error event for non-ok responses", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ detail: "Rate limit exceeded. Try again later." }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const events = await collectEvents({ prompt: "test", history: [] });

    expect(events).toEqual([
      {
        type: "error",
        detail: "Rate limit exceeded. Try again later.",
        status: 429,
      },
    ]);
  });

  it("yields error when response body is empty", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 200 }));

    const events = await collectEvents({ prompt: "test", history: [] });

    expect(events).toEqual([{ type: "error", detail: "Empty response body", status: 500 }]);
  });

  it("yields error on malformed JSON in SSE block", async () => {
    vi.mocked(apiFetch).mockResolvedValue(sseResponse("data: {not-json}\n\n"));

    const events = await collectEvents({ prompt: "test", history: [] });

    expect(events).toEqual([{ type: "error", detail: "Failed to parse stream", status: 500 }]);
  });
});
