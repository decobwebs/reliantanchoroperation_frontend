import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Reliant Anchor",
  description: "How Reliant Anchor collects and protects data in its Operations Management System.",
};

const SECTIONS = [
  { id: "intro", title: "Introduction" },
  { id: "collection", title: "Information We Collect" },
  { id: "use", title: "How We Use It" },
  { id: "lawful-basis", title: "Lawful Basis" },
  { id: "sharing", title: "Sharing & Third Parties" },
  { id: "retention", title: "Data Retention" },
  { id: "security", title: "Security" },
  { id: "rights", title: "Your Rights (NDPA)" },
  { id: "transfers", title: "International Transfers" },
  { id: "changes", title: "Changes" },
  { id: "contact", title: "Contact Us" },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white overflow-hidden ring-1 ring-black/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpeg" alt="Reliant Anchor" className="w-full h-full object-contain" />
          </div>
          <Link href="/login" className="font-bold text-foreground text-sm">Reliant Anchor</Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm text-muted-foreground">Privacy Policy</span>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-[oklch(0.18_0.06_240)] border-b border-[oklch(0.25_0.06_240)] py-14 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Legal</p>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-3">Privacy Policy</h1>
          <p className="text-white/60 text-sm">How Reliant Anchor Ltd processes personal data in its Operations Management System (RAOMS).</p>
          <p className="text-white/30 text-xs mt-3">Last updated: 6 June 2025</p>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-5xl mx-auto px-6 py-12 flex gap-12">
        {/* Sidebar */}
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
            <p>Reliant Anchor Ltd ("<strong>Reliant Anchor</strong>", "<strong>we</strong>", "<strong>our</strong>") operates the Reliant Anchor Operations Management System ("<strong>RAOMS</strong>" or the "<strong>System</strong>"). This Policy explains how we collect and process personal data of System users (staff, managers, and clients) in compliance with the <strong>Nigeria Data Protection Act 2023 (NDPA)</strong> and its implementing regulations.</p>
          </section>

          <section id="collection">
            <h2 className="text-base font-semibold text-foreground mb-2">Information We Collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account data</strong> — full name, email address, job role/rank within the organisation</li>
              <li><strong>Authentication data</strong> — hashed passwords, session tokens, login timestamps and IP addresses</li>
              <li><strong>Operational records</strong> — bunker orders, vessel operations, fleet data, logistics assignments, task records, financial transactions and approvals created or processed within RAOMS</li>
              <li><strong>Activity logs</strong> — audit trail of actions performed in the System (who did what and when)</li>
              <li><strong>Client data</strong> — client company name, contact person, and operational requests submitted through the client portal</li>
            </ul>
          </section>

          <section id="use">
            <h2 className="text-base font-semibold text-foreground mb-2">How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To authenticate and manage user accounts within RAOMS</li>
              <li>To enable role-based access to operational data appropriate to each user's responsibilities</li>
              <li>To record and process maritime operations, bunker management, logistics, and financial activities</li>
              <li>To maintain an audit trail for compliance, accountability, and dispute resolution</li>
              <li>To generate operational reports and analytics for management</li>
              <li>To comply with Nigerian maritime, tax, and employment regulations</li>
              <li>To detect and prevent unauthorised access or fraud</li>
            </ul>
          </section>

          <section id="lawful-basis">
            <h2 className="text-base font-semibold text-foreground mb-2">Lawful Basis for Processing</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Performance of a contract</strong> — processing necessary to provide the RAOMS service to the organisation</li>
              <li><strong>Legal obligation</strong> — maintaining records required by Nigerian maritime, labour, and tax law</li>
              <li><strong>Legitimate interests</strong> — security monitoring, fraud prevention, and system improvement</li>
            </ul>
          </section>

          <section id="sharing">
            <h2 className="text-base font-semibold text-foreground mb-2">Sharing &amp; Third Parties</h2>
            <p>We do not sell personal data. We may share it with:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Infrastructure providers</strong> — cloud hosting and database services (data processed under data-processing agreements)</li>
              <li><strong>Professional advisers</strong> — lawyers and auditors bound by confidentiality</li>
              <li><strong>Regulatory authorities</strong> — where required by Nigerian law, court order, or regulatory request</li>
            </ul>
          </section>

          <section id="retention">
            <h2 className="text-base font-semibold text-foreground mb-2">Data Retention</h2>
            <p>Operational records and audit logs are retained for a minimum of <strong>7 years</strong> in accordance with Nigerian Companies and Allied Matters Act (CAMA) and tax retention obligations. User account data is deleted or anonymised within 90 days of account closure, unless attached to records with longer retention obligations.</p>
          </section>

          <section id="security">
            <h2 className="text-base font-semibold text-foreground mb-2">Security</h2>
            <p>We implement role-based access controls, encrypted data transmission (HTTPS/TLS), hashed credentials, audit logging, and regular security reviews. Access to RAOMS is limited to authorised personnel only. If you suspect unauthorised access, report it immediately to your system administrator or to us at the contact below.</p>
          </section>

          <section id="rights">
            <h2 className="text-base font-semibold text-foreground mb-2">Your Rights under the NDPA</h2>
            <p>As a data subject you have the right to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Access</strong> personal data we hold about you</li>
              <li><strong>Rectification</strong> of inaccurate data</li>
              <li><strong>Erasure</strong> where no legal retention obligation applies</li>
              <li><strong>Restriction</strong> of processing in certain circumstances</li>
              <li><strong>Portability</strong> of your data in a structured format</li>
              <li><strong>Objection</strong> to processing based on legitimate interests</li>
              <li><strong>Complaint</strong> to the <strong>Nigeria Data Protection Commission (NDPC)</strong> at <a href="https://ndpc.gov.ng" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">ndpc.gov.ng</a></li>
            </ul>
            <p className="mt-2">Email us at the contact below to exercise your rights. We respond within 30 days.</p>
          </section>

          <section id="transfers">
            <h2 className="text-base font-semibold text-foreground mb-2">International Transfers</h2>
            <p>Infrastructure hosting may involve servers outside Nigeria. Where personal data is transferred internationally we ensure appropriate NDPA-compliant safeguards are in place.</p>
          </section>

          <section id="changes">
            <h2 className="text-base font-semibold text-foreground mb-2">Changes to This Policy</h2>
            <p>We may update this Policy periodically. Material changes will be communicated to system administrators. The "Last updated" date above is revised on each update.</p>
          </section>

          <section id="contact">
            <h2 className="text-base font-semibold text-foreground mb-2">Contact Us</h2>
            <div className="p-4 bg-muted rounded-lg border border-border">
              <p className="font-semibold text-foreground">Reliant Anchor Ltd — Data Privacy</p>
              <p className="mt-1">Email: <a href="mailto:privacy@reliantanchor.com" className="text-primary hover:underline">privacy@reliantanchor.com</a></p>
              {/* REPLACE: insert registered address */}
            </div>
            <p className="mt-4 text-xs text-muted-foreground italic">⚠️ Template — review with a qualified Nigerian lawyer before going live.</p>
          </section>
        </article>
      </div>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-6 bg-background">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Reliant Anchor Ltd. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="text-primary">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Use</Link>
            <Link href="/cookies" className="hover:text-foreground transition-colors">Cookie Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
