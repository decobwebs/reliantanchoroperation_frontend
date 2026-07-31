import type { Metadata } from "next";
import { LegalPageShell } from "@/components/shared/LegalPageShell";

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
    <LegalPageShell
      title="Terms of Use"
      subtitle="Terms and conditions governing access to and use of the Reliant Anchor Operations Management System."
      lastUpdated="6 June 2025"
      sections={SECTIONS}
      activeHref="/terms"
    >
      <section id="intro">
        <h2 className="mb-2 text-base font-semibold text-foreground">Introduction</h2>
        <p>These Terms of Use (&quot;<strong>Terms</strong>&quot;) govern access to and use of the Reliant Anchor Operations Management System (&quot;<strong>RAOMS</strong>&quot; or &quot;<strong>System</strong>&quot;) provided by <strong>Reliant Anchor Ltd</strong> (&quot;<strong>we</strong>&quot;, &quot;<strong>our</strong>&quot;, &quot;<strong>us</strong>&quot;). By logging into or using the System you agree to these Terms.</p>
      </section>

      <section id="access">
        <h2 className="mb-2 text-base font-semibold text-foreground">Access &amp; Accounts</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Access is granted only to authorised personnel of Reliant Anchor Ltd and its approved clients.</li>
          <li>You are responsible for keeping your login credentials confidential. Do not share your password.</li>
          <li>You must notify the system administrator immediately if you suspect unauthorised use of your account.</li>
          <li>Accounts are role-based; you may only access modules and data authorised for your role.</li>
        </ul>
      </section>

      <section id="acceptable-use">
        <h2 className="mb-2 text-base font-semibold text-foreground">Acceptable Use</h2>
        <p>You must not:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Access data or functions beyond your assigned role permissions</li>
          <li>Use the System for any unlawful purpose or in violation of Nigerian law</li>
          <li>Attempt to circumvent security controls, authentication, or access logs</li>
          <li>Introduce malicious code, perform denial-of-service attacks, or interfere with System integrity</li>
          <li>Export, copy, or transmit confidential operational data outside authorised channels without approval</li>
          <li>Use System data for personal gain or in competition with Reliant Anchor Ltd</li>
        </ul>
      </section>

      <section id="data">
        <h2 className="mb-2 text-base font-semibold text-foreground">Data &amp; Confidentiality</h2>
        <p>All operational data, financial records, vessel data, client information, and audit logs within RAOMS are confidential. You agree to:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Treat all data accessed through the System as confidential</li>
          <li>Not disclose confidential System data to unauthorised third parties</li>
          <li>Report any suspected data breach or unauthorised disclosure immediately</li>
        </ul>
        <p className="mt-2">These confidentiality obligations continue after your access to the System ends.</p>
      </section>

      <section id="ip">
        <h2 className="mb-2 text-base font-semibold text-foreground">Intellectual Property</h2>
        <p>All intellectual property in RAOMS — including software, design, reports, and proprietary methodologies — is owned by or licensed to Reliant Anchor Ltd. You receive a limited, non-exclusive, non-transferable licence to use the System for your authorised role. You may not reverse-engineer, copy, or create derivative works from the System.</p>
      </section>

      <section id="disclaimer">
        <h2 className="mb-2 text-base font-semibold text-foreground">Disclaimer</h2>
        <p>The System is provided &quot;<strong>as is</strong>&quot;. While we strive for reliability, we do not warrant uninterrupted, error-free, or virus-free operation. You are responsible for the accuracy of data you enter into the System.</p>
      </section>

      <section id="liability">
        <h2 className="mb-2 text-base font-semibold text-foreground">Limitation of Liability</h2>
        <p>To the maximum extent permitted by Nigerian law, Reliant Anchor Ltd shall not be liable for indirect, incidental, special, or consequential damages arising from use of or inability to use the System. Our total aggregate liability for direct damages shall not exceed the service fees paid by the relevant entity in the preceding 12 months.</p>
      </section>

      <section id="termination">
        <h2 className="mb-2 text-base font-semibold text-foreground">Termination</h2>
        <p>Access may be revoked at any time by the system administrator or by Reliant Anchor Ltd if these Terms are breached or employment/engagement ends. Upon termination, your access ceases immediately and confidentiality obligations remain in force.</p>
      </section>

      <section id="governing-law">
        <h2 className="mb-2 text-base font-semibold text-foreground">Governing Law</h2>
        <p>These Terms are governed by the laws of the <strong>Federal Republic of Nigeria</strong>. Disputes shall be subject to the exclusive jurisdiction of Nigerian courts.</p>
      </section>

      <section id="contact">
        <h2 className="mb-2 text-base font-semibold text-foreground">Contact Us</h2>
        <div className="rounded-lg border border-border bg-muted p-4">
          <p className="font-semibold text-foreground">Reliant Anchor Ltd — Legal</p>
          <p className="mt-1">Email: <a href="mailto:legal@reliantanchor.com" className="text-brand-600 hover:underline">legal@reliantanchor.com</a></p>
          {/* REPLACE: insert registered address */}
        </div>
        <p className="mt-4 text-xs italic text-muted-foreground">⚠️ Template — review with a qualified Nigerian lawyer before going live.</p>
      </section>
    </LegalPageShell>
  );
}
