/**
 * GlobalConfirm - the single "are you sure?" modal behind every delete and sensitive change.
 * api.js asks it (through utils/confirmGate) before sending such a request. If the page already showed its own
 * confirmation dialog, the click on that dialog's Confirm button is noticed and the request goes straight through.
 */
import React, { useEffect, useRef, useState } from "react";
import ConfirmDialog from "../pages/shared/ConfirmDialog";
import { markCancelled, markConfirmClick, setConfirmHandler } from "../utils/confirmGate";

export default function GlobalConfirm() {
  const [ask, setAsk] = useState(null);
  const pending = useRef(null);

  useEffect(() => {
    setConfirmHandler((info) => new Promise((resolve) => { pending.current = resolve; setAsk(info); }));
    const onClick = (e) => {
      const btn = e.target.closest && e.target.closest("button, .btn-3d");
      if (!btn) return;
      const inConfirm = btn.closest(".confirm-box, .confirm-card, [role='alertdialog']");
      const text = (btn.textContent || "").trim();
      if (inConfirm && !/^(cancel|no|close|\u00d7|\u2715)/i.test(text)) markConfirmClick();
    };
    document.addEventListener("click", onClick, true);
    return () => { document.removeEventListener("click", onClick, true); setConfirmHandler(null); };
  }, []);

  const finish = (ok) => { if (!ok) markCancelled(); const r = pending.current; pending.current = null; setAsk(null); r && r(ok); };
  return <ConfirmDialog open={!!ask} title={ask?.title} message={ask?.message} confirmLabel={ask?.confirmLabel} onConfirm={() => finish(true)} onCancel={() => finish(false)} />;
}
