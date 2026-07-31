import type { Metadata } from "next";
import { LegalPageShell } from "@/components/shared/LegalPageShell";

export const metadata: Metadata = {
  title: "Cookie Policy — Reliant Anchor",
  description: "How Reliant Anchor uses cookies in its Operations Management System.",
};

export default function CookiesPage() {
  return (
    <LegalPageShell
      title="Cookie Policy"
      subtitle="How we use cookies in the Reliant Anchor Operations Management System."
      lastUpdated="6 June 2025"
      activeHref="/cookies"
    >
      <section>
        <h2 className="mb-2 text-base font-semibold text-foreground">What Are Cookies?</h2>
        <p>Cookies are small text files stored on your device when you use a web application. RAOMS uses cookies and browser storage to maintain secure, functional sessions for authorised users.</p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-foreground">Cookies We Use</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className="px-4 py-2.5 text-left font-semibold text-foreground">Category</th>
                <th className="px-4 py-2.5 text-left font-semibold text-foreground">Purpose</th>
                <th className="px-4 py-2.5 text-left font-semibold text-foreground">Disable?</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="px-4 py-2.5 font-medium text-foreground">Essential / Session</td>
                <td className="px-4 py-2.5">Authentication tokens, CSRF protection, session state. Required for the System to function securely.</td>
                <td className="px-4 py-2.5 font-semibold text-destructive">No</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-medium text-foreground">Functional</td>
                <td className="px-4 py-2.5">Remembering UI preferences (sidebar state, theme). Improves experience.</td>
                <td className="px-4 py-2.5 font-semibold text-brand-600">Yes — browser settings</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs">RAOMS does <strong>not</strong> use advertising, analytics, or third-party tracking cookies.</p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-foreground">Managing Cookies</h2>
        <p>You can clear or block cookies via your browser settings. Note that disabling essential cookies will log you out and prevent login. For browser-specific instructions visit your browser&apos;s help documentation.</p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-foreground">Changes</h2>
        <p>We may update this Cookie Policy when we change System technologies. The &quot;Last updated&quot; date above will be revised. Your continued use of RAOMS after changes constitutes acceptance.</p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-foreground">Contact</h2>
        <div className="rounded-lg border border-border bg-muted p-4">
          <p className="font-semibold text-foreground">Reliant Anchor Ltd — Privacy</p>
          <p className="mt-1">Email: <a href="mailto:privacy@reliantanchor.com" className="text-brand-600 hover:underline">privacy@reliantanchor.com</a></p>
        </div>
        <p className="mt-3 text-xs italic">⚠️ Template — review with a qualified Nigerian lawyer before going live.</p>
      </section>
    </LegalPageShell>
  );
}
