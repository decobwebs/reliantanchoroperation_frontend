import type { Metadata } from "next";
import { LegalPageShell } from "@/components/shared/LegalPageShell";

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
    <LegalPageShell
      title="Privacy Policy"
      subtitle="How Reliant Anchor Ltd processes personal data in its Operations Management System (RAOMS)."
      lastUpdated="6 June 2025"
      sections={SECTIONS}
      activeHref="/privacy"
    >
      <section id="intro">
        <h2 className="mb-2 text-base font-semibold text-foreground">Introduction</h2>
        <p>Reliant Anchor Ltd (&quot;<strong>Reliant Anchor</strong>&quot;, &quot;<strong>we</strong>&quot;, &quot;<strong>our</strong>&quot;) operates the Reliant Anchor Operations Management System (&quot;<strong>RAOMS</strong>&quot; or the &quot;<strong>System</strong>&quot;). This Policy explains how we collect and process personal data of System users (staff, managers, and clients) in compliance with the <strong>Nigeria Data Protection Act 2023 (NDPA)</strong> and its implementing regulations.</p>
      </section>

      <section id="collection">
        <h2 className="mb-2 text-base font-semibold text-foreground">Information We Collect</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Account data</strong> — full name, email address, job role/rank within the organisation</li>
          <li><strong>Authentication data</strong> — hashed passwords, session tokens, login timestamps and IP addresses</li>
          <li><strong>Operational records</strong> — bunker orders, vessel operations, fleet data, logistics assignments, task records, financial transactions and approvals created or processed within RAOMS</li>
          <li><strong>Activity logs</strong> — audit trail of actions performed in the System (who did what and when)</li>
          <li><strong>Client data</strong> — client company name, contact person, and operational requests submitted through the client portal</li>
        </ul>
      </section>

      <section id="use">
        <h2 className="mb-2 text-base font-semibold text-foreground">How We Use Your Information</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>To authenticate and manage user accounts within RAOMS</li>
          <li>To enable role-based access to operational data appropriate to each user&apos;s responsibilities</li>
          <li>To record and process maritime operations, bunker management, logistics, and financial activities</li>
          <li>To maintain an audit trail for compliance, accountability, and dispute resolution</li>
          <li>To generate operational reports and analytics for management</li>
          <li>To comply with Nigerian maritime, tax, and employment regulations</li>
          <li>To detect and prevent unauthorised access or fraud</li>
        </ul>
      </section>

      <section id="lawful-basis">
        <h2 className="mb-2 text-base font-semibold text-foreground">Lawful Basis for Processing</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Performance of a contract</strong> — processing necessary to provide the RAOMS service to the organisation</li>
          <li><strong>Legal obligation</strong> — maintaining records required by Nigerian maritime, labour, and tax law</li>
          <li><strong>Legitimate interests</strong> — security monitoring, fraud prevention, and system improvement</li>
        </ul>
      </section>

      <section id="sharing">
        <h2 className="mb-2 text-base font-semibold text-foreground">Sharing &amp; Third Parties</h2>
        <p>We do not sell personal data. We may share it with:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><strong>Infrastructure providers</strong> — cloud hosting and database services (data processed under data-processing agreements)</li>
          <li><strong>Professional advisers</strong> — lawyers and auditors bound by confidentiality</li>
          <li><strong>Regulatory authorities</strong> — where required by Nigerian law, court order, or regulatory request</li>
        </ul>
      </section>

      <section id="retention">
        <h2 className="mb-2 text-base font-semibold text-foreground">Data Retention</h2>
        <p>Operational records and audit logs are retained for a minimum of <strong>7 years</strong> in accordance with Nigerian Companies and Allied Matters Act (CAMA) and tax retention obligations. User account data is deleted or anonymised within 90 days of account closure, unless attached to records with longer retention obligations.</p>
      </section>

      <section id="security">
        <h2 className="mb-2 text-base font-semibold text-foreground">Security</h2>
        <p>We implement role-based access controls, encrypted data transmission (HTTPS/TLS), hashed credentials, audit logging, and regular security reviews. Access to RAOMS is limited to authorised personnel only. If you suspect unauthorised access, report it immediately to your system administrator or to us at the contact below.</p>
      </section>

      <section id="rights">
        <h2 className="mb-2 text-base font-semibold text-foreground">Your Rights under the NDPA</h2>
        <p>As a data subject you have the right to:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><strong>Access</strong> personal data we hold about you</li>
          <li><strong>Rectification</strong> of inaccurate data</li>
          <li><strong>Erasure</strong> where no legal retention obligation applies</li>
          <li><strong>Restriction</strong> of processing in certain circumstances</li>
          <li><strong>Portability</strong> of your data in a structured format</li>
          <li><strong>Objection</strong> to processing based on legitimate interests</li>
          <li><strong>Complaint</strong> to the <strong>Nigeria Data Protection Commission (NDPC)</strong> at <a href="https://ndpc.gov.ng" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">ndpc.gov.ng</a></li>
        </ul>
        <p className="mt-2">Email us at the contact below to exercise your rights. We respond within 30 days.</p>
      </section>

      <section id="transfers">
        <h2 className="mb-2 text-base font-semibold text-foreground">International Transfers</h2>
        <p>Infrastructure hosting may involve servers outside Nigeria. Where personal data is transferred internationally we ensure appropriate NDPA-compliant safeguards are in place.</p>
      </section>

      <section id="changes">
        <h2 className="mb-2 text-base font-semibold text-foreground">Changes to This Policy</h2>
        <p>We may update this Policy periodically. Material changes will be communicated to system administrators. The &quot;Last updated&quot; date above is revised on each update.</p>
      </section>

      <section id="contact">
        <h2 className="mb-2 text-base font-semibold text-foreground">Contact Us</h2>
        <div className="rounded-lg border border-border bg-muted p-4">
          <p className="font-semibold text-foreground">Reliant Anchor Ltd — Data Privacy</p>
          <p className="mt-1">Email: <a href="mailto:privacy@reliantanchor.com" className="text-brand-600 hover:underline">privacy@reliantanchor.com</a></p>
          {/* REPLACE: insert registered address */}
        </div>
        <p className="mt-4 text-xs italic text-muted-foreground">⚠️ Template — review with a qualified Nigerian lawyer before going live.</p>
      </section>
    </LegalPageShell>
  );
}
