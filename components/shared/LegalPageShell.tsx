import Link from "next/link";

const FOOTER_LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Use" },
  { href: "/cookies", label: "Cookie Policy" },
] as const;

/**
 * Shared frame for the three public legal pages — sticky logo header, a
 * brand-gradient hero band, an optional section-jump sidebar, and a footer
 * with links to the sibling legal pages. Article prose stays page-specific;
 * this only owns the chrome the three pages had duplicated verbatim.
 */
export function LegalPageShell({
  title,
  subtitle,
  lastUpdated,
  sections,
  activeHref,
  children,
}: {
  title: string;
  subtitle: string;
  lastUpdated: string;
  /** Section-jump nav — only Privacy and Terms have one, Cookies doesn't. */
  sections?: { id: string; title: string }[];
  activeHref: (typeof FOOTER_LINKS)[number]["href"];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-3">
          <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-black/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.png" alt="Reliant Anchor" className="h-full w-full object-contain" />
          </div>
          <Link href="/login" className="text-sm font-bold text-foreground">Reliant Anchor</Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm text-muted-foreground">{title}</span>
        </div>
      </header>

      <div className="brand-grad-hero border-b border-white/10 px-6 py-14">
        <div className="mx-auto max-w-4xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/40">Legal</p>
          <h1 className="mb-3 text-3xl font-bold tracking-tight text-white">{title}</h1>
          <p className="text-sm text-white/60">{subtitle}</p>
          <p className="mt-3 text-xs text-white/30">Last updated: {lastUpdated}</p>
        </div>
      </div>

      <div className="mx-auto flex max-w-5xl gap-12 px-6 py-12">
        {sections && (
          <aside className="hidden w-48 shrink-0 lg:block">
            <nav className="sticky top-20">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">On this page</p>
              <ul className="space-y-0.5">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="block py-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        )}

        <article className="max-w-3xl flex-1 space-y-8 text-sm leading-relaxed text-muted-foreground">
          {children}
        </article>
      </div>

      <footer className="border-t border-border bg-background px-6 py-6">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Reliant Anchor Ltd. All rights reserved.</p>
          <div className="flex gap-4">
            {FOOTER_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={l.href === activeHref ? "text-brand-600" : "transition-colors hover:text-foreground"}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
