import { apiFetch } from "@/app/lib/api";

export interface GenerateStreamDone {
  type: "done";
  model_tier: "premium" | "standard";
  monthly_usage: number;
  premium_monthly_limit: number;
  notice: string | null;
}

export interface GenerateStreamChunk {
  type: "chunk";
  text: string;
}

export interface GenerateStreamError {
  type: "error";
  detail: string;
  status?: number;
}

export type GenerateStreamEvent = GenerateStreamChunk | GenerateStreamDone | GenerateStreamError;

interface GenerateStreamRequest {
  prompt: string;
  history: Array<{ role: string; content: string }>;
}

function parseSseBlock(block: string): GenerateStreamEvent | null {
  const dataLine = block
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("data:"));
  if (!dataLine) return null;

  const payload = dataLine.slice(5).trim();
  if (!payload) return null;

  return JSON.parse(payload) as GenerateStreamEvent;
}

export async function* streamGenerate(body: GenerateStreamRequest): AsyncGenerator<GenerateStreamEvent> {
  const res = await apiFetch("/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = `API error ${res.status}`;
    try {
      const errorBody = (await res.json()) as { detail?: string };
      if (errorBody.detail) detail = errorBody.detail;
    } catch {
      // Ignore non-JSON error bodies.
    }
    yield { type: "error", detail, status: res.status };
    return;
  }

  if (!res.body) {
    yield { type: "error", detail: "Empty response body", status: 500 };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      try {
        const event = parseSseBlock(block);
        if (event) yield event;
      } catch {
        yield { type: "error", detail: "Failed to parse stream", status: 500 };
        return;
      }
    }
  }

  if (buffer.trim()) {
    try {
      const event = parseSseBlock(buffer);
      if (event) yield event;
    } catch {
      yield { type: "error", detail: "Failed to parse stream", status: 500 };
    }
  }
}
