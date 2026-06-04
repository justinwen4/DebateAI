"use client";

import Link from "next/link";
import { LogoWithLabel } from "@/app/components/Logo";
import ThemeToggle from "@/app/components/ThemeToggle";
import RotatingQACard, { type SampleQA } from "@/app/components/RotatingQACard";
import TrainingFeedback from "@/app/components/TrainingFeedback";

const samplePairs: SampleQA[] = [
  {
    question: "I'm going for topicality. How do I answer plan text in a vacuum?",
    answer:
      "Plan text in a vacuum creates a moral hazard: it allows any aff to be topical just by including the topic in the plan text. That justifies reading affs from previous topics, destroying debate, and forces every 2NR to be split between T and substance just to hold the aff to a stable advocacy. That sets the threshold for a negative win too high.",
  },
  {
    question: "Why are PICs good?",
    answer:
      "PICs are good for three reasons. First, logic and clash: PICs show a part of the plan is flawed and should be excluded. Arbitrarily excluding legitimate neg offense is unpredictable and a slippery slope to excluding all counterplans. Second, neg flex: the aff chooses the plan and gets first and last speech advantage. That's also terminal defense because we can only negate what the aff chooses to defend. Third, real world education: PICs mirror real-world policymaking, where bills are often amended, fostering better clash and understanding which is the only portable impact.",
  },
  {
    question: "I'm debating against a kritik. How do I respond to \"fiat is illusory\"?",
    answer:
      "Fiat being illusory is irrelevant to it's utility. The neg's argument proves too much — obviously the government won't pass the plan because two debaters discussed it, but that's not the point. Fiat grounds a stable stasis so both teams can rigorously clash over a defined advocacy instead of devolving into political feasibility contests. That enables us to explore transformative actions and downstream consequences, shaping how debaters think about policy. Finally, mooting: the aff should get to weigh the plan's impacts not because fiat makes them real, but because the resolutional question is the only predictable stasis, so denying us the ability to weigh that as offense is unfair.",
  },
];

const valueProps = [
  {
    label: "Founder Logic",
    heading: "Circuit Experience",
    body: "Built by debaters with deep TOC-level experience.",
  },
  {
    label: "Coverage",
    heading: "Conceptual Grasp",
    body: "DebateAI is best used for analytical discussions - including Philosophy, Kritiks, and Theory.",
  },
];

const testimonials = [
  {
    quote: "I've never engaged with an AI that actually knows what a K is.",
    attribution: "LD DEBATER, TOC QUALIFIER",
  },
  {
    quote:
      "I've always been confused by theory. DebateAI has significantly improved my understanding.",
    attribution: "LD DEBATER, TFA QUALIFIER",
  },
  {
    quote:
      "It catches nuance that even my teammates miss entirely.",
    attribution: "LD DEBATER, NSDA QUALIFIER",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-full bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border-subtle bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <LogoWithLabel />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/founder"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground sm:inline-block"
            >
              Founder
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background transition-colors hover:opacity-90"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-14 md:grid-cols-[1.05fr_1fr] md:items-center md:py-20">
        <div className="space-y-7">
          <p className="inline-flex items-center rounded-full border border-border bg-surface px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-accent">
            Trained on circuit-level rounds
          </p>

          <h1 className="max-w-2xl font-[family-name:var(--font-display)] text-5xl leading-[0.95] tracking-tight text-foreground sm:text-6xl">
            DebateAI{" "}
            <em className="font-[family-name:var(--font-display)] italic text-accent">thinks</em> like a debater.
          </h1>

          <p className="max-w-xl text-[1.1rem] leading-relaxed text-foreground/80">
            DebateAI is fluent in Lincoln-Douglas debate, trained on data from top circuit debaters.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-xl bg-foreground px-6 py-3 text-base font-semibold text-background transition-opacity hover:opacity-90"
            >
              Start practicing free &rarr;
            </Link>
          </div>
        </div>

        <div id="how-it-thinks">
          <p className="mb-2 text-sm text-muted">&darr; Sample responses from the AI</p>
          <RotatingQACard items={samplePairs} />
        </div>
      </section>

      <section className="border-y border-border-subtle bg-surface/60">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-16 md:grid-cols-[1.1fr_1fr] md:items-center">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Improvement Loop</p>
            <h2 className="max-w-2xl font-[family-name:var(--font-display)] text-4xl leading-tight tracking-tight text-foreground sm:text-[3.2rem]">
              Rate responses so the AI improves for future answers.
            </h2>
          </div>
          <div>
            <p className="text-lg leading-relaxed text-foreground/80">
              Every response can be rated with quick feedback. Those ratings shape what DebateAI prioritizes next, so
              the model steadily improves for you and future debaters.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-muted">
              <span className="flex items-center gap-1.5">☆ Rate</span>
              <span>→</span>
              <span className="flex items-center gap-1.5">↻ Model updates</span>
              <span>→</span>
              <span className="flex items-center gap-1.5">✓ Better answers</span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border-subtle bg-surface/40">
        <div className="mx-auto max-w-6xl px-6 py-16 text-center">
          <p className="text-lg text-foreground/80">
            Trusted by champions and runner-ups of the{" "}
            <strong className="text-foreground">TOC</strong>,{" "}
            <strong className="text-foreground">Harvard</strong>,{" "}
            <strong className="text-foreground">Emory</strong>,{" "}
            <strong className="text-foreground">Greenhill</strong>,{" "}
            <strong className="text-foreground">Glenbrooks</strong>,{" "}
            <strong className="text-foreground">UT</strong>,{" "}
            <strong className="text-foreground">Yale</strong>, and more.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <article
                key={t.attribution}
                className="rounded-xl border border-border bg-surface p-6 text-left shadow-[var(--shadow-sm)]"
              >
                <p className="font-[family-name:var(--font-display)] text-lg italic leading-relaxed text-foreground">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                  &mdash; {t.attribution}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border-subtle bg-background">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-6 px-6 py-12 sm:flex-row sm:items-center">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Built by Top Debaters</p>
            <h2 className="font-[family-name:var(--font-display)] text-3xl leading-tight tracking-tight text-foreground sm:text-4xl">
              Justin Wen
            </h2>
            <p className="max-w-xl text-lg leading-relaxed text-foreground/80">
              TOC finalist, 2x TFA champion, and the creator behind DebateAI.
            </p>
          </div>
          <Link
            href="/founder"
            className="shrink-0 rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-foreground shadow-[var(--shadow-sm)] transition-colors hover:border-accent/40 hover:bg-surface-hover"
          >
            Meet the founder &rarr;
          </Link>
        </div>
      </section>

      <TrainingFeedback />

      <section className="bg-[#1a2332] text-white">
        <div className="mx-auto grid w-full max-w-6xl gap-14 px-6 py-16 md:grid-cols-2 md:gap-10">
          {valueProps.map((section) => (
            <article key={section.heading} className="space-y-3 border-l-2 border-accent pl-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">{section.label}</p>
              <h3 className="font-[family-name:var(--font-display)] text-5xl leading-[0.95] tracking-tight text-white">
                {section.heading}
              </h3>
              <p className="max-w-md text-[1.1rem] leading-relaxed text-white/70 sm:text-[1.25rem]">{section.body}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="bg-[#0f1722] text-white/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-8 px-6 py-10 sm:flex-row sm:items-center">
          <div>
            <LogoWithLabel labelClassName="font-semibold text-white" />
            <p className="mt-2 text-sm">Lincoln-Douglas AI, built by the circuit.</p>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/" className="transition-colors hover:text-white">
              Home
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-white">
              Privacy
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg border border-white/20 px-4 py-2 text-sm transition-colors hover:border-white/40 hover:text-white"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg border border-white/20 px-4 py-2 text-sm transition-colors hover:border-white/40 hover:text-white"
            >
              Sign up
            </Link>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-6 pb-6 text-right text-xs text-white/40">&copy; 2026 DebateAI</div>
      </footer>
    </main>
  );
}
