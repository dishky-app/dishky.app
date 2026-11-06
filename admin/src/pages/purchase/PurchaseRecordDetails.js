/** PurchaseRecordDetails.js — details pages of the Purchase module (suppliers, orders, receipts, returns, invoices, payments). */
import React from "react";
import RecordView from "../pi-shared/RecordView";
import { Btn, errText } from "../pi-shared/InvUi";
import { useToast } from "../../useToast";
import { downloadInvoicePdf, downloadReceiptPdf } from "../pi-shared/docPdf";
import SupplierMemos from "./SupplierMemos";
import SupplierCredit from "./SupplierCredit";

export const KINDS = {
  suppliers: { api: "/inventory/suppliers", list: "/purchase/suppliers", title: "Supplier", no: "code" },
  orders: { api: "/purchase/orders", list: "/purchase/orders", title: "Purchase order", no: "poNo" },
  receipts: { api: "/receiving/grns", list: "/purchase/receipts", title: "Goods receipt", no: "grnNo" },
  returns: { api: "/receiving/returns", list: "/purchase/returns", title: "Supplier return", no: "returnNo" },
  invoices: { api: "/finance/invoices", list: "/purchase/invoices", title: "Supplier invoice", no: "docNo" },
  payments: { api: "/finance/payments", list: "/purchase/payments", title: "Supplier payment", no: "payNo" },
};

function DownloadBtn({ doc, kind }) {
  const { toast } = useToast();
  const run = () => (kind === "invoices" ? downloadInvoicePdf(doc) : downloadReceiptPdf(doc)).catch((e) => toast.error(errText(e, "Could not create the PDF")));
  return <Btn type="button" kind="plain" onClick={run}>Download PDF</Btn>;
}

export default function PurchaseRecordDetails({ kind }) {
  return (
    <RecordView
      kind={kind} cfg={KINDS[kind]}
      headerActions={kind === "invoices" || kind === "receipts" ? (doc) => <DownloadBtn doc={doc} kind={kind} /> : undefined}
      extras={kind === "suppliers" ? (doc) => <><SupplierCredit supplier={doc} /><SupplierMemos supplier={doc} /></> : undefined}
    />
  );
}
