import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cookie Policy — Reliant Anchor",
  description: "How Reliant Anchor uses cookies in its Operations Management System.",
};

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white overflow-hidden ring-1 ring-black/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpeg" alt="Reliant Anchor" className="w-full h-full object-contain" />
          </div>
          <Link href="/login" className="font-bold text-foreground text-sm">Reliant Anchor</Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm text-muted-foreground">Cookie Policy</span>
        </div>
      </header>

      <div className="bg-[oklch(0.18_0.06_240)] border-b border-[oklch(0.25_0.06_240)] py-14 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Legal</p>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-3">Cookie Policy</h1>
          <p className="text-white/60 text-sm">How we use cookies in the Reliant Anchor Operations Management System.</p>
          <p className="text-white/30 text-xs mt-3">Last updated: 6 June 2025</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <article className="text-sm text-muted-foreground leading-relaxed space-y-8">

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">What Are Cookies?</h2>
            <p>Cookies are small text files stored on your device when you use a web application. RAOMS uses cookies and browser storage to maintain secure, functional sessions for authorised users.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Cookies We Use</h2>
            <div className="overflow-x-auto rounded-lg border border-border mt-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted border-b border-border">
                    <th className="text-left py-2.5 px-4 font-semibold text-foreground">Category</th>
                    <th className="text-left py-2.5 px-4 font-semibold text-foreground">Purpose</th>
                    <th className="text-left py-2.5 px-4 font-semibold text-foreground">Disable?</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="py-2.5 px-4 font-medium text-foreground">Essential / Session</td>
                    <td className="py-2.5 px-4">Authentication tokens, CSRF protection, session state. Required for the System to function securely.</td>
                    <td className="py-2.5 px-4 text-destructive font-semibold">No</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-medium text-foreground">Functional</td>
                    <td className="py-2.5 px-4">Remembering UI preferences (sidebar state, theme). Improves experience.</td>
                    <td className="py-2.5 px-4 text-primary font-semibold">Yes — browser settings</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs">RAOMS does <strong>not</strong> use advertising, analytics, or third-party tracking cookies.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Managing Cookies</h2>
            <p>You can clear or block cookies via your browser settings. Note that disabling essential cookies will log you out and prevent login. For browser-specific instructions visit your browser's help documentation.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Changes</h2>
            <p>We may update this Cookie Policy when we change System technologies. The "Last updated" date above will be revised. Your continued use of RAOMS after changes constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Contact</h2>
            <div className="p-4 bg-muted rounded-lg border border-border">
              <p className="font-semibold text-foreground">Reliant Anchor Ltd — Privacy</p>
              <p className="mt-1">Email: <a href="mailto:privacy@reliantanchor.com" className="text-primary hover:underline">privacy@reliantanchor.com</a></p>
            </div>
            <p className="mt-3 text-xs italic">⚠️ Template — review with a qualified Nigerian lawyer before going live.</p>
          </section>
        </article>
      </div>

      <footer className="border-t border-border px-6 py-6 bg-background">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Reliant Anchor Ltd. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Use</Link>
            <Link href="/cookies" className="text-primary">Cookie Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
