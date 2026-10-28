/**
 * SupportDetails.js  —  Dishky Admin Panel
 * Single support-ticket page, laid out like MemoDetails.js:
 * details-header (back · title · status badges) → action bar (gated by
 * what the server allows) → progress tracker → summary cards → text
 * sections → attachment cards → timeline, with the actions that need
 * input (attach files, confirm the fix, reopen) in animated modals.
 * The conversation with Dishky's team lives in the floating chat window.
 */

import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import api from "../api";
import socket from "../socket";
import closeIcon from "../icon/close-icon.png";
import { allowTextInput } from "../App";
import { fmtDateTime } from "../utils/dateUtils";
import { useToast } from "../useToast";
import Button3D from "../components/Button3D";
import useAnimatedModal from "../hooks/useAnimatedModal";
import PageLoader from "../components/PageLoader";
import FloatingChat from "../components/FloatingChat";
import {
  errMsg, bytes, readFile, supportStatusClass, supportPriorityClass,
  PROGRESS_STAGES, stageIndex, FilePicker,
} from "./SupportShared";

import "./IngredientDetails.css";
import "./Support.css";
import "./SupportDetails.css";
import "./ModalCSS.css";

const fileIcon = (name = "") => (/\.(png|jpe?g|webp|gif)$/i.test(name) ? "📷" : /\.pdf$/i.test(name) ? "📄" : "📎");

export function SupportDetail() {
  const { ticketId } = useParams();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [d, setD] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  /* ── Modals ────────────────────────────────────────────────── */
  const attachModal = useAnimatedModal("support-attach");
  const [files, setFiles] = useState([]);

  const confirmModal = useAnimatedModal("support-confirm");
  const [confirmNote, setConfirmNote] = useState("");

  const reopenModal = useAnimatedModal("support-reopen");
  const [reopenReason, setReopenReason] = useState("");

  const load = useCallback(async () => {
    try {
      setD((await api.get(`/support/tickets/${ticketId}`)).data);
    } catch (e) {
      if (e?.response?.status === 404) setNotFound(true);
      else toast.error(errMsg(e, "Failed to load ticket"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  useEffect(() => { load(); api.get("/support/meta").then((r) => setMeta(r.data)).catch(() => {}); }, [load]);
  useEffect(() => {
    const on = (p) => { if (!p || p.ticketId === ticketId) load(); };
    socket.on("support:ticket", on);
    return () => socket.off("support:ticket", on);
  }, [load, ticketId]);

  /** Runs an API call with the busy flag + toasts; resolves true when it worked. */
  const run = async (fn, okMsg) => {
    setBusy(true);
    try { await fn(); if (okMsg) toast.success(okMsg); await load(); return true; }
    catch (e) { toast.error(errMsg(e, "Something went wrong")); return false; }
    finally { setBusy(false); }
  };
  const act = (action, extra, okMsg) => run(() => api.post(`/support/tickets/${ticketId}/action`, { action, ...extra }), okMsg);

  const download = async (att) => {
    try {
      const res = await api.get(`/support/tickets/${ticketId}/attachments/${att.id}`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a"); a.href = url; a.download = att.name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) { toast.error("Could not download the file"); }
  };

  const submitAttach = async () => {
    if (!files.length) { toast.error("Select at least one file"); return; }
    const ok = await run(async () => {
      await api.post(`/support/tickets/${ticketId}/attachments`, { attachments: await Promise.all(files.map(readFile)) });
    }, "Attachment added");
    if (ok) attachModal.close(() => setFiles([]));
  };

  const submitConfirm = async () => {
    const ok = await act("reporter_confirm", { message: confirmNote }, "Thanks for confirming");
    if (ok) confirmModal.close(() => setConfirmNote(""));
  };

  const submitReopen = async () => {
    if (reopenReason.trim().length < 3) { toast.error("Tell us what is still wrong (at least 3 characters)"); return; }
    const ok = await act("reporter_reopen", { reason: reopenReason }, "Ticket reopened");
    if (ok) reopenModal.close(() => setReopenReason(""));
  };

  if (loading) return <div className="details-container"><PageLoader fill label="Loading ticket…" /></div>;
  if (notFound || !d) {
    return (
      <div className="details-container">
        <div className="details-header">
          <button type="button" className="back-btn" aria-label="Back to Support & Complaints" onClick={() => navigate("/support")} />
          <h2>Ticket Not Found</h2>
        </div>
      </div>
    );
  }

  const t = d.ticket;
  const has = (a) => d.actions.includes(a);
  const closed = t.status === "closed";
  const catLabel = meta?.categories.find((c) => c.value === t.category)?.label || t.category;
  const canAttach = d.canWrite && !!meta && !closed;
  const canConfirm = d.canWrite && has("reporter_confirm");
  const canReopen = d.canWrite && has("reporter_reopen");
  const cur = stageIndex(t.status);

  // Conversation → floating chat. Messages from Dishky's team are "them"; the restaurant's own are "me".
  const chatMessages = d.comments.map((c) => ({
    id: c.id, body: c.body, at: c.at,
    side: c.author.mine ? "me" : "them",
    author: c.author.mine ? "You" : "Dishky Support",
  }));
  const sendChat = async (text) => {
    try {
      if (has("reporter_respond")) await api.post(`/support/tickets/${ticketId}/action`, { action: "reporter_respond", message: text });
      else await api.post(`/support/tickets/${ticketId}/comments`, { body: text });
      await load();
    } catch (e) { throw new Error(errMsg(e, "Could not send your message")); }
  };

  const Item = ({ label, children }) => (
    <div className="sp-summary-item"><div className="sp-summary-label">{label}</div><div className="sp-summary-value">{children}</div></div>
  );
  const textSection = (label, v) => v ? (
    <div className="section">
      <div className="section-title"><span>{label}</span></div>
      <p className="sp-text">{v}</p>
    </div>
  ) : null;

  return (
    <div className="details-container">
      {/* HEADER */}
      <div className="details-header">
        <button type="button" className="back-btn" aria-label="Back to Support & Complaints" onClick={() => navigate("/support")} />
        <div>
          <h2>{t.ticketId} — {t.title}</h2>
          <div className="sp-header-meta">
            {t.priority && <span className={supportPriorityClass(t.priority)}>{t.priority === "critical" ? "⚠ " : ""}{t.priority}</span>}
            <span className={supportStatusClass(t.status)}>{t.statusLabel}</span>
          </div>
        </div>
      </div>

      <div className="details-body" style={{ display: "flex", flexDirection: "column", gap: 22 }}>

        {/* ACTION BAR (only what the server allows for this ticket) */}
        {(canAttach || canConfirm || canReopen) && (
          <div className="sp-action-bar">
            {canAttach && <Button3D variant="cancel" onClick={() => attachModal.open()}>Add Attachment</Button3D>}
            {canReopen && <Button3D variant="danger" onClick={() => reopenModal.open()}>Still Not Fixed — Reopen</Button3D>}
            {canConfirm && <Button3D onClick={() => confirmModal.open()}>It&apos;s Fixed — Confirm</Button3D>}
          </div>
        )}

        {t.awaitingYou && <div className="sp-banner">Dishky&apos;s team needs more information from you. Open the chat (bottom-right) to reply.</div>}

        {/* PROGRESS */}
        <div className="section">
          <div className="section-title"><span>Progress</span></div>
          <div className="sp-stage-tracker">
            {PROGRESS_STAGES.map((label, i) => {
              const cls = i < cur ? " done" : i === cur ? " current" : "";
              return (
                <div key={label} className={`sp-stage${cls}`}>
                  <span className="sp-stage-dot">{i < cur ? "✓" : i + 1}</span>
                  <span className="sp-stage-label">{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ISSUE */}
        <div className="section">
          <div className="section-title"><span>Issue</span></div>
          <p className="sp-text">{t.description || t.title}</p>
          <div className="sp-summary-grid" style={{ marginTop: 10 }}>
            <Item label="Category">{catLabel || "—"}</Item>
            <Item label="Module">{t.module || "—"}</Item>
            <Item label="Branch">{t.branchName || "—"}</Item>
            <Item label="Reported By">{t.reporter?.name || "—"}</Item>
            <Item label="Created At">{fmtDateTime(t.createdAt)}</Item>
            <Item label="Last Update">{fmtDateTime(t.updatedAt)}</Item>
          </div>
        </div>

        {textSection("Expected Behaviour", t.expected)}
        {textSection("Actual Behaviour", t.actual)}
        {textSection("Steps to Reproduce", t.steps)}
        {textSection("Business Impact", t.impact)}

        {/* ATTACHMENTS */}
        <div className="section">
          <div className="section-title"><span>Attachments</span></div>
          {t.attachments.length === 0 ? (
            <p>No attachments.</p>
          ) : (
            <div className="sp-attach-grid">
              {t.attachments.map((a) => (
                <div key={a.id} className="sp-attach-card">
                  <div className="sp-attach-icon">{fileIcon(a.name)}</div>
                  <div className="sp-attach-name" title={a.name}>{a.name}</div>
                  <div className="sp-attach-size">{bytes(a.size)}</div>
                  <button type="button" className="sp-link" onClick={() => download(a)}>Download</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RESOLUTION */}
        {t.resolutionSummary && (
          <div className="section">
            <div className="section-title"><span>Resolution</span></div>
            <p className="sp-text">{t.resolutionSummary}</p>
            {canConfirm && <p className="sp-muted" style={{ marginTop: 8 }}>Is the problem fixed? Confirm to resolve the ticket, or tell us what is still wrong.</p>}
          </div>
        )}

        {/* TIMELINE */}
        <div className="section">
          <div className="section-title"><span>Timeline</span></div>
          <div className="sp-timeline">
            {d.timeline.map((h, i) => (
              <div key={i} className="sp-timeline-item">
                <div className="sp-timeline-dot" />
                <div>
                  <span className="sp-timeline-action">{h.text}{h.to ? <> · <strong>{h.to}</strong></> : null}</span>
                  <span className="sp-timeline-time">{fmtDateTime(h.at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── MODALS ──────────────────────────────────────────────── */}

      {/* Add Attachment */}
      {attachModal.shouldRender && meta && (
        <div className={`modal-overlay ${attachModal.overlayClass}`}>
          <div className={`admin-modal ${attachModal.modalClass}`}>
            <div className="admin-modal-header">
              <h3>Add Attachment</h3>
              <Button3D variant="cancel" iconOnly aria-label="Close" onClick={() => attachModal.close(() => setFiles([]))}><img src={closeIcon} alt="" /></Button3D>
            </div>
            <div className="admin-modal-body">
              <FilePicker meta={meta} files={files} setFiles={setFiles} label="Files" emptyText="Choose files" />
            </div>
            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={() => attachModal.close(() => setFiles([]))}>Cancel</Button3D>
              <Button3D onClick={submitAttach} disabled={busy}>{busy ? "Uploading…" : "Upload"}</Button3D>
            </div>
          </div>
        </div>
      )}

      {/* Confirm the fix */}
      {confirmModal.shouldRender && (
        <div className={`modal-overlay ${confirmModal.overlayClass}`}>
          <div className={`admin-modal ${confirmModal.modalClass}`}>
            <div className="admin-modal-header">
              <h3>Confirm the Fix</h3>
              <Button3D variant="cancel" iconOnly aria-label="Close" onClick={() => confirmModal.close(() => setConfirmNote(""))}><img src={closeIcon} alt="" /></Button3D>
            </div>
            <div className="admin-modal-body">
              <p className="sp-muted">Confirming marks this ticket as resolved.</p>
              <div className="admin-form-group">
                <div className="mat">
                  <textarea className="mat-input mat-textarea" placeholder=" " value={confirmNote} onChange={(e) => setConfirmNote(allowTextInput(confirmNote, e.target.value, 4000, 800))} />
                  <label className="mat-label">Comment (optional)</label>
                  <span className="mat-bar" />
                </div>
              </div>
            </div>
            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={() => confirmModal.close(() => setConfirmNote(""))}>Cancel</Button3D>
              <Button3D onClick={submitConfirm} disabled={busy}>{busy ? "Saving…" : "Confirm"}</Button3D>
            </div>
          </div>
        </div>
      )}

      {/* Reopen */}
      {reopenModal.shouldRender && (
        <div className={`modal-overlay ${reopenModal.overlayClass}`}>
          <div className={`admin-modal ${reopenModal.modalClass}`}>
            <div className="admin-modal-header">
              <h3>Reopen Ticket</h3>
              <Button3D variant="cancel" iconOnly aria-label="Close" onClick={() => reopenModal.close(() => setReopenReason(""))}><img src={closeIcon} alt="" /></Button3D>
            </div>
            <div className="admin-modal-body">
              <div className="admin-form-group">
                <div className="mat">
                  <textarea className="mat-input mat-textarea" placeholder=" " autoFocus value={reopenReason} onChange={(e) => setReopenReason(allowTextInput(reopenReason, e.target.value, 4000, 800))} />
                  <label className="mat-label">What is still wrong?<span className="rf-req">*</span></label>
                  <span className="mat-bar" />
                </div>
              </div>
            </div>
            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={() => reopenModal.close(() => setReopenReason(""))}>Cancel</Button3D>
              <Button3D variant="danger" onClick={submitReopen} disabled={busy}>{busy ? "Reopening…" : "Reopen"}</Button3D>
            </div>
          </div>
        </div>
      )}

      <FloatingChat
        title="Dishky Support"
        subtitle={`${t.ticketId} · ${t.statusLabel}`}
        themLabel="Dishky Support"
        storageKey={`admin-${t.ticketId}`}
        messages={chatMessages}
        canSend={!!d.canWrite && !closed}
        disabledNote={closed ? "This ticket is closed. Reopen it to continue the conversation." : "You don't have permission to reply to tickets."}
        onSend={sendChat}
        attention={t.awaitingYou ? "Dishky needs your reply" : undefined}
        placeholder={has("reporter_respond") ? "Write your reply…" : "Write a message to Dishky…"}
      />
    </div>
  );
}

export default SupportDetail;
