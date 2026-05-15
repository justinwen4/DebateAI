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

---

### BATCH 19 — Disad structure and mechanics (Theory, 20 rows)

```
**For this batch, generate rows covering how disadvantages work. Category: "Theory". Topics:**

- What a disad is and how its components fit together
- Uniqueness — what it means and why it matters
- How to answer non-unique
- Link — what a link is and what makes it strong vs. weak
- How to answer a link (link turn, no link, no link uniqueness)
- Brink — what it is and how to use it
- Impact — magnitude, probability, timeframe in the DA context
- Linear vs. threshold disads — the difference and how to argue each
- Politics DA — how it works and common answers
- Turns case — why the DA turns the aff's internal links
- Impact turn — what it is and why it's risky
- Double turn — why it's a concession
- Timeframe framing on DAs — why short-term impacts can outweigh
- How to answer a DA in the 1AR
- 2NR strategy on a DA
```

---

### BATCH 20 — Non-cognitivism and metaethics (Philosophy, 20 rows)

```
**For this batch, generate rows covering non-cognitivism and adjacent metaethics. Category: "Philosophy". Topics:**

- What non-cognitivism is and how it differs from cognitivism
- Emotivism — what it claims and why it's contested
- Prescriptivism — Hare's view and its problems
- Expressivism — what it adds over simple emotivism
- The Frege-Geach problem — why it's a serious objection to non-cognitivism
- How to answer the Frege-Geach problem
- Why non-cognitivism undermines moral debate
- Why non-cognitivism can be turned — if moral claims aren't truth-apt, framework debates collapse
- Error theory vs. non-cognitivism — the key difference
- Why moral realism is preferable to non-cognitivism
- Quasi-realism — what Blackburn claims and whether it succeeds
- Non-cognitivism and moral progress — can non-cognitivists account for it
- How to deploy non-cognitivism as a neg argument against phil frameworks
- How to answer non-cognitivism as the aff
- Non-cognitivism's relationship to relativism
```

---

### BATCH 21 — Ableism K (Kritik, 20 rows)

```
**For this batch, generate rows covering the ableism kritik. Category: "Kritik". Topics:**

- What the ableism K claims and how it functions in a round
- The medical model vs. the social model of disability — why the K prefers the social model
- How policy debate reproduces ableist assumptions
- The link to policy affs — how solvency and impact framing assumes able-bodied norms
- Crip theory — what it contributes beyond the social model
- The alt — what rejecting ableist frameworks looks like in practice
- How to answer "the aff helps disabled people"
- How to answer "we need policy solutions for disability"
- Framework against the ableism K — why the judge should evaluate policy impacts
- Perm: do the aff and the alt — how neg answers it
- Why the ableism K is not identity politics but structural critique
- Intersectionality — how ableism interacts with race, gender, class
- Productivity as ableist — how economic frameworks exclude disabled people
- The link to extinction impacts — why ableism K outweighs
- How to extend the ableism K in the 2NR
- How to answer the ableism K in the 1AR
```
