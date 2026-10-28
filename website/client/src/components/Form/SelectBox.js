import React, { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import "./SelectBox.css";

/**
 * Styled dropdown (a native <select> can't be themed on dark forms).
 * options: string[]. Keyboard: Arrow keys / Enter / Escape / Home / End, type-to-open.
 */
export default function SelectBox({ id, value, onChange, options, placeholder = "Select", dark = false, invalid = false, "aria-label": ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrap = useRef(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const show = () => { setActive(Math.max(0, options.indexOf(value))); setOpen(true); };
  const pick = (o) => { onChange(o); setOpen(false); };

  const onKey = (e) => {
    if (e.key === "Escape") { setOpen(false); return; }
    if (["ArrowDown", "ArrowUp", "Enter", " ", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      if (!open) { show(); return; }
      if (e.key === "ArrowDown") setActive((a) => (a + 1) % options.length);
      else if (e.key === "ArrowUp") setActive((a) => (a - 1 + options.length) % options.length);
      else if (e.key === "Home") setActive(0);
      else if (e.key === "End") setActive(options.length - 1);
      else if (active >= 0) pick(options[active]);
    }
  };

  return (
    <div ref={wrap} className={`dk-select ${dark ? "dk-select--dark" : ""}`}>
      <button
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        className={`input ${dark ? "input-dark" : ""} dk-select__btn ${value ? "" : "is-empty"}`}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKey}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown size={18} aria-hidden="true" className={`dk-select__chev ${open ? "is-open" : ""}`} />
      </button>
      {open && (
        <ul id={listId} role="listbox" className="dk-select__list">
          {options.map((o, i) => (
            <li
              key={o}
              role="option"
              aria-selected={o === value}
              className={`dk-select__opt ${i === active ? "is-active" : ""} ${o === value ? "is-selected" : ""}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(o)}
            >
              <span>{o}</span>
              {o === value && <Check size={16} aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
