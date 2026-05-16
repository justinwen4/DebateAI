import Link from "next/link";
import ThemeToggle from "@/app/components/ThemeToggle";

export default function LandingPage() {
  return (
    <main className="min-h-full bg-background text-foreground">
      <header className="border-b border-border-subtle bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-foreground text-[12px] font-semibold text-background">
              D
            </div>
            <span className="text-[15px] font-semibold tracking-tight">DebateAI</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/login"
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-14 md:grid-cols-[1.2fr_1fr] md:py-20">
        <div className="space-y-6">
          <p className="inline-flex items-center rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
            Your AI tutor for debate
          </p>
          <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Learn debate terminology and sharpen your thinking.
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted">
            Ask questions, explore arguments, and build a deeper understanding of dense debate concepts.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
            >
              Create account
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
            >
              Continue to chat
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-md)]">
          <h2 className="text-base font-semibold text-foreground">What you can do with DebateAI</h2>
          <ul className="mt-5 space-y-4 text-sm text-muted">
            <li className="rounded-xl border border-border-subtle bg-background px-4 py-3">
              Ask about debate concepts, theory, and strategy.
            </li>
            <li className="rounded-xl border border-border-subtle bg-background px-4 py-3">
              Explore counterarguments to stress-test positions.
            </li>
            <li className="rounded-xl border border-border-subtle bg-background px-4 py-3">
              Keep your conversations organized in a clean interface.
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}
