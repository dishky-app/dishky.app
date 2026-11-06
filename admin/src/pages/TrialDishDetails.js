/**
 * TrialDishDetails.js  —  Dishky Admin Panel   (prefix: td-)
 * One trial dish: info + status, progress tracker, evaluation (7 criteria, overall score, star rating), cost analysis,
 * ingredient modifications, staff comments / observations, attempts (trial history), next trial schedule, final decision
 * and the chronological activity log. Layout follows SupportDetails.js; dialogs are the shared animated modals.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import api from "../api";
import socket from "../socket";
import closeIcon from "../icon/close-icon.png";
import { allowTextInput } from "../App";
import { fmtDateTime } from "../utils/dateUtils";
import { useToast } from "../useToast";
import { useAuth } from "../context/AuthContext";
import { useVenue } from "../context/VenueContext";
import Button3D from "../components/Button3D";
import useAnimatedModal from "../hooks/useAnimatedModal";
import CustomDropdown from "../components/CustomDropdown";
import PageLoader from "../components/PageLoader";
import { formatDisplayDate } from "../App";
import TrialFormModal from "./TrialFormModal";
import TrialStatusModal, { allowedMoves } from "./TrialStatusModal";
import FilePreviewLink from "../components/FilePreviewLink";
import { errMsg, Mat, Stars, statusClass, priorityClass, money, pct, cap, scoreTone } from "./TrialDishShared";

import "./IngredientDetails.css";
import "./TrialDishes.css";
import "./ModalCSS.css";

const STAGES = ["Pending", "In Progress", "Under Review", "Decision"];
const stageOf = (s) => ({ pending: 0, on_hold: 1, in_progress: 1, under_review: 2, approved: 3, rejected: 3 }[s] ?? 0);
const ACTION_LABEL = {
  created: "Created", updated: "Edited", in_progress: "Trial started", under_review: "Submitted for review", on_hold: "Put on hold", pending: "Moved to pending",
  approved: "Approved", rejected: "Rejected", retest: "Sent for retest", reopen: "Reopened", progress: "Progress", evaluated: "Evaluation",
  comment: "Comment", observation: "Observation", modification: "Ingredient change",
};

export default function TrialDishDetails() {
  const { id } = useParams();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { admin, isSuperAdmin, hasModulePermission } = useAuth();
  const { venueParam } = useVenue();
  const canWrite = hasModulePermission("trialDishes", "write");
  const isReviewer = isSuperAdmin || admin?.roleGroup === "Manager";

  const [d, setD] = useState(null);
  const [meta, setMeta] = useState(null);
  const [staff, setStaff] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  const editModal = useAnimatedModal("td-form");
  const statusModal = useAnimatedModal("td-status");
  const evalModal = useAnimatedModal("td-eval");
  const modModal = useAnimatedModal("td-mod");
  const progModal = useAnimatedModal("td-progress");

  const load = useCallback(async () => {
    try { setD((await api.get(`/trial-dishes/${id}`, { params: venueParam() })).data); }
    catch (e) { if (e?.response?.status === 404) setNotFound(true); else toast.error(errMsg(e, "Failed to load the trial")); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    load();
    api.get("/trial-dishes/meta").then((r) => setMeta(r.data)).catch(() => {});
    api.get("/staff", { params: venueParam() }).then((r) => setStaff(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    api.get("/categories", { params: venueParam() }).then((r) => setCategories(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);
  useEffect(() => {
    const on = (e) => { if (e && e.resource === "trialDishes" && (!e.payload || e.payload.id === id)) load(); };
    socket.on("data-change", on);
    return () => socket.off("data-change", on);
  }, [load, id]);

  const staffOptions = useMemo(() => staff.map((s) => ({ value: s.id, label: s.role ? `${s.name} — ${s.role}` : s.name })), [staff]);
  const categoryOptions = useMemo(() => categories.map((c) => ({ value: c.name, label: c.name })), [categories]);

  /* ── inline forms ─────────────────────────────────────────── */
  const [comment, setComment] = useState("");
  const [commentKind, setCommentKind] = useState("comment");
  const post = async (path, body, okMsg) => {
    setBusy(true);
    try { setD((await api.post(`/trial-dishes/${id}/${path}`, body)).data); if (okMsg) toast.success(okMsg); return true; }
    catch (e) { toast.error(errMsg(e, "Something went wrong")); return false; }
    finally { setBusy(false); }
  };
  const addComment = async () => {
    if (!comment.trim()) { toast.error("Write the comment first"); return; }
    if (await post("comments", { text: comment, kind: commentKind }, commentKind === "observation" ? "Observation added" : "Comment added")) setComment("");
  };

  /* evaluation dialog */
  const emptyScores = () => Object.fromEntries((meta?.criteria || []).map((c) => [c.key, ""]));
  const [scores, setScores] = useState({});
  const [weights, setWeights] = useState({});
  const [showWeights, setShowWeights] = useState(false);
  const [evRating, setEvRating] = useState(0);
  const [evFeedback, setEvFeedback] = useState("");
  const [evCost, setEvCost] = useState("");
  const [evError, setEvError] = useState("");
  const openEval = () => { setScores(emptyScores()); setWeights({}); setShowWeights(false); setEvRating(0); setEvFeedback(""); setEvCost(""); setEvError(""); evalModal.open(); };
  const liveOverall = useMemo(() => {
    let sum = 0, w = 0;
    (meta?.criteria || []).forEach((c) => {
      const s = Number(scores[c.key]);
      if (!(s >= 1 && s <= 10)) return;
      const wt = Number(weights[c.key]) > 0 ? Number(weights[c.key]) : 1;
      sum += s * wt; w += wt;
    });
    return w ? Math.round((sum / w) * 100) / 10 : null;
  }, [scores, weights, meta]);
  const submitEval = async () => {
    if (!Object.values(scores).some((v) => v !== "")) { setEvError("Score at least one criterion"); return; }
    const body = {
      scores: Object.fromEntries(Object.entries(scores).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v)])),
      weights: Object.fromEntries(Object.entries(weights).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)])),
      rating: evRating, feedback: evFeedback, actualCost: evCost === "" ? "" : Number(evCost),
    };
    if (await post("evaluations", body, "Evaluation recorded")) evalModal.close();
  };

  /* modification dialog */
  const [mod, setMod] = useState({ ingredient: "", change: "changed", from: "", to: "", reason: "" });
  const [modErr, setModErr] = useState("");
  const openMod = () => { setMod({ ingredient: "", change: "changed", from: "", to: "", reason: "" }); setModErr(""); modModal.open(); };
  const submitMod = async () => {
    if (!mod.ingredient.trim()) { setModErr("Name the ingredient"); return; }
    if (await post("modifications", mod, "Modification recorded")) modModal.close();
  };

  /* progress dialog */
  const [prog, setProg] = useState(0);
  const [progNote, setProgNote] = useState("");
  const openProg = () => { setProg(d.progressPct || 0); setProgNote(""); progModal.open(); };
  const submitProg = async () => { if (await post("progress", { progressPct: prog, note: progNote }, "Progress updated")) progModal.close(); };

  if (loading) return <div className="details-container"><PageLoader fill label="Loading trial dish…" /></div>;
  if (notFound || !d) {
    return (
      <div className="details-container">
        <div className="details-header">
          <button type="button" className="back-btn" aria-label="Back to Trial Dishes" onClick={() => navigate("/trial-dishes")} />
          <h2>Trial Dish Not Found</h2>
        </div>
      </div>
    );
  }

  const closed = ["approved", "rejected"].includes(d.status);
  const canStatus = canWrite && meta && allowedMoves(meta, d.status, isReviewer).length > 0;
  const canEval = canWrite && ["in_progress", "under_review"].includes(d.status);
  const canProg = canWrite && ["pending", "in_progress"].includes(d.status);
  const cur = stageOf(d.status);
  const evs = d.evaluations || [];
  const latestEv = evs[evs.length - 1];
  const criteria = meta?.criteria || [];
  const cost = d.cost || {};
  const activity = d.activity || [];

  const Item = ({ label, children }) => (
    <div className="td-summary-item"><div className="td-summary-label">{label}</div><div className="td-summary-value">{children}</div></div>
  );

  return (
    <div className="details-container td-details">
      {/* HEADER */}
      <div className="details-header">
        <button type="button" className="back-btn" aria-label="Back to Trial Dishes" onClick={() => navigate("/trial-dishes")} />
        <div>
          <h2>{d.trialId} — {d.name}</h2>
          <div className="td-header-meta">
            <span className={statusClass(d.status)}>{d.statusLabel}</span>
            <span className={priorityClass(d.priority)}>{d.priority}</span>
            {d.expired && <span className="td-badge td-status-expired">Expired</span>}
            {d.attempt > 1 && <span className="td-muted">Attempt {d.attempt}</span>}
          </div>
        </div>
      </div>

      <div className="details-body" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {/* ACTIONS */}
        {canWrite && (
          <div className="td-action-bar">
            <Button3D variant="cancel" onClick={() => editModal.open()}>Edit</Button3D>
            {canProg && <Button3D variant="cancel" onClick={openProg}>Update Progress</Button3D>}
            {canEval && <Button3D variant="cancel" onClick={openEval}>Record Evaluation</Button3D>}
            {!closed && <Button3D variant="cancel" onClick={openMod}>Log Ingredient Change</Button3D>}
            {canStatus && <Button3D onClick={() => statusModal.open()}>Update Status</Button3D>}
          </div>
        )}
        {d.status === "on_hold" && d.holdReason && <div className="td-banner">On hold — {d.holdReason}</div>}

        {/* PROGRESS */}
        <div className="section">
          <div className="section-title"><span>Progress</span></div>
          <div className="td-stage-tracker">
            {STAGES.map((label, i) => {
              const decided = i === 3 && closed;
              const cls = i < cur || decided ? " done" : i === cur ? " current" : "";
              const text = i === 3 && closed ? (d.status === "approved" ? "Approved" : "Rejected") : label;
              return (
                <div key={label} className={`td-stage${cls}${decided ? ` td-stage-${d.status}` : ""}`}>
                  <span className="td-stage-dot">{i < cur || decided ? "✓" : i + 1}</span>
                  <span className="td-stage-label">{text}</span>
                </div>
              );
            })}
          </div>
          <div className="td-progress-row">
            <div className="td-progress-bar"><div className="td-progress-fill" style={{ width: `${d.progressPct || 0}%` }} /></div>
            <span className="td-progress-pct">{d.progressPct || 0}%</span>
          </div>
        </div>

        {/* TRIAL INFO */}
        <div className="section">
          <div className="section-title"><span>Trial Information</span></div>
          <div className="td-info-layout">
            {d.image && <div className="td-detail-image"><FilePreviewLink href={d.image} download={`${d.name}.jpg`} label="View dish image" /></div>}
            <div className="td-info-main">
              {d.description && <p className="td-text">{d.description}</p>}
              <div className="td-summary-grid">
                <Item label="Category">{d.category || "—"}</Item>
                <Item label="Chef / Staff">{d.assignedStaffName || "—"}</Item>
                <Item label="Trial Start">{formatDisplayDate(d.trialStartDate)}</Item>
                <Item label="Expected Completion">{formatDisplayDate(d.expectedCompletion)}</Item>
                <Item label="Next Trial">{d.nextTrialDate ? formatDisplayDate(d.nextTrialDate) : "Not scheduled"}</Item>
                <Item label="Created By">{d.createdByName || "—"}</Item>
                <Item label="Created">{fmtDateTime(d.createdAt)}</Item>
                <Item label="Updated">{fmtDateTime(d.updatedAt)}</Item>
              </div>
            </div>
          </div>
        </div>

        <div className="td-two-col">
          <div className="section">
            <div className="section-title"><span>Ingredients</span></div>
            {d.ingredients?.length ? (
              <ul className="td-ing-view">
                {d.ingredients.map((i, n) => <li key={n}><span>{i.name}</span><span className="td-muted">{[i.quantity, i.unit].filter(Boolean).join(" ") || "—"}</span></li>)}
              </ul>
            ) : <p className="td-muted">No ingredients recorded.</p>}
          </div>
          <div className="section">
            <div className="section-title"><span>Preparation Method</span></div>
            {d.preparationMethod ? <p className="td-text">{d.preparationMethod}</p> : <p className="td-muted">Not recorded.</p>}
            {d.remarks && (<><div className="td-subtitle">Remarks</div><p className="td-text">{d.remarks}</p></>)}
          </div>
        </div>

        {/* EVALUATION */}
        <div className="section">
          <div className="section-title"><span>Taste Evaluation &amp; Rating</span></div>
          {!latestEv ? (
            <p className="td-muted">No evaluation recorded yet.{canEval ? " Use “Record Evaluation” to score this trial." : ""}</p>
          ) : (
            <>
              <div className="td-eval-head">
                <div className={`td-score td-score-${scoreTone(latestEv.overall)}`}>
                  <span className="td-score-num">{latestEv.overall}</span><span className="td-score-of">/ 100</span>
                  <span className="td-score-label">Overall score · attempt {latestEv.attempt}</span>
                </div>
                <div className="td-rating-box">
                  <Stars value={latestEv.rating || 0} />
                  <span className="td-muted">{d.avgRating ? `Average ${d.avgRating}★ over ${evs.filter((e) => e.rating > 0).length} review(s)` : "Not star-rated yet"}</span>
                </div>
              </div>
              <div className="td-criteria">
                {criteria.map((c) => {
                  const v = latestEv.scores?.[c.key];
                  return (
                    <div className="td-criterion" key={c.key}>
                      <span className="td-criterion-name">{c.label}</span>
                      <div className="td-bar"><div className={`td-bar-fill td-score-${scoreTone((v || 0) * 10)}`} style={{ width: `${(v || 0) * 10}%` }} /></div>
                      <span className="td-criterion-val">{v ? `${v}/10` : "—"}</span>
                    </div>
                  );
                })}
              </div>
              {latestEv.feedback && <><div className="td-subtitle">Feedback</div><p className="td-text">{latestEv.feedback}</p></>}

              {evs.length > 1 && (
                <>
                  <div className="td-subtitle">All evaluations</div>
                  <div className="table-wrapper td-mini-table"><table>
                    <thead><tr><th>Attempt</th><th>Date</th><th>By</th><th>Overall</th><th>Rating</th><th>Actual Cost</th><th>Feedback</th></tr></thead>
                    <tbody>{[...evs].reverse().map((e) => (
                      <tr key={e.id}><td>{e.attempt}</td><td>{fmtDateTime(e.at)}</td><td>{e.byName}</td><td>{e.overall}/100</td><td>{e.rating ? `${e.rating}★` : "—"}</td><td>{e.actualCost != null ? money(e.actualCost) : "—"}</td><td className="td-name-cell" title={e.feedback}>{e.feedback || "—"}</td></tr>
                    ))}</tbody>
                  </table></div>
                </>
              )}
            </>
          )}
        </div>

        {/* COST */}
        <div className="section">
          <div className="section-title"><span>Cost Analysis</span></div>
          <div className="td-summary-grid">
            <Item label="Estimated Cost">{money(cost.estimatedCost)}</Item>
            <Item label="Proposed Price">{money(cost.sellingPrice)}</Item>
            <Item label="Estimated Margin">{cost.estimatedMargin != null ? `${money(cost.estimatedMargin)} (${pct(cost.estimatedMarginPct)})` : "—"}</Item>
            <Item label="Latest Actual Cost">{cost.latestActualCost != null ? money(cost.latestActualCost) : "Not recorded"}</Item>
            <Item label="Actual Margin">{cost.actualMargin != null ? `${money(cost.actualMargin)} (${pct(cost.actualMarginPct)})` : "—"}</Item>
            <Item label="Food Cost %">{pct(cost.foodCostPct)}</Item>
            <Item label="Cost Variance">{cost.variance != null ? `${cost.variance > 0 ? "+" : ""}${money(cost.variance)}` : "—"}</Item>
          </div>
        </div>

        {/* MODIFICATIONS */}
        <div className="section">
          <div className="section-title"><span>Ingredient Modifications</span></div>
          {d.modifications?.length ? (
            <div className="table-wrapper td-mini-table"><table>
              <thead><tr><th>Attempt</th><th>Ingredient</th><th>Change</th><th>From</th><th>To</th><th>Reason</th><th>By</th><th>When</th></tr></thead>
              <tbody>{[...d.modifications].reverse().map((m) => (
                <tr key={m.id}><td>{m.attempt}</td><td>{m.ingredient}</td><td>{cap(m.change)}</td><td>{m.from || "—"}</td><td>{m.to || "—"}</td><td className="td-name-cell" title={m.reason}>{m.reason || "—"}</td><td>{m.byName}</td><td>{fmtDateTime(m.at)}</td></tr>
              ))}</tbody>
            </table></div>
          ) : <p className="td-muted">No ingredient changes recorded.</p>}
        </div>

        {/* COMMENTS */}
        <div className="section">
          <div className="section-title"><span>Staff Comments &amp; Observations</span></div>
          {canWrite && (
            <div className="td-comment-form">
              <div className="td-comment-kind">
                <CustomDropdown value={commentKind} onChange={setCommentKind} options={[{ value: "comment", label: "Comment" }, { value: "observation", label: "Observation" }]} placeholder={null} />
              </div>
              <Mat label="Write here…">
                <textarea className="mat-input mat-textarea" placeholder=" " value={comment} onChange={(e) => setComment(allowTextInput(comment, e.target.value, 1500, 300))} />
              </Mat>
              <Button3D onClick={addComment} disabled={busy}>{busy ? "Posting…" : "Post"}</Button3D>
            </div>
          )}
          {d.comments?.length ? (
            <div className="td-comments">
              {[...d.comments].reverse().map((c) => (
                <div className="td-comment" key={c.id}>
                  <div className="td-comment-head"><strong>{c.byName}</strong><span className="td-badge td-kind">{c.kind}</span><span className="td-muted">attempt {c.attempt} · {fmtDateTime(c.at)}</span></div>
                  <p className="td-text">{c.text}</p>
                </div>
              ))}
            </div>
          ) : <p className="td-muted">No comments yet.</p>}
        </div>

        {/* ATTEMPTS */}
        <div className="section">
          <div className="section-title"><span>Trial History &amp; Previous Attempts</span></div>
          <div className="table-wrapper td-mini-table"><table>
            <thead><tr><th>Attempt</th><th>Started</th><th>Ended</th><th>Outcome</th><th>Reason</th><th>Recommended Modifications</th></tr></thead>
            <tbody>{(d.attempts || []).map((a) => (
              <tr key={a.attempt}>
                <td>{a.attempt}{a.attempt === d.attempt && !closed ? " (current)" : ""}</td>
                <td>{a.startedAt ? fmtDateTime(a.startedAt) : "—"}</td>
                <td>{a.endedAt ? fmtDateTime(a.endedAt) : "—"}</td>
                <td>{a.outcome ? cap(a.outcome) : "In progress"}</td>
                <td className="td-name-cell" title={a.reason}>{a.reason || "—"}</td>
                <td className="td-name-cell" title={a.recommendations}>{a.recommendations || "—"}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>

        {/* FINAL DECISION */}
        {d.finalDecision && (
          <div className="section">
            <div className="section-title"><span>Final {d.finalDecision.decision === "approved" ? "Approval" : "Rejection"}</span></div>
            <div className={`td-decision td-decision-${d.finalDecision.decision}`}>
              <div><strong>{cap(d.finalDecision.decision)}</strong> by {d.finalDecision.byName} · {fmtDateTime(d.finalDecision.at)}</div>
              <p className="td-text">{d.finalDecision.remarks}</p>
              {d.finalDecision.recommendations && <><div className="td-subtitle">Recommended modifications</div><p className="td-text">{d.finalDecision.recommendations}</p></>}
            </div>
          </div>
        )}

        {/* ACTIVITY */}
        <div className="section">
          <div className="section-title"><span>Activity Log</span></div>
          <div className="td-timeline">
            {activity.map((a) => (
              <div key={a.id} className="td-timeline-item">
                <div className="td-timeline-dot" />
                <div>
                  <span className="td-timeline-action"><strong>{ACTION_LABEL[a.action] || cap(a.action)}</strong>{a.detail ? ` — ${a.detail}` : ""}</span>
                  <span className="td-timeline-time">{a.byName} · {fmtDateTime(a.at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* DIALOGS */}
      <TrialFormModal modal={editModal} trial={d} meta={meta} staffOptions={staffOptions} categoryOptions={categoryOptions} onSaved={load} />
      <TrialStatusModal modal={statusModal} trial={d} meta={meta} isReviewer={isReviewer} onDone={load} />

      {evalModal.shouldRender && meta && (
        <div className={`modal-overlay ${evalModal.overlayClass}`}>
          <form className={`admin-modal td-form-modal ${evalModal.modalClass}`} onSubmit={(e) => { e.preventDefault(); submitEval(); }}>
            <div className="admin-modal-header">
              <h3>Record Evaluation — attempt {d.attempt}</h3>
              <Button3D variant="cancel" iconOnly aria-label="Close" onClick={() => evalModal.close()}><img src={closeIcon} alt="" /></Button3D>
            </div>
            <div className="admin-modal-body">
              <p className="td-hint">Score each criterion from 1 (poor) to 10 (excellent). Leave a criterion blank to skip it.</p>
              <div className="td-eval-live">
                <span>Overall score</span>
                <strong className={liveOverall != null ? `td-score-${scoreTone(liveOverall)}` : ""}>{liveOverall != null ? `${liveOverall} / 100` : "—"}</strong>
              </div>
              <div className="td-eval-grid">
                {criteria.map((c) => (
                  <div className="td-eval-row" key={c.key}>
                    <span className="td-criterion-name">{c.label}</span>
                    <div className="td-scale">
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                        <button key={n} type="button" className={`td-scale-btn${Number(scores[c.key]) === n ? " on" : ""}`}
                          onClick={() => setScores((p) => ({ ...p, [c.key]: Number(p[c.key]) === n ? "" : n }))}>{n}</button>
                      ))}
                    </div>
                    {showWeights && (
                      <input className="td-input td-weight" type="number" min="1" max="10" placeholder="Wt" title="Weight (1–10)" value={weights[c.key] || ""}
                        onChange={(e) => setWeights((p) => ({ ...p, [c.key]: e.target.value }))} />
                    )}
                  </div>
                ))}
              </div>
              <button type="button" className="td-link" onClick={() => setShowWeights((v) => !v)}>{showWeights ? "Hide criterion weights" : "Configure criterion weights"}</button>
              {evError && <div className="field-error-msg">{evError}</div>}

              <div className="admin-form-group">
                <label className="td-field-label">Star rating</label>
                <Stars value={evRating} onChange={setEvRating} size={28} />
              </div>
              <Mat label="Feedback / review">
                <textarea className="mat-input mat-textarea" placeholder=" " value={evFeedback} onChange={(e) => setEvFeedback(allowTextInput(evFeedback, e.target.value, 1500, 300))} />
              </Mat>
              <Mat label="Actual preparation cost this attempt (₹)">
                <input className="mat-input" placeholder=" " inputMode="decimal" value={evCost} onChange={(e) => setEvCost(e.target.value.replace(/[^\d.]/g, "").slice(0, 10))} />
              </Mat>
            </div>
            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={() => evalModal.close()}>Cancel</Button3D>
              <Button3D type="submit" disabled={busy}>{busy ? "Saving…" : "Save Evaluation"}</Button3D>
            </div>
          </form>
        </div>
      )}

      {modModal.shouldRender && meta && (
        <div className={`modal-overlay ${modModal.overlayClass}`}>
          <form className={`admin-modal ${modModal.modalClass}`} onSubmit={(e) => { e.preventDefault(); submitMod(); }}>
            <div className="admin-modal-header">
              <h3>Log Ingredient Change</h3>
              <Button3D variant="cancel" iconOnly aria-label="Close" onClick={() => modModal.close()}><img src={closeIcon} alt="" /></Button3D>
            </div>
            <div className="admin-modal-body">
              <Mat label="Ingredient" required error={modErr}>
                <input className={`mat-input${modErr ? " mat-error" : ""}`} placeholder=" " autoFocus maxLength={80} value={mod.ingredient} onChange={(e) => { setMod((p) => ({ ...p, ingredient: e.target.value })); setModErr(""); }} />
              </Mat>
              <div className="admin-form-group">
                <CustomDropdown label="Change" value={mod.change} onChange={(v) => setMod((p) => ({ ...p, change: v }))} options={(meta.changeKinds || []).map((k) => ({ value: k, label: cap(k) }))} placeholder={null} />
              </div>
              <div className="horizontal-form-group">
                <Mat label="From"><input className="mat-input" placeholder=" " maxLength={80} value={mod.from} onChange={(e) => setMod((p) => ({ ...p, from: e.target.value }))} /></Mat>
                <Mat label="To"><input className="mat-input" placeholder=" " maxLength={80} value={mod.to} onChange={(e) => setMod((p) => ({ ...p, to: e.target.value }))} /></Mat>
              </div>
              <Mat label="Reason">
                <textarea className="mat-input mat-textarea" placeholder=" " value={mod.reason} onChange={(e) => setMod((p) => ({ ...p, reason: allowTextInput(p.reason, e.target.value, 300, 60) }))} />
              </Mat>
            </div>
            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={() => modModal.close()}>Cancel</Button3D>
              <Button3D type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button3D>
            </div>
          </form>
        </div>
      )}

      {progModal.shouldRender && (
        <div className={`modal-overlay ${progModal.overlayClass}`}>
          <form className={`admin-modal ${progModal.modalClass}`} onSubmit={(e) => { e.preventDefault(); submitProg(); }}>
            <div className="admin-modal-header">
              <h3>Update Progress</h3>
              <Button3D variant="cancel" iconOnly aria-label="Close" onClick={() => progModal.close()}><img src={closeIcon} alt="" /></Button3D>
            </div>
            <div className="admin-modal-body">
              <div className="td-prog-edit">
                <input type="range" min="0" max="100" step="5" value={prog} onChange={(e) => setProg(Number(e.target.value))} />
                <strong>{prog}%</strong>
              </div>
              <Mat label="Note (optional)">
                <input className="mat-input" placeholder=" " maxLength={400} value={progNote} onChange={(e) => setProgNote(e.target.value)} />
              </Mat>
            </div>
            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={() => progModal.close()}>Cancel</Button3D>
              <Button3D type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button3D>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
