import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export type LegalSection = {
  id: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  subsections?: Array<{ title: string; bullets: string[] }>;
};

export function LegalDocument({
  title,
  updated,
  intro,
  sections,
  footer,
  backHref = '/',
  backLabel = 'Geri dön',
}: {
  title: string;
  updated: string;
  intro: string[];
  sections: LegalSection[];
  footer?: string[];
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="min-h-screen bg-[#0c0d10] text-fg">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(34,211,238,0.08),transparent_55%)]" />
      <header className="relative border-b border-white/8 bg-[#0c0d10]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-4">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm text-fg-subtle transition-colors hover:text-fg"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
          <div className="font-mono text-sm font-semibold tracking-wide">
            SYDT<span className="text-accent-cyan">.</span>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-3xl px-6 py-10 pb-16">
        <h1 className="text-3xl font-bold tracking-tight text-fg md:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-fg">{updated}</p>

        <div className="mt-8 space-y-4 text-[15px] leading-relaxed text-fg-subtle">
          {intro.map((p) => (
            <p key={p.slice(0, 40)}>{p}</p>
          ))}
        </div>

        <div className="mt-12 space-y-10">
          {sections.map((sec) => (
            <section key={sec.id} id={sec.id} className="scroll-mt-8">
              <h2 className="text-xl font-semibold text-fg">{sec.title}</h2>
              {sec.paragraphs?.map((p) => (
                <p key={p.slice(0, 48)} className="mt-3 text-[15px] leading-relaxed text-fg-subtle">
                  {p}
                </p>
              ))}
              {sec.bullets ? (
                <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-fg-subtle">
                  {sec.bullets.map((b) => (
                    <li key={b.slice(0, 48)}>{b}</li>
                  ))}
                </ul>
              ) : null}
              {sec.subsections?.map((sub) => (
                <div key={sub.title} className="mt-5">
                  <h3 className="text-base font-medium text-fg">{sub.title}</h3>
                  <ul className="mt-2 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-fg-subtle">
                    {sub.bullets.map((b) => (
                      <li key={b.slice(0, 48)}>{b}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>

        {footer && footer.length > 0 ? (
          <footer className="mt-14 border-t border-white/8 pt-8 text-sm text-muted-fg">
            {footer.map((p) => (
              <p key={p.slice(0, 48)} className="mt-2">
                {p}
              </p>
            ))}
          </footer>
        ) : null}
      </main>
    </div>
  );
}
