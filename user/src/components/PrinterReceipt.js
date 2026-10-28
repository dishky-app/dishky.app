import "./PrinterReceipt.css";
import { useRef } from "react";
import { fmtDate, fmtTime } from "../utils/dateUtils";
import { resolved } from "../tenant";

const LETTERS = "Printing...".split("");

const PrinterReceipt = ({ order, onDone }) => {
  const overlayRef = useRef(null);

  const handleDone = () => {
    if (overlayRef.current) overlayRef.current.classList.add("pr-hiding");
    setTimeout(onDone, 420);
  };

  if (!order) return null;

  const {
    id,
    tableNo,
    mode,
    date,
    time,
    userName,
    attenderName,
    appended,
    items = [],
    totalAmount,
    totalWithGST,
  } = order;

  const formattedDate = date ? fmtDate(date) : fmtDate(new Date().toISOString());

  const formattedTime = (() => {
    if (!time) return "";
    const match = String(time).match(/^(\d{1,2}):(\d{2})/);
    if (!match) return time;
    return fmtTime(`${match[1]}:${match[2]}`);
  })();

  const subTotal = totalWithGST?.subTotal ?? totalAmount ?? 0;
  const cgst = totalWithGST?.cgst ?? 0;
  const sgst = totalWithGST?.sgst ?? 0;
  const total = totalWithGST?.total ?? totalAmount ?? 0;

  return (
    <div className="pr-overlay" ref={overlayRef}>
      <div className="pr-body">
        <div className="pr-slide-in">

          <div className="printer-receipt-container printing">

            {/* ── HEADER: printer graphic, fixed at top via flex ── */}
            <header className="printer-receipt-header">
              <div className="printer" />

              <div className="printer-display">
                <span className="printer-message">Click to print</span>
                <div className="letter-wrapper">
                  {LETTERS.map((ch, i) => (
                    <span className="letter" key={i}>{ch}</span>
                  ))}
                </div>
              </div>
            </header>

            {/* ── BILL: only scrollable area ── */}
            <main className="printer-receipt-bill">
              <div className="receipt-wrapper">
                <div className="receipt">

                  {/* Header */}
                  <div className="receipt-header">
                    <div>
                      {resolved.restaurantName || ""}<br />
                      {resolved.venueName || ""}
                    </div>
                    <div className="logo">🍽</div>
                  </div>

                  {/* Sub-header */}
                  <div className="receipt-subheader">
                    <div>
                      Order #{id}{appended ? " (running bill)" : ""}<br />
                      {tableNo ? `Table: ${tableNo}  |  ` : ""}
                      {formattedDate} – {formattedTime}<br />
                      Mode: {mode === "dine in" ? "Dine In" : "Take Away"}
                      {attenderName && (
                        <><br />Attender: {attenderName}</>
                      )}
                      {userName && userName !== "Guest" && (
                        <><br />Customer: {userName}</>
                      )}
                    </div>
                  </div>

                  {/* Items table */}
                  <table className="receipt-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, i) => (
                        <tr key={i}>
                          <td>{item.dishName}</td>
                          <td>{item.quantity}x</td>
                          <td>{Number(item.totalPrice).toFixed(2)}</td>
                        </tr>
                      ))}

                      <tr className="receipt-subtotal">
                        <td colSpan={2}>Subtotal</td>
                        <td>{Number(subTotal).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td colSpan={2}>CGST (2.5%)</td>
                        <td>{Number(cgst).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td colSpan={2}>SGST (2.5%)</td>
                        <td>{Number(sgst).toFixed(2)}</td>
                      </tr>
                      <tr className="receipt-total">
                        <td colSpan={2}>Total</td>
                        <td>{Number(total).toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="receipt-message">Thank you for your order!</div>
                </div>
              </div>
            </main>

            {/* ── FOOTER: Done button, fixed at bottom via flex ── */}
            <footer className="printer-receipt-footer">
              <div className="pr-done-btn-wrap">
                <button className="btn-3d green" onClick={handleDone}>
                  <span className="shadow" />
                  <span className="edge" />
                  <span className="front">✓ Done</span>
                </button>
              </div>
            </footer>

          </div>

        </div>
      </div>
    </div>
  );
};

export default PrinterReceipt;