import React from "react";
import { LegalLayout } from "./LegalLayout";
import { usePageTitle } from "../../hooks/usePageTitle";

export const PrivacyPage: React.FC = () => {
  usePageTitle("Privacy Policy");
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="June 18, 2026">
      <p>
        This Privacy Policy describes how KnowledgeMarket ("we", "us") collects, uses, and shares
        information about you when you use our website and services (the "Service"). By using the
        Service you agree to the practices described here.
      </p>

      <h2>1. Information We Collect</h2>

      <h3>Information you provide</h3>
      <ul>
        <li><strong>Account information:</strong> email address and password (stored as a salted hash). Optionally a display name.</li>
        <li><strong>Course content:</strong> if you publish courses, the text, files, images, audio, and video you upload.</li>
        <li><strong>Communications:</strong> messages you send us through support channels.</li>
      </ul>

      <h3>Information collected automatically</h3>
      <ul>
        <li><strong>Usage data:</strong> pages viewed, actions taken, lessons completed, and similar interactions.</li>
        <li><strong>Device and log data:</strong> IP address, browser type, operating system, referring URL, and timestamps. These appear in our server logs.</li>
        <li><strong>Cookies:</strong> see "Cookies" below.</li>
      </ul>

      <h3>Information from third parties</h3>
      <ul>
        <li><strong>Stripe:</strong> when you make a purchase, Stripe processes the payment and shares limited information with us, such as a customer identifier, the last four digits of your card, and transaction status. We do not receive or store your full card details.</li>
      </ul>

      <h2>2. How We Use Information</h2>
      <ul>
        <li>To create and operate your account.</li>
        <li>To process purchases and deliver courses you have access to.</li>
        <li>To send transactional emails such as account verification, password reset, and purchase confirmations.</li>
        <li>To detect, prevent, and respond to fraud, abuse, and security incidents.</li>
        <li>To improve the Service, debug problems, and develop new features.</li>
        <li>To comply with legal obligations.</li>
      </ul>

      <h2>3. How We Share Information</h2>
      <p>We do not sell your personal information. We share information only as described below:</p>
      <ul>
        <li><strong>Service providers:</strong> with vendors who help us operate the Service. These currently include Stripe (payments), Resend (email delivery), and our cloud hosting provider. Each receives only the information needed to provide their service.</li>
        <li><strong>Course creators:</strong> if you purchase a course, the creator may see anonymized enrollment counts and basic order data. Your email is not shared with creators unless you contact them directly.</li>
        <li><strong>Legal requirements:</strong> when required by law, subpoena, or to protect our rights, property, or the safety of others.</li>
        <li><strong>Business transfers:</strong> in connection with a merger, acquisition, or sale of assets, your information may transfer to the successor entity.</li>
      </ul>

      <h2>4. Cookies</h2>
      <p>We use a small number of cookies that are necessary to operate the Service:</p>
      <ul>
        <li><strong>Authentication cookie</strong> (<code>km_auth</code>): HttpOnly and Secure. Holds your session token. Not accessible to JavaScript.</li>
        <li><strong>CSRF cookie</strong> (<code>km_csrf</code>): readable by your browser, sent back as the <code>X-CSRF</code> header to protect against cross-site request forgery.</li>
      </ul>
      <p>
        We do not use third-party advertising cookies or cross-site tracking. Disabling these
        cookies will prevent you from signing in or making purchases.
      </p>

      <h2>5. Data Retention</h2>
      <p>
        We keep your account information for as long as your account is active. If you delete your
        account we will delete or anonymize your personal information within a reasonable period,
        except where we are required to retain it to comply with legal obligations, resolve
        disputes, or enforce our agreements (for example, retaining order records for tax
        purposes).
      </p>

      <h2>6. Security</h2>
      <p>
        We use industry-standard measures to protect your information, including password hashing,
        HTTPS for all network traffic, HttpOnly authentication cookies, and rate limiting on
        sensitive endpoints. No system is perfectly secure, and we cannot guarantee absolute
        security. If you suspect your account has been compromised, contact us immediately.
      </p>

      <h2>7. Your Rights</h2>
      <p>
        Depending on where you live, you may have rights to access, correct, delete, or export
        your personal information, and to object to or restrict certain processing. To exercise
        these rights, email{" "}
        <a href="mailto:noahstarkenburg@gmail.com">noahstarkenburg@gmail.com</a>. We will respond
        within a reasonable time and may need to verify your identity before acting on a request.
      </p>
      <p>
        If you are in the European Economic Area or the United Kingdom, you also have the right to
        lodge a complaint with your local data protection authority.
      </p>
      <p>
        If you are a California resident, you have rights under the California Consumer Privacy
        Act, including the right to know what personal information we collect, the right to
        request deletion, and the right not to be discriminated against for exercising your
        rights. We do not sell personal information.
      </p>

      <h2>8. Children</h2>
      <p>
        The Service is not directed to children under 16, and we do not knowingly collect personal
        information from anyone under 16. If you believe a child has provided us with personal
        information, contact us and we will delete it.
      </p>

      <h2>9. International Transfers</h2>
      <p>
        We operate from the United States. If you access the Service from outside the United
        States, your information will be transferred to, processed in, and stored in the United
        States, which may have data protection laws different from those of your country.
      </p>

      <h2>10. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. If we make material changes we will
        notify you by email or by posting a notice on the Service before the changes take effect.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions or requests about this Privacy Policy can be sent to{" "}
        <a href="mailto:noahstarkenburg@gmail.com">noahstarkenburg@gmail.com</a>.
      </p>
    </LegalLayout>
  );
};
