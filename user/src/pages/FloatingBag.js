import "./FloatingBag.css";
import "./attender/Attender.css";
import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import minimizeIcon from "../assets/icons/minimize.png";
import { placeOrder } from "../components/placeOrder.js";
import PrinterReceipt from "../components/PrinterReceipt.js";
import OrderProgressBar from "./OrderProgressBar.js";
import cartIcon from "../assets/icons/cart.png";
import { handleImgFallback } from "../App";
import Button3D from "./shared/Button3D.js";
import { groupBagItems, getUnitPrice, getLineTotal, getBagSubtotal, getBagItemCount } from "./shared/bagUtils.js";
import { RED_EDGE_GRADIENT } from "./shared/styles.js";
import { useToast } from "../components/Usetoast.js";

const VIEW_BTN_EDGE_STYLE = RED_EDGE_GRADIENT;

const FloatingBag = ({
  bag,
  increaseQty,
  decreaseQty,
  isOpen,
  setIsOpen,
  attenderTab = null,        // { tableNo, guest } while an attender is taking this bag's order
  onAttenderExpired
}) => {
  const [closing, setClosing] = useState(false);
  const [shake, setShake] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const safeBag = Array.isArray(bag) ? bag : [];
  const [orderForReceipt, setOrderForReceipt] = useState(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);

  const groupedBag = groupBagItems(safeBag);
  const totalItems = getBagItemCount(safeBag);
  const subtotal = getBagSubtotal(groupedBag);
  const total = Number(subtotal.toFixed(2));

  const prevCountRef = useRef(totalItems);

  useEffect(() => {
    if (totalItems > prevCountRef.current) {
      setShake(true);
    }

    prevCountRef.current = totalItems;
  }, [totalItems]);

  if (location.pathname === "/" || location.pathname === "/thank-you" || location.pathname === "/scan-table")
    return null;

  const minimizeSheet = () => {
    setClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setClosing(false);
    }, 250);
  };

  return (
    <>
      {/* Floating pill */}
      <Button3D
        id="floating-bag-btn"
        className={`floating-btn ${shake ? "shake" : ""}`}
        onClick={() => setIsOpen(true)}
      >
        <img src={cartIcon} style={{ height: "12px", width: "12px", filter: "var(--invert-filter)" }} alt="cart" /> {totalItems}
      </Button3D>

      {isOpen && (
        <div className={`bag-sheet ${closing ? "closing" : ""}`}>
          {/* Header */}
          <div className="bag-title-row">
            <h3>
              Ordered Dishes
              {attenderTab && (
                <span className="at-bag-table">
                  Table {attenderTab.tableNo}{attenderTab.guest ? ` · ${attenderTab.guest}` : ""}
                </span>
              )}
            </h3>
            <Button3D
              className="home-btn home-icon"
              onClick={minimizeSheet}
              edgeStyle={VIEW_BTN_EDGE_STYLE}
              frontStyle={{ backgroundColor: "var(--color-red)" }}
            >
              <img src={minimizeIcon} alt="" className="minimize-icon" style={{ filter: "var(--invert-filter)" }} />
            </Button3D>
          </div>

          {/* Items */}
          <div className="bag-items" id="bag-items-container">
            {groupedBag.map((item, i) => (
              <div
                key={`${item.id}__${item.customizationKey || "base"}__${item.selectedSize}`}
                className="bag-item-row"
                data-dish-id={item.id}
                data-custom-key={item.customizationKey || ""}
              >
                <img
                  src={item.image}
                  alt=""
                  className={item.__pendingImage ? "pending-img" : "visible-img"}
                  onError={handleImgFallback}
                />

                <div className="bag-item-info">
                  <div className="bag-item-name">{item.name}</div>
                  <div className="bag-item-price">
                    {item.appliedOffer ? (
                      <>
                        <span className="bag-item-price-offer">₹{getUnitPrice(item).toFixed(2)}</span>
                        <span className="bag-item-price-original">₹{Number(item.appliedOffer.originalPrice).toFixed(2)}</span>
                      </>
                    ) : (
                      <>₹{getUnitPrice(item).toFixed(2)}</>
                    )}
                  </div>
                </div>

                <div className="bag-qty">
                  <button onClick={() => decreaseQty(item.indices[0])}>−</button>
                  <span>{item.quantity}</span>
                  <button onClick={() => increaseQty(item.indices[0])}>+</button>
                </div>

                <div className="bag-item-total">
                  ₹{getLineTotal(item).toFixed(2)}
                </div>
              </div>
            ))}

            {bag.length === 0 && (
              <p style={{ textAlign: "center", marginTop: 20 }}>
                Your bag is empty
              </p>
            )}
          </div>

          {/* Summary */}
          <div className="bag-summary">
            <div className="summary-row">
              <span>Subtotal</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>

            <div className="summary-total">
              <span>Total ({totalItems} items)</span>
              <span className="floating-total-price">₹{total}</span>
            </div>
          </div>

          {/* CTA */}
          <Button3D
            className="btn-3d red"
            disabled={bag.length === 0 || isPlacingOrder}
            onClick={async () => {
              setIsPlacingOrder(true);
              setOrderComplete(false);
              try {
                const newOrder = await placeOrder(bag, attenderTab ? { attenderTable: attenderTab } : undefined);
                setOrderComplete(true);
                // let the bar visibly hit 100% before handing off to the receipt
                await new Promise((resolve) => setTimeout(resolve, 300));
                setIsOpen(false);
                setOrderForReceipt(newOrder);   // 👈 show printer
              } catch (err) {
                console.error(err);
                if (attenderTab && err?.response?.data?.code === "ATTENDER_SESSION_EXPIRED") {
                  // Tables and bags are kept; they just need to sign in again.
                  toast.error("Your attender session expired. Please sign in again.");
                  setIsOpen(false);
                  onAttenderExpired?.();
                } else {
                  toast.error("Couldn't place your order. Please try again.");
                }
              } finally {
                setIsPlacingOrder(false);
                setOrderComplete(false);
              }
            }}
          >
            {isPlacingOrder ? "Placing Order" : "Place Order"}
          </Button3D>
        </div>
      )}
      {isPlacingOrder && (
        <div className="order-progress-overlay">
          <OrderProgressBar complete={orderComplete} />
        </div>
      )}
      {orderForReceipt && (
        <PrinterReceipt
          order={orderForReceipt}
          onDone={() => {
            setOrderForReceipt(null);
            navigate("/thank-you", { replace: true });
          }}
        />
      )}
    </>
  );
};

export default FloatingBag;