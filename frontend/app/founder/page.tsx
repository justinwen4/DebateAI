import Image from "next/image";
import Link from "next/link";
import { LogoWithLabel } from "@/app/components/Logo";

const founderStats = [
  { label: "TOC Finalist" },
  { label: "2× TFA Champion" },
  { label: "33 Bids" },
  { label: "12 Bid Tournaments Championed/Finalled" },
];

const contributors = [
  {
    name: "Miller Roberts",
    stats: ["Emory Finalist", "TOC Quarterfinalist", "Bid Leader"],
  },
  {
    name: "Aidan Etkin",
    stats: ["Coach of TOC Champion", "TOC Finalist", "TOC Semi-Finalist"],
  },
];

export default function FounderPage() {
  return (
    <main className="min-h-full bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border-subtle bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <LogoWithLabel />
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm font-medium text-muted transition-colors hover:text-foreground"
            >
              Home
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <section className="bg-[#1a2332] text-white">
        <div className="mx-auto w-full max-w-6xl space-y-16 px-6 py-16 md:space-y-20 md:py-20">
        <div className="grid w-full gap-12 md:grid-cols-[minmax(0,16rem)_1fr] md:items-start md:gap-14">
          <div className="mx-auto w-64 shrink-0 overflow-hidden rounded-2xl md:mx-0">
            <Image
              src="/justin-wen.jpg"
              alt="Justin Wen"
              width={256}
              height={256}
              className="h-64 w-64 object-cover object-[center_10%]"
              priority
            />
          </div>

          <div className="space-y-6">
            <div className="space-y-3 border-l-2 border-accent pl-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Founder</p>
              <h1 className="font-[family-name:var(--font-display)] text-4xl leading-[0.95] tracking-tight text-white sm:text-5xl">
                Justin Wen
              </h1>
              <div className="space-y-0.5 text-[1.05rem] leading-relaxed text-white/70 sm:text-[1.15rem]">
                <p>Strake Jesuit</p>
                <p>Duke University.</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {founderStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/90"
                >
                  {stat.label}
                </div>
              ))}
            </div>

            <p className="max-w-2xl text-[1.05rem] leading-relaxed text-white/80 sm:text-[1.15rem]">
              Justin Wen debated at Strake Jesuit in Lincoln-Douglas debate for four years. He finalled the
              Tournament of Champions, won the Texas Forensic Association tournament twice, accumulated 33 bids, and
              championed or finalled 12 bid tournaments.
            </p>

          </div>
        </div>

        <div className="border-t border-white/10 pt-16 md:pt-20">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Contributors</p>
          <div className="mt-10 grid gap-12 md:grid-cols-2 md:gap-14">
            {contributors.map((contributor) => (
              <article key={contributor.name} className="space-y-5">
                <div className="space-y-3 border-l-2 border-accent pl-6">
                  <h2 className="font-[family-name:var(--font-display)] text-3xl leading-tight tracking-tight text-white sm:text-4xl">
                    {contributor.name}
                  </h2>
                </div>
                <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium leading-relaxed text-white/90">
                  {contributor.stats.join(" · ")}
                </p>
              </article>
            ))}
          </div>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm font-medium text-accent transition-colors hover:text-white"
        >
          ← Back to DebateAI
        </Link>
        </div>
      </section>
    </main>
  );
}
