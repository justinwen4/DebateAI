import { apiFetch } from "@/app/lib/api";

export async function persistMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
) {
  const trimmed = content.trim();
  if (!trimmed) return;

  const res = await apiFetch(`/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, content: trimmed }),
  });

  if (!res.ok) {
    throw new Error(`Failed to save message (${res.status})`);
  }
}
