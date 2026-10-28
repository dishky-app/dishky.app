import { useEffect, useRef, useState } from "react";
import "./OrderProgressBar.css";

/**
 * Simulated progress bar for the window between "Place Order" click and the
 * printer receipt animation. We don't know the real request duration ahead
 * of time, so progress eases toward ~90% while the request is in flight,
 * then the parent flips `complete` to true once the order actually
 * resolves, which snaps the bar to 100% before handing off to the receipt.
 *
 * Props:
 *  - complete: boolean — set true once placeOrder() has resolved
 *  - label: string — status text shown above the bar
 */
const OrderProgressBar = ({ complete, label = "Order Processing" }) => {
  const [progress, setProgress] = useState(4);
  const rafRef = useRef(null);

  useEffect(() => {
    if (complete) {
      setProgress(100);
      return;
    }

    let last = performance.now();

    const tick = (now) => {
      const dt = now - last;
      last = now;

      setProgress((p) => {
        if (p >= 90) return p; // hold here until `complete` snaps us to 100
        // ease-out: faster early, slower as it approaches the ceiling
        const remaining = 90 - p;
        const step = (remaining / 90) * (dt / 18);
        return Math.min(90, p + step);
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [complete]);

  return (
    <div className="order-progress-wrap" role="status" aria-live="polite">
      <div className="order-progress-track">
        <div
          className={`order-progress-fill ${complete ? "is-complete" : ""}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="order-progress-label">{label}</span>
    </div>
  );
};

export default OrderProgressBar;