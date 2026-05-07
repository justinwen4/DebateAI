---

## BASE PROMPT (copy this every time)

```
You are helping me build a training dataset for a debate tutoring AI. I need you to generate **at least 20 rows** of JSONL and write them to `ml/review_batch.jsonl` (create this file fresh each time — it's a staging file for me to review before merging into the real dataset).

**Do NOT write to or modify `ml/dataset.tutor.jsonl` — that's the production file. Only write to `ml/review_batch.jsonl`.**

**Each row must be a single JSON object on one line with these exact keys:**
- `"input"`: A student's debate question, prefixed with a situational tag in brackets like `[General · topic]` or `[Neg · topic · 2NR]` or `[Aff · topic · 1AR]`. The tag format is `[Side · lane · optional speech]` using middle dot `·` separators.
- `"output"`: A clear, **answer-first** tutor-style response. The first sentence MUST directly answer the question. Use debate shorthand naturally (K, 1AR, 2NR, condo, perm, framework, link, alt). Tight prose, 3-5 sentences (50-90 words), up to ~120 words only if multiple subpoints carry distinct warrants. No filler ("it is important to note," "ultimately," "this highlights"). Do NOT define basic debate terms. Do NOT open with a label like "Logic." or "Reverse causality." — fold it into a real sentence.
- `"category"`: Must be exactly one of: `"Theory"`, `"Philosophy"`, or `"Kritik"`
- `"mode"`: Always `"normal"`

**Here are examples of good tutor-style output (match this register exactly):**

{"input": "[General · util] Why does utilitarianism fail as a moral framework?", "output": "Utilitarianism fails for three core reasons. First, demandingness: it requires sacrificing everything for the greater good, which makes morality psychologically unlivable. Second, the repugnant conclusion: maximizing total happiness justifies a massive population of barely happy people over a small, flourishing one. Third, the utility monster problem: one person with extreme capacity for pleasure could justify enslaving everyone else, proving util has no principled constraint on distribution.", "category": "Philosophy", "mode": "normal"}
{"input": "[Neg · reps K] Why can't the AFF weigh case against the K?", "output": "The aff can't weigh case against the K because the K is procedural, similar to condo or disclosure. Theoretical practices, like those addressed in the K, are resolved before substantive impacts like extinction.", "category": "Kritik", "mode": "normal"}
{"input": "[General · Kritik] Why doesn't winning ethical consequences mean winning ethical representations?", "output": "Winning ethical consequences doesn't mean winning ethical representations because of reverse causality. Ethical consequences focus on outcomes, while ethical representations are about the underlying justifications and motivations. For example, both antisemites and pro-Palestinians may oppose Israel, but their reasons differ significantly. This distinction shows that similar consequences can arise from vastly different ethical representations.", "category": "Kritik", "mode": "normal"}

**STRICT RULES:**
1. Do NOT invent specific author evidence or card names you're unsure about
2. Every claim must have a MECHANISM or warrant, not just a label
3. Cover both "why X is correct" AND "why X fails" where possible for breadth
4. The first sentence of every output MUST directly answer the student's question
5. Output ONLY valid JSONL — no markdown, no explanation, no commentary before or after
6. Write ONLY to `ml/review_batch.jsonl` — do NOT touch `ml/dataset.tutor.jsonl`
```
