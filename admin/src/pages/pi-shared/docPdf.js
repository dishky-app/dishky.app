/**
 * docPdf.js — downloadable PDFs for supplier invoices and goods receipts (receipts = goods received notes).
 * Built in the browser from the record the server already sent, so nothing is recalculated here.
 * jsPDF is loaded on first use to keep it out of the main bundle.
 */
import { dateShort, dateTime } from "./InvUi";

// jsPDF's built-in fonts have no ₹ glyph, so amounts are written "Rs."
const rs = (n) => `Rs. ${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const q = (n) => (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
const label = (s) => String(s || "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

async function start(title, no, meta, venueName) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold").setFontSize(18).text(title, 40, 50);
  doc.setFontSize(11).text(no, W - 40, 50, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(100);
  if (venueName) doc.text(venueName, 40, 66);
  doc.setTextColor(0);
  let y = 86;
  meta.filter(([, v]) => v !== undefined && v !== null && v !== "").forEach(([k, v], i) => {
    const x = i % 2 === 0 ? 40 : W / 2 + 10;
    if (i % 2 === 0 && i > 0) y += 14;
    doc.setFont("helvetica", "bold").text(`${k}:`, x, y);
    doc.setFont("helvetica", "normal").text(String(v), x + 78, y, { maxWidth: W / 2 - 100 });
  });
  return { doc, autoTable, y: y + 22, W };
}

function footer(doc, W) {
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8).setTextColor(130).text(`Generated ${dateTime(new Date())} · page ${i} of ${pages}`, W / 2, doc.internal.pageSize.getHeight() - 20, { align: "center" });
  }
}

export async function downloadInvoicePdf(inv, venueName) {
  const { doc, autoTable, y, W } = await start("Supplier Invoice", inv.docNo, [
    ["Supplier", inv.supplierName], ["Supplier invoice", inv.invoiceNo], ["GSTIN", inv.supplierGstin], ["Invoice date", dateShort(inv.invoiceDate)],
    ["Due date", inv.dueDate ? dateShort(inv.dueDate) : ""], ["Purchase order", inv.poNo], ["Status", label(inv.status)], ["Payment", inv.paymentStatus ? label(inv.paymentStatus) : ""],
  ], venueName);
  autoTable(doc, {
    startY: y, theme: "grid", styles: { fontSize: 8 }, headStyles: { fillColor: [55, 65, 81] },
    head: [["#", "Item", "Qty", "Unit price", "Disc %", "GST %", "Taxable", "Tax", "Total"]],
    body: inv.lines.map((l, i) => [i + 1, l.itemName, `${q(l.qty)} ${l.unit || ""}`, rs(l.unitPrice), q(l.discountPct), q(l.gstRate), rs(l.taxable), rs(l.tax), rs(l.total)]),
    columnStyles: { 0: { cellWidth: 22 }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" }, 8: { halign: "right" } },
  });
  const t = inv.totals || {};
  const rows = [["Subtotal", t.subtotal], ["Discount", t.discount], ["Taxable value", t.taxable], ["GST", t.tax]];
  if (inv.taxSplit && inv.taxSplit.type === "intra") rows.push(["  CGST", inv.taxSplit.cgst], ["  SGST", inv.taxSplit.sgst]); else if (inv.taxSplit) rows.push(["  IGST", inv.taxSplit.igst]);
  if (t.freight) rows.push(["Freight", t.freight]);
  if (t.other) rows.push(["Other charges", t.other]);
  if (t.roundOff) rows.push(["Round off", t.roundOff]);
  rows.push(["Grand total", t.grandTotal]);
  if (inv.creditsApplied) rows.push(["Credit notes applied", -inv.creditsApplied]);
  if (inv.paid !== undefined) rows.push(["Paid", inv.paid], ["Outstanding", inv.outstanding]);
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 12, theme: "plain", styles: { fontSize: 9 }, tableWidth: 220, margin: { left: W - 40 - 220 },
    body: rows.filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, rs(v)]), columnStyles: { 1: { halign: "right" } },
    didParseCell: (d) => { if (["Grand total", "Outstanding"].includes(d.row.raw[0])) d.cell.styles.fontStyle = "bold"; },
  });
  if (inv.notes) doc.setFontSize(9).text(`Notes: ${inv.notes}`, 40, doc.lastAutoTable.finalY + 24, { maxWidth: W - 80 });
  footer(doc, W);
  doc.save(`${inv.docNo}.pdf`);
}

export async function downloadReceiptPdf(grn, venueName) {
  const { doc, autoTable, y, W } = await start("Goods Receipt Note", grn.grnNo, [
    ["Supplier", grn.supplierName], ["Purchase order", grn.poNo], ["Received on", dateShort(grn.receivedDate)], ["Received by", grn.receivedByName],
    ["Delivery note", grn.deliveryNoteNo], ["Supplier invoice", grn.supplierInvoiceNo], ["Vehicle", grn.vehicleNo], ["Status", label(grn.status)],
  ], venueName);
  autoTable(doc, {
    startY: y, theme: "grid", styles: { fontSize: 8 }, headStyles: { fillColor: [55, 65, 81] },
    head: [["#", "Item", "Ordered", "Delivered", "Accepted", "Held", "Rejected", "Batch", "Expiry", "Value"]],
    body: grn.lines.map((l, i) => [i + 1, l.itemName, `${q(l.ordered)} ${l.unit}`, q(l.delivered), q(l.accepted), q(l.quarantined), q(l.rejected), l.batchNo || "—", l.expiryDate ? dateShort(l.expiryDate) : "—", rs(l.value)]),
    columnStyles: { 0: { cellWidth: 22 }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" }, 9: { halign: "right" } },
  });
  const issues = grn.lines.filter((l) => l.reason).map((l) => `${l.itemName}: ${l.reason}`);
  let yy = doc.lastAutoTable.finalY + 18;
  if (issues.length) { doc.setFontSize(9).setFont("helvetica", "bold").text("Rejection / hold reasons", 40, yy); doc.setFont("helvetica", "normal").text(issues, 40, yy + 13, { maxWidth: W - 80 }); yy += 13 + issues.length * 12 + 8; }
  if (grn.notes) doc.setFontSize(9).text(`Notes: ${grn.notes}`, 40, yy, { maxWidth: W - 80 });
  doc.setFontSize(9).text("Received by: ____________________", 40, doc.internal.pageSize.getHeight() - 60);
  doc.text("Checked by: ____________________", W - 40, doc.internal.pageSize.getHeight() - 60, { align: "right" });
  footer(doc, W);
  doc.save(`${grn.grnNo}.pdf`);
}
