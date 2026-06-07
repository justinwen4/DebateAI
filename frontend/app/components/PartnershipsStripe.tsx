import Image from "next/image";

const partners: {
  name: string;
  tagline: string;
  href: string;
  logo?: string;
  objectPosition?: string;
}[] = [
  {
    name: "Circuit Skillbuilder",
    tagline: "Free resources for the debate community",
    href: "https://circuitskillbuilder.org/",
    logo: "/logo-circuit-skillbuilder.png",
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
  {
    name: "Prime Debate Institute",
    tagline: "For youth, by youth",
    href: "https://primedebateinstitute.weebly.com/",
    logo: "/logo-pdi.png",
  },
  {
    name: "PepTalk Debate",
    tagline: "Free LD mentorship for under-resourced debaters",
    href: "https://www.peptalkdebate.org/",
    logo: "/logo-peptalk-debate.png",
  },
];

export default function PartnershipsStripe() {
  const items = [...partners, ...partners];

  return (
    <section className="py-10 overflow-hidden">
      <div className="mx-auto max-w-6xl px-6 mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
          Partnerships
        </p>
        <p className="mt-1 text-sm text-muted">
          Proudly partnered with leading voices in the debate community.
        </p>
      </div>

      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[var(--color-surface,theme(colors.white))] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[var(--color-surface,theme(colors.white))] to-transparent" />
        <div className="marquee-track flex w-max items-center gap-14">
          {items.map((partner, i) => (
            <a
              key={i}
              href={partner.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 opacity-70 transition-opacity duration-200 hover:opacity-100"
            >
              {partner.logo && (
                <div className="relative h-10 w-32">
                  <Image
                    src={partner.logo}
                    alt={partner.name}
                    fill
                    className="object-contain"
                    style={{ objectPosition: partner.objectPosition ?? "center" }}
                  />
                </div>
              )}
              <div className="flex flex-col items-center text-center">
                <span className="text-xs font-semibold text-foreground leading-snug">
                  {partner.name}
                </span>
                <span className="text-[11px] text-muted leading-snug">
                  {partner.tagline}
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
