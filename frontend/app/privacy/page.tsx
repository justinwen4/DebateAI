import Link from "next/link";
import { LogoWithLabel } from "@/app/components/Logo";

export default function PrivacyPage() {
  return (
    <main className="min-h-full bg-background px-6 py-16">
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <Link href="/" className="text-sm text-muted transition-colors hover:text-foreground">
            ← Back to home
          </Link>
          <h1 className="mt-6 font-[family-name:var(--font-display)] text-4xl tracking-tight text-foreground">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-muted">Last updated: May 2026</p>
        </div>

        <section className="space-y-3 text-sm leading-relaxed text-foreground/85">
          <h2 className="text-base font-semibold text-foreground">What we collect</h2>
          <p>
            When you create an account, we store your email and authentication credentials through Supabase.
            When you use the chat, we store your conversation messages so you can return to them later.
          </p>
          <p>
            If you submit feedback or training suggestions, we store the content you provide along with your
            account identifier. We use Vercel Analytics and Speed Insights to understand site performance; these
            tools may collect anonymized usage data such as page views and device type.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed text-foreground/85">
          <h2 className="text-base font-semibold text-foreground">How we use it</h2>
          <p>
            Your data powers the DebateAI tutoring experience, helps us improve answer quality, and lets us
            enforce fair usage limits. We do not sell your personal information.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed text-foreground/85">
          <h2 className="text-base font-semibold text-foreground">Retention and deletion</h2>
          <p>
            Conversations remain in your account until you delete them. Feedback and training submissions may be
            retained for product improvement. To request account deletion, contact us through the email linked
            on your account or the support channel listed on the site.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed text-foreground/85">
          <h2 className="text-base font-semibold text-foreground">Third parties</h2>
          <p>
            We use Supabase (database and auth), Anthropic and OpenAI (AI responses and search), and Vercel
            (hosting and analytics). Each provider has its own privacy policy governing how they handle data
            sent through their APIs.
          </p>
        </section>

        <footer className="border-t border-border pt-8">
          <LogoWithLabel />
        </footer>
      </div>
    </main>
  );
}
