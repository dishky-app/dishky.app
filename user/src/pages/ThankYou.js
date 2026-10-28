import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import "./ThankYou.css";
import { AnimatePresence, motion } from "framer-motion";
import Button3D from "./shared/Button3D";
import { groupBagItems, sizeNotesBagKey, stripCustomizedPrefix } from "./shared/bagUtils";
import { endCustomerSession } from "./customerSession";
import { handleImgFallback } from "../App";

const AUTO_RESET_MS = 60000; // 1 minute

const ThankYou = ({ bag, setBag, setIsBagOpen, isAttender = false }) => {
  const navigate = useNavigate();
  const rawTableNo = localStorage.getItem("tableNo");

  const tableNo =
    rawTableNo && rawTableNo.trim() !== ""
      ? rawTableNo
      : null;

  const mode = tableNo ? "dine in" : "take away";

  // Attender mode: the order is already placed, so empty this table's bag right away
  // (the attender may switch to another table while this page is open) and keep a
  // snapshot just for the summary below.
  const [orderedBag] = useState(bag);
  const shownBag = isAttender ? orderedBag : bag;
  useEffect(() => {
    if (isAttender) setBag([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isBagEmpty = shownBag.length === 0;

  useEffect(() => {
    confetti({
      particleCount: 200,
      spread: 80,
      startVelocity: 55
    });
  }, []);

  useEffect(() => {
    // Customers who arrived via a table QR scan (tableNo present) are
    // mid-visit at their table — auto-logging them out after a minute
    // would sign them out of their own session while they're still
    // dining in, forcing them to log back in for their next order.
    // Still clear the bag and return home for them; just skip the
    // session logout. Take-away customers (no tableNo) keep the
    // original full auto-reset-and-logout behavior.
    const timer = setTimeout(() => {
      if (isAttender) {
        // Never clear the bag here: the active table may no longer be the one just ordered.
        navigate("/attender/tables");
        return;
      }
      setBag([]);
      setIsBagOpen(false);
      if (!tableNo) endCustomerSession();
      navigate("/");
    }, AUTO_RESET_MS);

    return () => clearTimeout(timer);
  }, [navigate, setBag, setIsBagOpen, tableNo, isAttender]);

  const getDisplayName = (item) =>
    item?.isCustomized ? stripCustomizedPrefix(item.name) : (item?.name || "");

  const groupedBag = groupBagItems(shownBag, sizeNotesBagKey);

  const handleOrderAnother = () => {
    navigate("/categories");
    if (!isAttender) setBag([]);
  };

  const handleLogout = () => {
    if (isAttender) {
      navigate("/attender/tables");
      return;
    }
    setBag([]);
    if (!tableNo) endCustomerSession();
    navigate("/");
  };

  return (
    <div
      className={"thankyou-page"}
    >
      <div className="thankyou-card">
        <h1 className="thankyou-title">
          Thank You for Your Order!
        </h1>

        <h5 className="thankyou-message">
          Your order has been successfully placed and will be ready for <br />
          <span className="table-number">
            {mode === "dine in" ? "DINE IN" : "TAKE AWAY"}
          </span>

          {tableNo && (
            <>
              {" "}and delivered to{" "}
              <span className="table-number">
                TABLE NUMBER #{tableNo}
              </span>
            </>
          )}

          <br />
          within <span className="time">15–20 minutes</span>.
        </h5>

        {!isBagEmpty && (
          <table className="order-table">
            <thead>
              <tr>
                <th></th>
                <th>Dish</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {groupedBag.map((item, index) => (
                  <motion.tr
                    key={item.id || index}
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -80 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                  >
                    <td>
                      <img
                        src={item.image}
                        alt=""
                        className="order-img"
                        loading="lazy"
                        decoding="async"
                        onError={handleImgFallback}
                      />
                    </td>

                    <td>
                      <div className="thanks-dish-name">
                        {getDisplayName(item)}
                      </div>

                      {item.notes && (
                        <div className="dish-notes">
                          {item.notes.length > 100
                            ? item.notes.slice(0, 30) + "…"
                            : item.notes}
                        </div>
                      )}
                    </td>

                    <td>{item.quantity}</td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        )}

        <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "16px" }}>
          <Button3D className="btn-3d green" onClick={handleOrderAnother}>
            Order Another
          </Button3D>

          <Button3D className="btn-3d red" onClick={handleLogout}>
            {isAttender ? "All Tables" : "Back to Home"}
          </Button3D>
        </div>
      </div>
    </div>
  );
};

export default ThankYou;