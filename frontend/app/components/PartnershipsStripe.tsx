import Image from "next/image";

const partners: {
  name: string;
  tagline: string;
  href: string;
  logo?: string;
  darkLogo?: boolean;
}[] = [
  {
    name: "Circuit Skillbuilder",
    tagline: "Free resources for the debate community",
    href: "https://circuitskillbuilder.org/",
    logo: "/logo-circuit-skillbuilder.png",
    darkLogo: true,
  },
  {
    name: "Kritikal Discussions",
    tagline: "Making progressive debate accessible",
    href: "https://www.kritikaldiscussions.com/home",
    logo: "/logo-kritikal-discussions.png",
  },
  {
    name: "Champ Camp",
    tagline: "Elite LD summer intensive",
    href: "https://www.campchampion.org/",
    logo: "/logo-champ-camp.png",
  },
  {
    name: "CME Strategy",
    tagline: "Coaching for the national circuit",
    href: "https://www.cmestrategy.org/",
    logo: "/logo-cme-strategy.png",
  },
  {
    name: "Strake Jesuit Debate",
    tagline: "One of the nation's top debate programs",
    href: "https://www.strakejesuit.org/student-life/student-activities/debate",
    logo: "/logo-strake-jesuit.png",
  },
];

export default function PartnershipsStripe() {
  const items = [...partners, ...partners];

  return (
    <section className="border-y border-border-subtle bg-surface/60 py-10 overflow-hidden">
      <div className="mx-auto max-w-6xl px-6 mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
          Partnerships
        </p>
        <p className="mt-1 text-sm text-muted">
          Proudly partnered with leading voices in the debate community.
        </p>
      </div>

      <div className="relative overflow-hidden">
        <div className="marquee-track flex w-max gap-4">
          {items.map((partner, i) => (
            <a
              key={i}
              href={partner.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex min-w-[220px] items-center justify-center rounded-xl border px-5 py-4 shadow-[var(--shadow-sm)] transition-all duration-200 hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 ${
                partner.darkLogo
                  ? "border-neutral-700 bg-[#1a1614] hover:border-neutral-500"
                  : "border-border bg-surface hover:border-accent/40"
              }`}
            >
              {partner.logo ? (
                <Image
                  src={partner.logo}
                  alt={partner.name}
                  width={140}
                  height={48}
                  className="object-contain max-h-12"
                />
              ) : (
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground leading-snug">
                    {partner.name}
                  </span>
                  <span className="mt-1 text-xs text-muted leading-snug">
                    {partner.tagline}
                  </span>
                </div>
              )}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
