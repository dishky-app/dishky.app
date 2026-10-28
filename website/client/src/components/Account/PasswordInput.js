import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/** Password box with a show / hide (eye) toggle at the right. Accepts every normal <input> prop; `dark` for dark forms. */
export default function PasswordInput({ className = "input", dark = false, style, ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        className={`absolute right-1.5 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center !min-h-0 rounded-full transition-colors ${
          dark ? "text-cream/60 hover:bg-white/10 hover:text-cream" : "text-ink/50 hover:bg-ink/5 hover:text-ink"
        }`}
      >
        {show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
      <input
        maxLength={100}
        {...props}
        type={show ? "text" : "password"}
        className={`${className}${dark ? " input-dark" : ""}`}
        style={{ paddingRight: "3rem", ...style }}
        onCopy={(e) => e.preventDefault()}
        onCut={(e) => e.preventDefault()}
      />
    </div>
  );
}
