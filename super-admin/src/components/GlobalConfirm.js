/**
 * GlobalConfirm - the single "are you sure?" modal behind every delete and sensitive change.
 * api.js asks it (through confirmGate) before sending such a request. If the page already showed its own confirmation
 * dialog, the click on that dialog's Confirm button is noticed and the request goes straight through - nobody is asked twice.
 */
import React, { useEffect, useRef, useState } from "react";
import ConfirmDialog from "./ConfirmDialog.js";
import { markCancelled, markConfirmClick, setConfirmHandler } from "../confirmGate.js";

export default function GlobalConfirm() {
  const [ask, setAsk] = useState(null);
  const pending = useRef(null);

  useEffect(() => {
    setConfirmHandler((info) => new Promise((resolve) => { pending.current = resolve; setAsk(info); }));
    const onClick = (e) => {
      const btn = e.target.closest && e.target.closest("button");
      if (!btn) return;
      const inConfirm = btn.closest(".confirm-card, [role='alertdialog']");
      const inModal = btn.closest(".modal, [role='dialog'], .admin-modal");
      const text = (btn.textContent || "").trim();
      if (inConfirm && !/^(cancel|no|close|\u00d7|\u2715)/i.test(text)) markConfirmClick();
      else if (inModal && /^(yes|confirm|delete|remove|approve|reopen|reset)/i.test(text)) markConfirmClick();
    };
    document.addEventListener("click", onClick, true);
    return () => { document.removeEventListener("click", onClick, true); setConfirmHandler(null); };
  }, []);

  const finish = (ok) => { if (!ok) markCancelled(); const r = pending.current; pending.current = null; setAsk(null); r && r(ok); };
  if (!ask) return null;
  return <ConfirmDialog open title={ask.title} message={ask.message} confirmLabel={ask.confirmLabel} onConfirm={() => finish(true)} onCancel={() => finish(false)} />;
}
