
import "./AnimatedPrice.css";

const DIGIT_HEIGHT = 28;

function Digit({ value }) {
  return (
    <div
      className="digit-column"
      style={{
        transform: `translateY(${-value * DIGIT_HEIGHT}px)`
      }}
    >
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="digit">
          {i}
        </div>
      ))}
    </div>
  );
}

export default function AnimatedPrice({ value }) {
  const safeValue =
    typeof value === "number" && !isNaN(value) ? value : 0;

  const digits = safeValue.toString().padStart(3, "0").split("");

  return (
    <div className="price-odometer">
      <span className="currency">₹</span>
      {digits.map((d, i) => (
        <div key={i} className="digit-window">
          <Digit value={Number(d)} />
        </div>
      ))}
    </div>
  );
}
