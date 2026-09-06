import React from "react";
import { LegalLayout } from "./LegalLayout";
import { usePageTitle } from "../../hooks/usePageTitle";

export const TermsPage: React.FC = () => {
  usePageTitle("Terms of Service");
  return (
    <LegalLayout title="Terms of Service" lastUpdated="June 18, 2026">
      <p>
        Welcome to KnowledgeMarket. These Terms of Service ("Terms") govern your access to and use
        of the KnowledgeMarket website, applications, and services (collectively, the "Service").
        By creating an account, accessing, or using the Service, you agree to be bound by these
        Terms. If you do not agree, do not use the Service.
      </p>

      <h2>1. Eligibility</h2>
      <p>
        You must be at least 18 years old to use the Service, or the age of legal majority in your
        jurisdiction, whichever is greater. By using the Service you represent that you meet this
        requirement and that you have the legal capacity to enter into a binding contract.
      </p>

      <h2>2. Accounts</h2>
      <p>
        You are responsible for maintaining the confidentiality of your account credentials and for
        all activities that occur under your account. You must notify us immediately of any
        unauthorized use. We are not liable for any loss or damage arising from your failure to
        protect your account.
      </p>

      <h2>3. Acceptable Use</h2>
      <p>You agree not to use the Service to:</p>
      <ul>
        <li>Violate any applicable law, regulation, or third-party right.</li>
        <li>Upload, post, or distribute content that infringes intellectual property, is unlawful, defamatory, obscene, hateful, harassing, or otherwise objectionable.</li>
        <li>Attempt to gain unauthorized access to any portion of the Service, other accounts, or related systems.</li>
        <li>Interfere with or disrupt the Service, including by introducing malware, scraping at unreasonable rates, or bypassing rate limits.</li>
        <li>Reverse engineer, decompile, or otherwise attempt to derive the source code of the Service, except where this restriction is prohibited by law.</li>
        <li>Use the Service to send unsolicited communications, solicit payments outside the platform, or impersonate any person or entity.</li>
      </ul>

      <h2>4. User Content and Course Materials</h2>
      <p>
        You retain ownership of any content you upload, including courses, lessons, text, images,
        audio, and video ("User Content"). By uploading User Content, you grant us a worldwide,
        non-exclusive, royalty-free license to host, store, reproduce, display, and distribute that
        User Content solely as necessary to operate and provide the Service.
      </p>
      <p>
        You represent and warrant that you have all rights necessary to upload your User Content
        and that it does not infringe the rights of any third party. We reserve the right, but
        have no obligation, to remove any User Content that we believe violates these Terms or
        applicable law.
      </p>

      <h2>5. Purchases and Subscriptions</h2>
      <p>
        Course purchases and subscriptions are processed by Stripe. By making a purchase you agree
        to provide accurate billing information and authorize us to charge the applicable amount.
        Prices and availability of courses are set by the course creator and may change without
        notice. Subscriptions renew automatically until cancelled. Refunds are governed by our
        Refund Policy.
      </p>

      <h2>6. Course Creator Responsibilities</h2>
      <p>
        If you create or sell courses on the Service, you are solely responsible for the accuracy,
        legality, and quality of your courses. You agree to honor your published descriptions,
        respond to learner questions in good faith, and comply with all applicable tax and
        consumer-protection laws. We do not endorse any course and are not responsible for the
        outcomes or results of any course.
      </p>

      <h2>7. Intellectual Property</h2>
      <p>
        The Service itself, including its design, code, branding, and underlying technology, is
        owned by us or our licensors and is protected by intellectual property laws. Except for
        the limited rights granted in these Terms, no rights are granted to you in or to the
        Service.
      </p>

      <h2>8. Third-Party Services</h2>
      <p>
        The Service integrates with third-party providers, including Stripe (payments), Resend
        (email delivery), and a cloud hosting provider. We are not responsible for the practices
        or content of these third parties. Your use of their services is subject to their own
        terms and policies.
      </p>

      <h2>9. Disclaimers</h2>
      <p>
        THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER
        EXPRESS OR IMPLIED. WE DISCLAIM ALL WARRANTIES, INCLUDING WARRANTIES OF MERCHANTABILITY,
        FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ANY WARRANTIES ARISING FROM COURSE
        OF DEALING OR USAGE OF TRADE. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED,
        ERROR-FREE, SECURE, OR THAT ANY CONTENT IS ACCURATE OR RELIABLE.
      </p>

      <h2>10. Limitation of Liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT WILL WE BE LIABLE FOR ANY INDIRECT,
        INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR ANY LOSS OF
        PROFITS, REVENUE, DATA, OR GOODWILL, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE.
        OUR AGGREGATE LIABILITY FOR ANY CLAIM ARISING OUT OF THESE TERMS OR THE SERVICE WILL NOT
        EXCEED THE AMOUNT YOU PAID US IN THE TWELVE MONTHS BEFORE THE EVENT GIVING RISE TO THE
        CLAIM, OR ONE HUNDRED U.S. DOLLARS, WHICHEVER IS GREATER.
      </p>

      <h2>11. Indemnification</h2>
      <p>
        You agree to indemnify, defend, and hold harmless KnowledgeMarket and its operators,
        employees, and agents from any claims, damages, liabilities, costs, and expenses
        (including reasonable attorneys' fees) arising out of your use of the Service, your User
        Content, or your breach of these Terms.
      </p>

      <h2>12. Termination</h2>
      <p>
        We may suspend or terminate your access to the Service at any time, with or without
        notice, for any reason, including breach of these Terms. Upon termination, your right to
        use the Service ends immediately. Sections that by their nature should survive
        termination will survive, including ownership provisions, warranty disclaimers, indemnity,
        and limitations of liability.
      </p>

      <h2>13. Changes to the Service or Terms</h2>
      <p>
        We may modify the Service or these Terms at any time. If we make material changes to the
        Terms, we will notify you by email or by posting a notice on the Service. Your continued
        use of the Service after the changes take effect constitutes your acceptance of the
        revised Terms.
      </p>

      <h2>14. Governing Law and Disputes</h2>
      <p>
        These Terms are governed by the laws of the State of Illinois, United States, without
        regard to its conflict of laws principles. You agree that any dispute arising out of or
        relating to these Terms or the Service will be resolved exclusively in the state or
        federal courts located in Illinois, and you consent to the personal jurisdiction of
        those courts.
      </p>

      <h2>15. Contact</h2>
      <p>
        Questions about these Terms can be sent to{" "}
        <a href="mailto:noahstarkenburg@gmail.com">noahstarkenburg@gmail.com</a>.
      </p>
    </LegalLayout>
  );
};
