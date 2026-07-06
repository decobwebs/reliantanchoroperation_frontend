import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Use — Reliant Anchor",
  description: "Terms governing access to and use of the Reliant Anchor Operations Management System.",
};

const SECTIONS = [
  { id: "intro", title: "Introduction" },
  { id: "access", title: "Access & Accounts" },
  { id: "acceptable-use", title: "Acceptable Use" },
  { id: "data", title: "Data & Confidentiality" },
  { id: "ip", title: "Intellectual Property" },
  { id: "disclaimer", title: "Disclaimer" },
  { id: "liability", title: "Limitation of Liability" },
  { id: "termination", title: "Termination" },
  { id: "governing-law", title: "Governing Law" },
  { id: "contact", title: "Contact Us" },
];

export default function TermsPage() {
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
          <span className="text-sm text-muted-foreground">Terms of Use</span>
        </div>
      </header>

      <div className="bg-[oklch(0.18_0.06_240)] border-b border-[oklch(0.25_0.06_240)] py-14 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Legal</p>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-3">Terms of Use</h1>
          <p className="text-white/60 text-sm">Terms and conditions governing access to and use of the Reliant Anchor Operations Management System.</p>
          <p className="text-white/30 text-xs mt-3">Last updated: 6 June 2025</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12 flex gap-12">
        <aside className="hidden lg:block w-48 shrink-0">
          <nav className="sticky top-20">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">On this page</p>
            <ul className="space-y-0.5">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="block text-xs text-muted-foreground hover:text-foreground py-1 transition-colors">
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <article className="flex-1 max-w-3xl text-sm text-muted-foreground leading-relaxed space-y-8">

          <section id="intro">
            <h2 className="text-base font-semibold text-foreground mb-2">Introduction</h2>
            <p>These Terms of Use ("<strong>Terms</strong>") govern access to and use of the Reliant Anchor Operations Management System ("<strong>RAOMS</strong>" or "<strong>System</strong>") provided by <strong>Reliant Anchor Ltd</strong> ("<strong>we</strong>", "<strong>our</strong>", "<strong>us</strong>"). By logging into or using the System you agree to these Terms.</p>
          </section>

          <section id="access">
            <h2 className="text-base font-semibold text-foreground mb-2">Access &amp; Accounts</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Access is granted only to authorised personnel of Reliant Anchor Ltd and its approved clients.</li>
              <li>You are responsible for keeping your login credentials confidential. Do not share your password.</li>
              <li>You must notify the system administrator immediately if you suspect unauthorised use of your account.</li>
              <li>Accounts are role-based; you may only access modules and data authorised for your role.</li>
            </ul>
          </section>

          <section id="acceptable-use">
            <h2 className="text-base font-semibold text-foreground mb-2">Acceptable Use</h2>
            <p>You must not:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Access data or functions beyond your assigned role permissions</li>
              <li>Use the System for any unlawful purpose or in violation of Nigerian law</li>
              <li>Attempt to circumvent security controls, authentication, or access logs</li>
              <li>Introduce malicious code, perform denial-of-service attacks, or interfere with System integrity</li>
              <li>Export, copy, or transmit confidential operational data outside authorised channels without approval</li>
              <li>Use System data for personal gain or in competition with Reliant Anchor Ltd</li>
            </ul>
          </section>

          <section id="data">
            <h2 className="text-base font-semibold text-foreground mb-2">Data &amp; Confidentiality</h2>
            <p>All operational data, financial records, vessel data, client information, and audit logs within RAOMS are confidential. You agree to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Treat all data accessed through the System as confidential</li>
              <li>Not disclose confidential System data to unauthorised third parties</li>
              <li>Report any suspected data breach or unauthorised disclosure immediately</li>
            </ul>
            <p className="mt-2">These confidentiality obligations continue after your access to the System ends.</p>
          </section>

          <section id="ip">
            <h2 className="text-base font-semibold text-foreground mb-2">Intellectual Property</h2>
            <p>All intellectual property in RAOMS — including software, design, reports, and proprietary methodologies — is owned by or licensed to Reliant Anchor Ltd. You receive a limited, non-exclusive, non-transferable licence to use the System for your authorised role. You may not reverse-engineer, copy, or create derivative works from the System.</p>
          </section>

          <section id="disclaimer">
            <h2 className="text-base font-semibold text-foreground mb-2">Disclaimer</h2>
            <p>The System is provided "<strong>as is</strong>". While we strive for reliability, we do not warrant uninterrupted, error-free, or virus-free operation. You are responsible for the accuracy of data you enter into the System.</p>
          </section>

          <section id="liability">
            <h2 className="text-base font-semibold text-foreground mb-2">Limitation of Liability</h2>
            <p>To the maximum extent permitted by Nigerian law, Reliant Anchor Ltd shall not be liable for indirect, incidental, special, or consequential damages arising from use of or inability to use the System. Our total aggregate liability for direct damages shall not exceed the service fees paid by the relevant entity in the preceding 12 months.</p>
          </section>

          <section id="termination">
            <h2 className="text-base font-semibold text-foreground mb-2">Termination</h2>
            <p>Access may be revoked at any time by the system administrator or by Reliant Anchor Ltd if these Terms are breached or employment/engagement ends. Upon termination, your access ceases immediately and confidentiality obligations remain in force.</p>
          </section>

          <section id="governing-law">
            <h2 className="text-base font-semibold text-foreground mb-2">Governing Law</h2>
            <p>These Terms are governed by the laws of the <strong>Federal Republic of Nigeria</strong>. Disputes shall be subject to the exclusive jurisdiction of Nigerian courts.</p>
          </section>

          <section id="contact">
            <h2 className="text-base font-semibold text-foreground mb-2">Contact Us</h2>
            <div className="p-4 bg-muted rounded-lg border border-border">
              <p className="font-semibold text-foreground">Reliant Anchor Ltd — Legal</p>
              <p className="mt-1">Email: <a href="mailto:legal@reliantanchor.com" className="text-primary hover:underline">legal@reliantanchor.com</a></p>
              {/* REPLACE: insert registered address */}
            </div>
            <p className="mt-4 text-xs text-muted-foreground italic">⚠️ Template — review with a qualified Nigerian lawyer before going live.</p>
          </section>
        </article>
      </div>

      <footer className="border-t border-border px-6 py-6 bg-background">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Reliant Anchor Ltd. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-primary">Terms of Use</Link>
            <Link href="/cookies" className="hover:text-foreground transition-colors">Cookie Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
