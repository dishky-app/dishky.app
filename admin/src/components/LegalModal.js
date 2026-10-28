/**
 * LegalModal — Terms & Conditions / Privacy Policy shown in the shared
 * admin-modal (header, body, footer) with a Close button.
 *
 *   const legal = useLegalModal();
 *   <button onClick={() => legal.show("terms")}>Terms</button>
 *   {legal.modal}
 *
 * The text below is DEMO content. Replace it with your lawyer-approved
 * wording before launch.
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import Button3D from "./Button3D";
import useAnimatedModal from "../hooks/useAnimatedModal";
import "../pages/ModalCSS.css";

const MODAL_ID = "legal-doc";
const UPDATED = "1 October 2026";

export const LEGAL_DOCS = {
  terms: {
    title: "Terms & Conditions",
    sections: [
      ["1. Acceptance of terms", "By creating an account or signing in to Dishky (the \"Service\"), you agree to these Terms & Conditions. If you do not agree, please do not use the Service. If you use the Service on behalf of a restaurant, you confirm that you are authorised to bind that business."],
      ["2. The Service", "Dishky provides restaurant management software: QR table ordering, menu and inventory tools, staff management, reporting and a kitchen display. Features available to you depend on your subscription plan. We may improve, change or retire features with reasonable notice."],
      ["3. Accounts and security", "You are responsible for keeping your login details confidential and for all activity under your account, including accounts you create for your staff. Tell us immediately if you suspect unauthorised access. Staff accounts must only be used by the person they were created for."],
      ["4. Subscriptions and payments", "Paid plans are billed in advance for the period you choose (monthly or yearly) and renew automatically until cancelled. Free trials convert to a paid plan only if you add a payment method. Fees already paid are non-refundable except where required by law. If a payment fails, your dashboard may become read-only until it is resolved."],
      ["5. Your data", "You own the menu, orders, customer and staff information you put into the Service. You give Dishky permission to store and process it only to run the Service for you. You are responsible for having the right to enter that data, including customer details collected through ordering."],
      ["6. Acceptable use", "You agree not to misuse the Service: no unlawful activity, no attempts to access another restaurant's data, no interfering with the platform's security or performance, and no reselling the Service without our written consent."],
      ["7. Customer payments", "Payments made by your customers are processed by third-party payment providers. Dishky is not a bank and does not hold your funds. Settlement times, fees and disputes are governed by the payment provider's own terms."],
      ["8. Availability", "We aim for high availability but do not guarantee uninterrupted service. We may suspend the Service for maintenance or security reasons and will try to give notice where possible."],
      ["9. Cancellation and termination", "You can cancel at any time from your account. Access continues until the end of the paid period. We may suspend or end accounts that break these terms. After termination, you can request an export of your data for 30 days before it is deleted."],
      ["10. Limitation of liability", "To the fullest extent permitted by law, Dishky is not liable for indirect or consequential losses such as lost profits or lost sales. Our total liability for any claim is limited to the fees you paid in the three months before the claim arose."],
      ["11. Changes to these terms", "We may update these terms from time to time. If a change is significant we will notify you in the dashboard or by email. Continuing to use the Service after a change means you accept it."],
      ["12. Contact", "Questions about these terms? Write to support@dishky.com."],
    ],
  },
  privacy: {
    title: "Privacy Policy",
    sections: [
      ["1. Who we are", "Dishky provides restaurant management software. For information you enter about your own restaurant, staff and customers, you are the data controller and Dishky acts as your processor. For account and billing information about the restaurant owner, Dishky is the controller."],
      ["2. Information we collect", "Account details (name, email, phone, restaurant name); staff and role details you add; menu, order and inventory records; customer details collected through ordering (such as name and phone number); billing information handled by our payment provider; and technical data such as IP address, device type and log events."],
      ["3. How we use it", "To provide and secure the Service, process orders and payments, send service messages (receipts, alerts, password resets), provide support, prevent fraud and abuse, and improve the product. We do not sell personal information."],
      ["4. Cookies", "We use essential cookies to keep you signed in (for example the dishkyid session cookie) and to remember basic preferences. We do not use advertising cookies in the dashboard."],
      ["5. Sharing", "We share data only with providers that help us run the Service, such as hosting, payments, messaging and email, under contracts that protect it. We may disclose information if required by law or to protect the rights and safety of users."],
      ["6. Data separation", "Each restaurant's data is kept logically separate. Staff of one restaurant cannot see another restaurant's information."],
      ["7. Retention", "We keep your data while your account is active. After cancellation we keep it for 30 days so you can export it, then delete or anonymise it, except where the law requires us to retain certain records such as invoices."],
      ["8. Security", "We use encryption in transit, hashed passwords, access controls and audit logs. No system is perfectly secure, so please use strong passwords and keep them private."],
      ["9. Your rights", "You can access, correct, export or delete your information, and object to certain processing. Restaurant owners can manage most of this from the dashboard. For other requests, contact us at privacy@dishky.com."],
      ["10. Changes", "We may update this policy and will show the new date above. If a change is significant we will let you know in the dashboard or by email."],
      ["11. Contact", "Privacy questions? Write to privacy@dishky.com."],
    ],
  },
};

export default function LegalModal({ docKey, modal }) {
  const doc = LEGAL_DOCS[docKey] || LEGAL_DOCS.terms;
  if (!modal.shouldRender) return null;
  return createPortal(
    <div className={`modal-overlay ${modal.overlayClass}`}>
      <div
        className={`admin-modal ${modal.modalClass}`}
        style={{ maxWidth: 720, width: "92vw" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={doc.title}
      >
        <div className="admin-modal-header">
          <h3>{doc.title}</h3>
        </div>
        <div className="admin-modal-body" style={{ maxHeight: "60vh", overflowY: "auto", textAlign: "left" }}>
          <p style={{ fontSize: 12, color: "#8a8a8a", marginTop: 0 }}>
            Last updated {UPDATED}. This is sample text for demonstration only.
          </p>
          {doc.sections.map(([heading, text]) => (
            <div key={heading} style={{ marginBottom: 14 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 4px" }}>{heading}</h4>
              <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, color: "#444" }}>{text}</p>
            </div>
          ))}
        </div>
        <div className="admin-modal-footer">
          <Button3D variant="cancel" type="button" onClick={() => modal.close()}>Close</Button3D>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function useLegalModal() {
  const modal = useAnimatedModal(MODAL_ID);
  const [docKey, setDocKey] = useState("terms");
  return {
    show: (key) => { setDocKey(key); modal.open(); },
    modal: <LegalModal docKey={docKey} modal={modal} />,
  };
}
