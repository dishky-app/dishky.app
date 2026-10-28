/**
 * MemoDetails.js  —  Dishky Admin Panel
 * Single-memo workflow page: timeline, evidence, corrective actions,
 * root cause, staff/disciplinary action, customer compensation,
 * resolution, verification, reopen. Self-contained (fetch by id,
 * dedicated sub-resource endpoints for each action) — follows
 * DocumentDetails.js's back-btn/details-header/section convention for
 * the read-only fields, with additional action buttons gated by
 * status + role, mirroring Section 24 ("don't show every action to
 * every user").
 */

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";

import api from "../api";
import { allowTextInput, formatDisplayDate } from "../App";
import { fmtDateTime } from "../utils/dateUtils";
import { useToast } from "../useToast";
import { useAuth } from "../context/AuthContext";
import Button3D from "../components/Button3D";
import useAnimatedModal from "../hooks/useAnimatedModal";
import CustomDropdown from "../components/CustomDropdown";
import { CustomDatePicker, todayStr } from "../components/CustomDatePicker";
import { CustomTimePicker } from "../components/CustomTimePicker";
import PageLoader from "../components/PageLoader";
import closeIcon from "../icon/close-icon.png";
import {
  ROOT_CAUSES, CORRECTIVE_ACTION_STATUSES, CUSTOMER_IMPACTS, OPERATIONAL_IMPACTS,
  STAFF_ACTION_TYPES, COMPENSATION_TYPES, COMPENSATION_STATUSES, RESOLUTION_TYPES,
  VERIFICATION_RESULTS, evidenceFilesToPayload, memoStatusClass, memoResolutionClass,
  memoPriorityClass, LOCATIONS, DEPARTMENTS, PRIORITIES, CustomMultiDropdown, OrderPickerModal,
  nowTimeStr, isFutureIncident, MAX_STORY_LENGTH, STORY_STAGES, memoStageIndex,
} from "./MemoShared";

import "./IngredientDetails.css";
import "./Memos.css";
import "./ModalCSS.css";
import { toTitleCase } from "../utils/formUtils";

const EVIDENCE_ICON = { Photo: "📷", Video: "🎥", PDF: "📄", Document: "📄", Other: "📎" };

const MemoDetails = ({ adminData }) => {
  const { memoId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { admin, isSuperAdmin } = useAuth();

  // Same idea as DishDetails: if the row we clicked already handed us
  // the memo (via navigate state), render it immediately — no fetch,
  // no spinner. Only fall back to an API call (with a loader) when we
  // land here without that data, e.g. a page refresh or a direct link.
  const memoFromState = location.state?.memo || null;

  const [memo, setMemo] = useState(memoFromState);
  const [isLoading, setIsLoading] = useState(!memoFromState);
  const [notFound, setNotFound] = useState(false);

  const staffOptions = useMemo(() => {
    const accounts = adminData?.staffAccounts || [];
    return accounts.map((a) => ({ value: a.id, label: `${a.name} — ${a.roleTitle || ""}`.trim() }));
  }, [adminData]);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/memos/${memoId}`);
      setMemo(res.data);
    } catch (err) {
      if (err?.response?.status === 404) setNotFound(true);
      else {
        console.error("Failed to load memo:", err);
        toast.error("Failed to load memo");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (memoFromState) {
      // We already have the row's data — just make sure it's for this
      // memo (guards against stale state if the id in the URL changes
      // without a fresh navigation) and skip the network round-trip.
      if (memoFromState.id === memoId) {
        setMemo(memoFromState);
        setIsLoading(false);
        return;
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoId]);

  /* ── Modals ────────────────────────────────────────────────── */
  const editModal = useAnimatedModal("memo-edit");
  const [showEditForm, setShowEditForm] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [showOrderPicker, setShowOrderPicker] = useState(false);

  useEffect(() => {
    if (showEditForm) editModal.open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEditForm]);

  const openEdit = () => {
    setEditForm({
      title: memo.title || "",
      description: memo.description || "",
      story: memo.story || "",
      incidentDate: memo.incidentDate || "",
      incidentTime: memo.incidentTime || "",
      location: memo.location || "",
      department: memo.department || "",
      priority: memo.priority || "Normal",
      orderId: memo.orderId || "",
      customerName: memo.customerName || "",
      tableNumber: memo.tableNumber || "",
      primaryResponsible: memo.primaryResponsible || "",
      primaryResponsibleName: memo.primaryResponsibleName || "",
      involvedStaff: memo.involvedStaff || [],
      witnesses: memo.witnesses || [],
      departmentResponsible: memo.departmentResponsible || "",
      immediateAction: memo.immediateAction || "",
      immediateResult: memo.immediateResult || "",
    });
    setShowEditForm(true);
  };

  const closeEdit = () => {
    editModal.close(() => { setShowEditForm(false); setEditForm(null); });
  };

  const saveEdit = async () => {
    if (!editForm.title.trim()) { toast.error("Issue title is required"); return; }
    if (isFutureIncident(editForm.incidentDate, editForm.incidentTime)) {
      toast.error("Incident date and time cannot be in the future");
      return;
    }
    setEditSaving(true);
    try {
      const res = await api.put(`/memos/${memoId}`, editForm);
      setMemo(res.data);
      toast.success("Memo updated");
      closeEdit();
    } catch (err) {
      console.error("Failed to update memo:", err);
      toast.error(err?.response?.data?.error || "Failed to update memo");
    } finally {
      setEditSaving(false);
    }
  };

  const [storyDraft, setStoryDraft] = useState("");
  const [storySaving, setStorySaving] = useState(false);
  const addStoryUpdate = async () => {
    const text = storyDraft.trim();
    if (!text) { toast.error("Write the story update first"); return; }
    setStorySaving(true);
    try {
      const res = await api.post(`/memos/${memoId}/story`, { story: text });
      setMemo(res.data);
      setStoryDraft("");
      toast.success("Story updated");
    } catch (err) {
      console.error("Failed to add story update:", err);
      toast.error(err?.response?.data?.error || "Failed to add story update");
    } finally {
      setStorySaving(false);
    }
  };

  const caModal = useAnimatedModal("memo-ca");
  const [caForm, setCaForm] = useState({ description: "", assignedTo: "", assignedToName: "", dueDate: "", notes: "" });
  const [caSaving, setCaSaving] = useState(false);

  const staffActionModal = useAnimatedModal("memo-staff-action");
  const [saForm, setSaForm] = useState({ action: "", staffId: "", staffName: "", reason: "", notes: "" });
  const [saSaving, setSaSaving] = useState(false);

  const compModal = useAnimatedModal("memo-comp");
  const [compForm, setCompForm] = useState({ compensationRequired: true, compensationType: "", compensationAmount: "", compensationDescription: "", compensationStatus: "Pending", compensationDate: "" });
  const [compSaving, setCompSaving] = useState(false);

  const rootCauseModal = useAnimatedModal("memo-root-cause");
  const [rcForm, setRcForm] = useState({ rootCause: "", rootCauseDescription: "", preventiveAction: "" });
  const [rcSaving, setRcSaving] = useState(false);

  const aftermathModal = useAnimatedModal("memo-aftermath");
  const [amForm, setAmForm] = useState({ customerImpact: "", operationalImpact: "", productLoss: "", financialLoss: "", otherConsequences: "" });
  const [amSaving, setAmSaving] = useState(false);

  const resolveModal = useAnimatedModal("memo-resolve");
  const [resForm, setResForm] = useState({ resolutionSummary: "", resolutionType: "", verificationRequired: false });
  const [resFiles, setResFiles] = useState([]);
  const [resSaving, setResSaving] = useState(false);

  const verifyModal = useAnimatedModal("memo-verify");
  const [verifyForm, setVerifyForm] = useState({ result: "", notes: "" });
  const [verifySaving, setVerifySaving] = useState(false);

  const reopenModal = useAnimatedModal("memo-reopen");
  const [reopenReason, setReopenReason] = useState("");
  const [reopenSaving, setReopenSaving] = useState(false);

  const evidenceModal = useAnimatedModal("memo-evidence");
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [evidenceSaving, setEvidenceSaving] = useState(false);

  const openRootCause = () => {
    setRcForm({
      rootCause: memo.rootCause || "",
      rootCauseDescription: memo.rootCauseDescription || "",
      preventiveAction: memo.preventiveAction || "",
    });
    rootCauseModal.open();
  };
  const openAftermath = () => {
    setAmForm({
      customerImpact: memo.customerImpact || "",
      operationalImpact: memo.operationalImpact || "",
      productLoss: memo.productLoss || "",
      financialLoss: memo.financialLoss ?? "",
      otherConsequences: memo.otherConsequences || "",
    });
    aftermathModal.open();
  };
  const openCompensation = () => {
    setCompForm({
      compensationRequired: memo.compensationRequired ?? true,
      compensationType: memo.compensationType || "",
      compensationAmount: memo.compensationAmount ?? "",
      compensationDescription: memo.compensationDescription || "",
      compensationStatus: memo.compensationStatus || "Pending",
      compensationDate: memo.compensationDate || "",
    });
    compModal.open();
  };

  /* ── Actions ───────────────────────────────────────────────── */
  const updateStatus = async (status, notes) => {
    try {
      const res = await api.patch(`/memos/${memoId}/status`, { status, notes });
      setMemo(res.data);
      toast.success(`Status changed to ${status}`);
    } catch (err) {
      console.error("Failed to update status:", err);
      toast.error(err?.response?.data?.error || "Failed to update status");
    }
  };

  const saveRootCause = async () => {
    setRcSaving(true);
    try {
      const res = await api.put(`/memos/${memoId}`, rcForm);
      setMemo(res.data);
      toast.success("Root cause recorded");
      rootCauseModal.close();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save root cause");
    } finally {
      setRcSaving(false);
    }
  };

  const saveAftermath = async () => {
    setAmSaving(true);
    try {
      const payload = { ...amForm, financialLoss: amForm.financialLoss === "" ? null : Number(amForm.financialLoss) };
      const res = await api.put(`/memos/${memoId}`, payload);
      setMemo(res.data);
      toast.success("Impact recorded");
      aftermathModal.close();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save impact");
    } finally {
      setAmSaving(false);
    }
  };

  const addCorrectiveAction = async () => {
    if (!caForm.description.trim()) { toast.error("Description is required"); return; }
    setCaSaving(true);
    try {
      const res = await api.post(`/memos/${memoId}/corrective-actions`, caForm);
      setMemo(res.data);
      toast.success("Corrective action added");
      caModal.close(() => setCaForm({ description: "", assignedTo: "", assignedToName: "", dueDate: "", notes: "" }));
    } catch (err) {
      console.error(err);
      toast.error("Failed to add corrective action");
    } finally {
      setCaSaving(false);
    }
  };

  const updateCorrectiveAction = async (actionId, patch) => {
    try {
      const res = await api.put(`/memos/${memoId}/corrective-actions/${actionId}`, patch);
      setMemo(res.data);
      toast.success("Corrective action updated");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update corrective action");
    }
  };

  const addStaffAction = async () => {
    if (!saForm.action) { toast.error("Select an action type"); return; }
    setSaSaving(true);
    try {
      const res = await api.post(`/memos/${memoId}/staff-actions`, saForm);
      setMemo(res.data);
      toast.success("Staff action recorded");
      staffActionModal.close(() => setSaForm({ action: "", staffId: "", staffName: "", reason: "", notes: "" }));
    } catch (err) {
      console.error(err);
      toast.error("Failed to record staff action");
    } finally {
      setSaSaving(false);
    }
  };

  const saveCompensation = async () => {
    setCompSaving(true);
    try {
      const payload = { ...compForm, compensationAmount: compForm.compensationAmount === "" ? null : Number(compForm.compensationAmount) };
      const res = await api.put(`/memos/${memoId}/compensation`, payload);
      setMemo(res.data);
      toast.success("Compensation updated");
      compModal.close();
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.error || "Failed to update compensation");
    } finally {
      setCompSaving(false);
    }
  };

  const addEvidence = async () => {
    if (!evidenceFiles.length) { toast.error("Select at least one file"); return; }
    setEvidenceSaving(true);
    try {
      const items = await evidenceFilesToPayload(evidenceFiles);
      let latest = memo;
      for (const item of items) {
        const res = await api.post(`/memos/${memoId}/evidence`, item);
        latest = res.data;
      }
      setMemo(latest);
      toast.success("Evidence added");
      evidenceModal.close(() => setEvidenceFiles([]));
    } catch (err) {
      console.error(err);
      toast.error("Failed to add evidence");
    } finally {
      setEvidenceSaving(false);
    }
  };

  const removeEvidence = (evidenceId) => {
    toast.confirm("Remove this evidence file?", async () => {
      try {
        const res = await api.delete(`/memos/${memoId}/evidence/${evidenceId}`);
        setMemo(res.data);
        toast.success("Evidence removed");
      } catch (err) {
        console.error(err);
        toast.error("Failed to remove evidence");
      }
    });
  };

  const submitResolve = async () => {
    if (!resForm.resolutionSummary.trim()) { toast.error("Resolution summary is required"); return; }
    setResSaving(true);
    try {
      const resolutionEvidence = resFiles.length ? await evidenceFilesToPayload(resFiles) : [];
      const res = await api.post(`/memos/${memoId}/resolve`, { ...resForm, resolutionEvidence });
      setMemo(res.data);
      toast.success(resForm.verificationRequired ? "Marked resolved — awaiting verification" : "Issue resolved");
      resolveModal.close(() => { setResForm({ resolutionSummary: "", resolutionType: "", verificationRequired: false }); setResFiles([]); });
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.error || "Failed to resolve memo");
    } finally {
      setResSaving(false);
    }
  };

  const submitVerify = async () => {
    if (!verifyForm.result) { toast.error("Select Pass or Fail"); return; }
    setVerifySaving(true);
    try {
      const res = await api.post(`/memos/${memoId}/verify`, verifyForm);
      setMemo(res.data);
      toast.success(verifyForm.result === "Pass" ? "Resolution verified" : "Verification failed — sent back to Action Required");
      verifyModal.close(() => setVerifyForm({ result: "", notes: "" }));
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.error || "Failed to verify");
    } finally {
      setVerifySaving(false);
    }
  };

  const closeMemo = () => {
    toast.confirm(`Close memo ${memo.id}?`, async () => {
      try {
        const res = await api.post(`/memos/${memoId}/close`);
        setMemo(res.data);
        toast.success("Memo closed");
      } catch (err) {
        console.error(err);
        toast.error(err?.response?.data?.error || "Failed to close memo");
      }
    });
  };

  const cancelMemo = () => {
    toast.confirm(`Cancel memo ${memo.id}?`, async () => {
      try {
        const res = await api.post(`/memos/${memoId}/cancel`);
        setMemo(res.data);
        toast.success("Memo cancelled");
      } catch (err) {
        console.error(err);
        toast.error(err?.response?.data?.error || "Failed to cancel memo");
      }
    });
  };

  const submitReopen = async () => {
    if (!reopenReason.trim()) { toast.error("A reason for reopening is required"); return; }
    setReopenSaving(true);
    try {
      const res = await api.post(`/memos/${memoId}/reopen`, { reason: reopenReason });
      setMemo(res.data);
      toast.success("Memo reopened");
      reopenModal.close(() => setReopenReason(""));
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.error || "Failed to reopen memo");
    } finally {
      setReopenSaving(false);
    }
  };

  if (isLoading) {
    return <div className="details-container"><PageLoader fill label="Loading memo…" /></div>;
  }
  if (notFound || !memo) {
    return (
      <div className="details-container">
        <div className="details-header">
          <button className="back-btn" onClick={() => navigate("/memos")} />
          <h2>Memo Not Found</h2>
        </div>
      </div>
    );
  }

  const canAct = isSuperAdmin || ["Chef", "Service Manager"].includes(admin?.roleTitle) || memo.primaryResponsible === admin?.id;
  const isActive = !["Closed", "Cancelled"].includes(memo.status);
  // Once a memo is Resolved (or further along), its underlying issue
  // data is locked: no more evidence/corrective-action/root-cause/
  // impact/staff-action/compensation edits, and no editing the
  // create-form fields either. Only workflow-progression actions
  // (Verify, Close, Reopen) remain.
  const isLocked = ["Resolved", "Awaiting Verification"].includes(memo.status) || !isActive;

  return (
    <div className="details-container">
      <div className="details-header">
        <button className="back-btn" onClick={() => navigate("/memos")} />
        <div>
          <h2>{memo.id} — {memo.title}</h2>
          <div className="memo-header-meta">
            <span className={memoPriorityClass(memo.priority)}>{memo.priority}</span>
            <span className={memoStatusClass(memo.status)}>{memo.status}</span>
            <span className={memoResolutionClass(memo.resolutionStatus)}>{memo.resolutionStatus}</span>
          </div>
        </div>
        {canAct && !isLocked && (
          <Button3D variant="cancel" onClick={openEdit}>Edit</Button3D>
        )}
      </div>

      <div className="details-body" style={{ display: "flex", flexDirection: "column", gap: 22 }}>

        {/* ACTION BAR (Section 24 — gated by status/permission) */}
        {isActive && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {canAct && memo.status === "Open" && (
              <Button3D variant="cancel" onClick={() => updateStatus("Under Investigation")}>Start Investigation</Button3D>
            )}
            {canAct && ["Open", "Under Investigation"].includes(memo.status) && (
              <Button3D variant="cancel" onClick={() => updateStatus("Action Required")}>Mark Action Required</Button3D>
            )}
            {canAct && ["Action Required", "Under Investigation"].includes(memo.status) && (
              <Button3D variant="cancel" onClick={() => updateStatus("In Progress")}>Mark In Progress</Button3D>
            )}
            {canAct && !isLocked && <Button3D variant="cancel" onClick={() => evidenceModal.open()}>Add Evidence</Button3D>}
            {canAct && !isLocked && <Button3D variant="cancel" onClick={() => caModal.open()}>Add Corrective Action</Button3D>}
            {canAct && !isLocked && <Button3D variant="cancel" onClick={openRootCause}>{memo.rootCause ? "Edit" : "Add"} Root Cause</Button3D>}
            {canAct && !isLocked && <Button3D variant="cancel" onClick={openAftermath}>Record Impact</Button3D>}
            {canAct && !isLocked && <Button3D variant="cancel" onClick={() => staffActionModal.open()}>Record Staff Action</Button3D>}
            {canAct && !isLocked && <Button3D variant="cancel" onClick={openCompensation}>Record Compensation</Button3D>}
            {canAct && !isLocked && (
              <Button3D onClick={() => resolveModal.open()}>Mark Resolved</Button3D>
            )}
            {canAct && memo.status === "Awaiting Verification" && (
              <Button3D onClick={() => verifyModal.open()}>Verify Resolution</Button3D>
            )}
            {canAct && memo.status === "Resolved" && (
              <Button3D onClick={closeMemo}>Close Memo</Button3D>
            )}
            {canAct && !isLocked && <Button3D variant="danger" onClick={cancelMemo}>Cancel Memo</Button3D>}
          </div>
        )}
        {isLocked && isActive && canAct && (
          <p style={{ fontSize: 12.5, color: "#9ca3af", margin: 0 }}>
            This memo has been marked resolved — its issue details are now locked. Verify or reopen to make further changes.
          </p>
        )}
        {memo.status === "Closed" && canAct && (
          <div><Button3D variant="cancel" onClick={() => reopenModal.open()}>Reopen Memo</Button3D></div>
        )}

        {/* STORY / SUMMARY — problem-solving narrative + stage tracker */}
        <div className="section memo-story-section">
          <div className="section-title"><span>Story &amp; Progress</span></div>
          <div className="memo-stage-tracker">
            {STORY_STAGES.map((label, i) => {
              const cur = memoStageIndex(memo);
              const cls = memo.status === "Cancelled" ? "" : i < cur ? " done" : i === cur ? " current" : "";
              return (
                <div key={label} className={`memo-stage${cls}`}>
                  <span className="memo-stage-dot">{i < cur && memo.status !== "Cancelled" ? "✓" : i + 1}</span>
                  <span className="memo-stage-label">{label}</span>
                </div>
              );
            })}
          </div>
          {memo.status === "Cancelled" && <div className="memo-story-hint">This memo was cancelled.</div>}
          <div className="memo-story-text">
            {memo.story
              ? memo.story
              : <span className="memo-story-empty">No story yet — add a short summary of what happened and how it is being solved.</span>}
          </div>
          {canAct && !isLocked && (
            <div className="memo-story-add">
              <textarea
                className="memo-story-textarea"
                rows={3}
                maxLength={MAX_STORY_LENGTH}
                placeholder="Add a story update: what changed, what was tried, what happens next…"
                value={storyDraft}
                onChange={(e) => setStoryDraft(e.target.value)}
              />
              <div><Button3D variant="cancel" onClick={addStoryUpdate} disabled={storySaving}>{storySaving ? "Saving…" : "Add Story Update"}</Button3D></div>
            </div>
          )}
        </div>

        {/* ISSUE */}
        <div className="section">
          <div className="section-title"><span>Issue</span></div>
          <p>{memo.description || memo.title}</p>
          <div className="memo-summary-grid" style={{ marginTop: 10 }}>
            <div className="memo-summary-item"><div className="memo-summary-label">Memo Type</div><div className="memo-summary-value">{memo.memoType}</div></div>
            <div className="memo-summary-item"><div className="memo-summary-label">Incident Date</div><div className="memo-summary-value">{formatDisplayDate(memo.incidentDate) || "—"} {memo.incidentTime}</div></div>
            <div className="memo-summary-item"><div className="memo-summary-label">Location</div><div className="memo-summary-value">{memo.location || "—"}</div></div>
            <div className="memo-summary-item"><div className="memo-summary-label">Department</div><div className="memo-summary-value">{memo.department || "—"}</div></div>
            <div className="memo-summary-item"><div className="memo-summary-label">Created By</div><div className="memo-summary-value">{memo.createdByName} ({memo.createdByRoleTitle})</div></div>
            <div className="memo-summary-item"><div className="memo-summary-label">Created At</div><div className="memo-summary-value">{fmtDateTime(memo.createdAt)}</div></div>
          </div>
          {(memo.orderId || memo.customerName || memo.tableNumber) && (
            <div className="memo-summary-grid" style={{ marginTop: 10 }}>
              {memo.orderId && <div className="memo-summary-item"><div className="memo-summary-label">Order</div><div className="memo-summary-value">{memo.orderId}</div></div>}
              {memo.customerName && <div className="memo-summary-item"><div className="memo-summary-label">Customer</div><div className="memo-summary-value">{memo.customerName}</div></div>}
              {memo.tableNumber && <div className="memo-summary-item"><div className="memo-summary-label">Table</div><div className="memo-summary-value">{memo.tableNumber}</div></div>}
            </div>
          )}
        </div>

        {/* RESPONSIBLE PEOPLE */}
        <div className="section">
          <div className="section-title"><span>Responsible / Involved</span></div>
          <div className="memo-summary-grid">
            <div className="memo-summary-item"><div className="memo-summary-label">Primary Responsible</div><div className="memo-summary-value">{memo.primaryResponsibleName || "—"}</div></div>
            <div className="memo-summary-item"><div className="memo-summary-label">Involved Staff</div><div className="memo-summary-value">{(memo.involvedStaff || []).map((s) => s.name).join(", ") || "—"}</div></div>
            <div className="memo-summary-item"><div className="memo-summary-label">Witnesses</div><div className="memo-summary-value">{(memo.witnesses || []).map((s) => s.name).join(", ") || "—"}</div></div>
          </div>
        </div>

        {/* EVIDENCE */}
        <div className="section">
          <div className="section-title"><span>Evidence</span></div>
          {(memo.evidence || []).length === 0 ? (
            <p>No evidence attached.</p>
          ) : (
            <div className="memo-evidence-grid">
              {memo.evidence.map((ev) => (
                <div key={ev.id} className="memo-evidence-card">
                  {ev.mediaType === "Photo" && ev.fileData ? (
                    <img src={ev.fileData} alt={ev.fileName} />
                  ) : (
                    <div className="memo-evidence-icon">{EVIDENCE_ICON[ev.mediaType] || "📎"}</div>
                  )}
                  <div className="memo-evidence-card-name" title={ev.fileName}>{ev.fileName || ev.mediaType}</div>
                  <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 4 }}>
                    {ev.fileData && <a href={ev.fileData} download={ev.fileName} style={{ fontSize: 11 }}>Download</a>}
                    {canAct && <button type="button" onClick={() => removeEvidence(ev.id)} style={{ border: "none", background: "none", color: "#dc2626", fontSize: 11, cursor: "pointer" }}>Remove</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* IMMEDIATE ACTION */}
        {(memo.immediateAction || memo.immediateResult) && (
          <div className="section">
            <div className="section-title"><span>Immediate Action</span></div>
            <p>{memo.immediateAction || "—"}</p>
            {memo.immediateResult && <p style={{ color: "#6b7280", fontSize: 13 }}>Result: {memo.immediateResult}</p>}
            {memo.immediateActionByName && <p style={{ color: "#9ca3af", fontSize: 12 }}>By {memo.immediateActionByName}</p>}
          </div>
        )}

        {/* ROOT CAUSE */}
        {memo.rootCause && (
          <div className="section">
            <div className="section-title"><span>Root Cause</span></div>
            <div className="memo-summary-item" style={{ marginBottom: 8, display: "inline-block" }}>
              <div className="memo-summary-label">Root Cause</div>
              <div className="memo-summary-value">{memo.rootCause}</div>
            </div>
            {memo.rootCauseDescription && <p>{memo.rootCauseDescription}</p>}
            {memo.preventiveAction && <p style={{ color: "#6b7280" }}><strong>Preventive Action:</strong> {memo.preventiveAction}</p>}
          </div>
        )}

        {/* CORRECTIVE ACTIONS */}
        <div className="section">
          <div className="section-title"><span>Corrective Actions</span></div>
          {(memo.correctiveActions || []).length === 0 ? (
            <p>No corrective actions yet.</p>
          ) : (
            memo.correctiveActions.map((ca) => {
              const overdue = ca.status !== "Completed" && ca.dueDate && ca.dueDate < new Date().toISOString().slice(0, 10);
              const cls = overdue ? "memo-ca-overdue" : ca.status === "Completed" ? "memo-ca-completed" : ca.status === "In Progress" ? "memo-ca-in-progress" : "";
              return (
                <div key={ca.id} className={`memo-ca-card ${cls}`}>
                  <div className="memo-ca-header">
                    <div>{ca.description}</div>
                    {canAct && ca.status !== "Completed" && (
                      <CustomDropdown
                        value={ca.status}
                        onChange={(v) => updateCorrectiveAction(ca.id, { status: v })}
                        options={CORRECTIVE_ACTION_STATUSES.map((s) => ({ value: s, label: s }))}
                        placeholder={null}
                      />
                    )}
                    {(!canAct || ca.status === "Completed") && <span className={memoStatusClass(overdue ? "Overdue" : ca.status)}>{overdue ? "Overdue" : ca.status}</span>}
                  </div>
                  <div className="memo-ca-meta">
                    {ca.assignedToName && <span>Assigned: {ca.assignedToName}</span>}
                    {ca.dueDate && <span>Due: {formatDisplayDate(ca.dueDate)}</span>}
                    {ca.completionDate && <span>Completed: {formatDisplayDate(ca.completionDate)}</span>}
                  </div>
                  {ca.notes && <p style={{ fontSize: 12.5, color: "#6b7280", marginTop: 6 }}>{ca.notes}</p>}
                </div>
              );
            })
          )}
        </div>

        {/* AFTERMATH */}
        {(memo.customerImpact || memo.operationalImpact || memo.financialLoss != null || memo.otherConsequences) && (
          <div className="section">
            <div className="section-title"><span>Aftermath / Consequences</span></div>
            <div className="memo-summary-grid">
              {memo.customerImpact && <div className="memo-summary-item"><div className="memo-summary-label">Customer Impact</div><div className="memo-summary-value">{memo.customerImpact}</div></div>}
              {memo.operationalImpact && <div className="memo-summary-item"><div className="memo-summary-label">Operational Impact</div><div className="memo-summary-value">{memo.operationalImpact}</div></div>}
              {memo.productLoss && <div className="memo-summary-item"><div className="memo-summary-label">Product Loss</div><div className="memo-summary-value">{memo.productLoss}</div></div>}
              {memo.financialLoss != null && <div className="memo-summary-item"><div className="memo-summary-label">Financial Loss</div><div className="memo-summary-value">₹{memo.financialLoss}</div></div>}
            </div>
            {memo.otherConsequences && <p style={{ marginTop: 8 }}>{memo.otherConsequences}</p>}
          </div>
        )}

        {/* STAFF ACTIONS */}
        {(memo.staffActions || []).length > 0 && (
          <div className="section">
            <div className="section-title"><span>Staff Action</span></div>
            {memo.staffActions.map((sa) => (
              <div key={sa.id} className="memo-ca-card">
                <div className="memo-ca-header"><div>{sa.action} — {sa.staffName}</div></div>
                <div className="memo-ca-meta">
                  <span>Date: {formatDisplayDate(sa.actionDate)}</span>
                  <span>Authorized by: {sa.authorizedByName}</span>
                </div>
                {sa.reason && <p style={{ fontSize: 12.5, color: "#6b7280", marginTop: 6 }}>{sa.reason}</p>}
              </div>
            ))}
          </div>
        )}

        {/* CUSTOMER COMPENSATION */}
        {memo.compensationRequired && (
          <div className="section">
            <div className="section-title"><span>Customer Compensation</span></div>
            <div className="memo-summary-grid">
              <div className="memo-summary-item"><div className="memo-summary-label">Type</div><div className="memo-summary-value">{memo.compensationType || "—"}</div></div>
              {memo.compensationAmount != null && <div className="memo-summary-item"><div className="memo-summary-label">Amount</div><div className="memo-summary-value">₹{memo.compensationAmount}</div></div>}
              <div className="memo-summary-item"><div className="memo-summary-label">Status</div><div className="memo-summary-value">{memo.compensationStatus || "Pending"}</div></div>
              {memo.compensationDate && <div className="memo-summary-item"><div className="memo-summary-label">Compensated On</div><div className="memo-summary-value">{formatDisplayDate(memo.compensationDate)}</div></div>}
            </div>
            {memo.compensationDescription && <p style={{ marginTop: 8 }}>{memo.compensationDescription}</p>}
          </div>
        )}

        {/* RESOLUTION */}
        {memo.resolutionSummary && (
          <div className="section">
            <div className="section-title"><span>Resolution</span></div>
            <p>{memo.resolutionSummary}</p>
            <div className="memo-summary-grid" style={{ marginTop: 8 }}>
              {memo.resolutionType && <div className="memo-summary-item"><div className="memo-summary-label">Type</div><div className="memo-summary-value">{memo.resolutionType}</div></div>}
              {memo.resolvedByName && <div className="memo-summary-item"><div className="memo-summary-label">Resolved By</div><div className="memo-summary-value">{memo.resolvedByName}</div></div>}
              {memo.resolvedAt && <div className="memo-summary-item"><div className="memo-summary-label">Resolved At</div><div className="memo-summary-value">{fmtDateTime(memo.resolvedAt)}</div></div>}
            </div>
          </div>
        )}

        {/* VERIFICATION */}
        {memo.verificationResult && (
          <div className="section">
            <div className="section-title"><span>Verification</span></div>
            <p>{memo.verificationResult === "Pass" ? "✓ Verified" : "✗ Verification Failed"} by {memo.verifiedByName} on {fmtDateTime(memo.verifiedAt)}</p>
            {memo.verificationNotes && <p style={{ color: "#6b7280", fontSize: 13 }}>{memo.verificationNotes}</p>}
          </div>
        )}

        {/* REOPEN HISTORY */}
        {(memo.reopenHistory || []).length > 0 && (
          <div className="section">
            <div className="section-title"><span>Reopen History</span></div>
            {memo.reopenHistory.map((r, i) => (
              <div key={i} className="memo-reopen-entry">
                <strong>{r.reopenedByName}</strong> reopened on {fmtDateTime(r.reopenedAt)} — {r.reason}
                {r.previousResolutionSummary && <div style={{ marginTop: 4, fontStyle: "italic" }}>Previous resolution: {r.previousResolutionSummary}</div>}
              </div>
            ))}
          </div>
        )}

        {/* TIMELINE (Section 23 — generated from audit/event history) */}
        <div className="section">
          <div className="section-title"><span>Timeline</span></div>
          <div className="memo-timeline">
            {(memo.timeline || []).map((ev) => (
              <div key={ev.id} className={`memo-timeline-item${(ev.story || ev.notes) ? " has-story" : ""}`} tabIndex={(ev.story || ev.notes) ? 0 : undefined}>
                <div className="memo-timeline-dot" />
                {(ev.story || ev.notes) && (
                  <div className="memo-timeline-tooltip" role="tooltip">
                    <div className="memo-timeline-tooltip-title">{ev.action} · {fmtDateTime(ev.createdAt)}</div>
                    <div className="memo-timeline-tooltip-body">{ev.story || ev.notes}</div>
                    {ev.userName && <div className="memo-timeline-tooltip-by">— {ev.userName}</div>}
                  </div>
                )}
                <div>
                  <span className="memo-timeline-action">{ev.action}</span>
                  <span className="memo-timeline-time">{fmtDateTime(ev.createdAt)}</span>
                </div>
                {ev.userName && <div className="memo-timeline-by">By {ev.userName}{ev.userRoleTitle ? ` (${ev.userRoleTitle})` : ""}</div>}
                {ev.notes && <div className="memo-timeline-notes">{ev.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── MODALS ──────────────────────────────────────────────── */}

      {/* Edit Memo */}
      {editModal.shouldRender && editForm && (
        <div className={`modal-overlay ${editModal.overlayClass}`}>
          <form
            className={`admin-modal memo-form-modal ${editModal.modalClass}`}
            onSubmit={(e) => { e.preventDefault(); saveEdit(); }}
          >
            <div className="admin-modal-header">
              <h3>Edit Memo</h3>
              <Button3D variant="cancel" iconOnly onClick={closeEdit}><img src={closeIcon} alt="" /></Button3D>
            </div>
            <div className="admin-modal-body">
              <div className="admin-form-group">
                <div className="mat">
                  <input
                    className="mat-input"
                    placeholder=" "
                    autoFocus
                    value={editForm.title}
                    onChange={(e) => setEditForm((p) => ({ ...p, title: allowTextInput(p.title, e.target.value, 100, 15) }))}
                  />
                  <label className="mat-label">Issue Title<span className="rf-req">*</span></label>
                  <span className="mat-bar" />
                </div>
              </div>
              <div className="admin-form-group">
                <div className="mat">
                  <textarea className="mat-input mat-textarea" placeholder=" " value={editForm.description} onChange={(e) => setEditForm((p) => ({ ...p, description: allowTextInput(p.description, e.target.value, 2000, 400) }))} />
                  <label className="mat-label">What Happened?</label>
                  <span className="mat-bar" />
                </div>
              </div>
              <div className="admin-form-group">
                <div className="mat">
                  <textarea
                    className="mat-input mat-textarea memo-story-input"
                    placeholder=" "
                    maxLength={MAX_STORY_LENGTH}
                    value={editForm.story}
                    onChange={(e) => setEditForm((p) => ({ ...p, story: e.target.value }))}
                  />
                  <label className="mat-label">Story / Summary</label>
                  <span className="mat-bar" />
                </div>
              </div>
              <div className="horizontal-form-group">
                <div className="admin-form-group">
                  <CustomDatePicker
                    label="Incident Date"
                    value={editForm.incidentDate}
                    max={todayStr()}
                    onChange={(v) => setEditForm((p) => ({
                      ...p,
                      incidentDate: v,
                      incidentTime: v === todayStr() && p.incidentTime > nowTimeStr() ? "" : p.incidentTime,
                    }))}
                  />
                </div>
                <div className="admin-form-group">
                  <CustomTimePicker
                    label="Incident Time"
                    value={editForm.incidentTime}
                    maxTime={editForm.incidentDate === todayStr() ? nowTimeStr() : undefined}
                    onChange={(v) => setEditForm((p) => ({ ...p, incidentTime: v }))}
                  />
                </div>
              </div>
              <div className="horizontal-form-group">
                <div className="admin-form-group">
                  <CustomDropdown label="Location" value={editForm.location} onChange={(v) => setEditForm((p) => ({ ...p, location: v }))} options={LOCATIONS.map((l) => ({ value: l, label: l }))} placeholder="Select location" />
                </div>
                <div className="admin-form-group">
                  <CustomDropdown label="Department" value={editForm.department} onChange={(v) => setEditForm((p) => ({ ...p, department: v }))} options={DEPARTMENTS.map((d) => ({ value: d, label: d }))} placeholder="Select department" />
                </div>
              </div>
              <div className="admin-form-group">
                <CustomDropdown label="Priority" value={editForm.priority} onChange={(v) => setEditForm((p) => ({ ...p, priority: v }))} options={PRIORITIES.map((pr) => ({ value: pr, label: pr }))} placeholder={null} />
              </div>

              <div className="admin-form-group">
                <label htmlFor="">Order / Customer Information (optional)</label>
                {editForm.orderId ? (
                  <div className="memo-selected-order">
                    <div>
                      <div className="memo-selected-order-id">{editForm.orderId}</div>
                      <div className="memo-selected-order-customer">{editForm.customerName || "—"}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Button3D variant="cancel" onClick={() => setShowOrderPicker(true)}>Change</Button3D>
                      <Button3D variant="cancel" onClick={() => setEditForm((p) => ({ ...p, orderId: "", customerName: "" }))}>Clear</Button3D>
                    </div>
                  </div>
                ) : (
                  <Button3D variant="cancel" onClick={() => setShowOrderPicker(true)}>Select Order</Button3D>
                )}
              </div>
              <div className="horizontal-form-group">
                <div className="admin-form-group">
                  <div className="mat">
                    <input className="mat-input" placeholder=" " value={editForm.customerName} onChange={(e) => setEditForm((p) => ({ ...p, customerName: toTitleCase(allowTextInput(p.customerName, e.target.value, 80, 10)) }))} />
                    <label className="mat-label">Customer Name</label>
                    <span className="mat-bar" />
                  </div>
                </div>
                <div className="admin-form-group">
                  <div className="mat">
                    <input className="mat-input" placeholder=" " value={editForm.tableNumber} onChange={(e) => setEditForm((p) => ({ ...p, tableNumber: allowTextInput(p.tableNumber, e.target.value, 20, 5) }))} />
                    <label className="mat-label">Table Number</label>
                    <span className="mat-bar" />
                  </div>
                </div>
              </div>

              <div className="admin-form-group">
                <CustomDropdown
                  label="Primary Responsible"
                  value={editForm.primaryResponsible}
                  onChange={(val) => {
                    const opt = staffOptions.find((o) => o.value === val);
                    setEditForm((p) => ({ ...p, primaryResponsible: val, primaryResponsibleName: opt ? opt.label.split(" — ")[0] : "" }));
                  }}
                  options={staffOptions}
                  placeholder="Select responsible person"
                />
              </div>
              <div className="admin-form-group">
                <label className="memo-picker-label">Involved Staff</label>
                <CustomMultiDropdown options={staffOptions} value={editForm.involvedStaff} onChange={(v) => setEditForm((p) => ({ ...p, involvedStaff: v }))} placeholder="Select involved staff" />
              </div>
              <div className="admin-form-group">
                <label className="memo-picker-label">Witnesses (optional)</label>
                <CustomMultiDropdown options={staffOptions} value={editForm.witnesses} onChange={(v) => setEditForm((p) => ({ ...p, witnesses: v }))} placeholder="Select witnesses" />
              </div>

              <div className="admin-form-group">
                <div className="mat">
                  <textarea className="mat-input mat-textarea" placeholder=" " value={editForm.immediateAction} onChange={(e) => setEditForm((p) => ({ ...p, immediateAction: allowTextInput(p.immediateAction, e.target.value, 500, 100) }))} />
                  <label className="mat-label">Immediate Action Taken</label>
                  <span className="mat-bar" />
                </div>
              </div>
              <div className="admin-form-group">
                <div className="mat">
                  <input className="mat-input" placeholder=" " value={editForm.immediateResult} onChange={(e) => setEditForm((p) => ({ ...p, immediateResult: allowTextInput(p.immediateResult, e.target.value, 200, 40) }))} />
                  <label className="mat-label">Immediate Result</label>
                  <span className="mat-bar" />
                </div>
              </div>
            </div>
            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={closeEdit}>Cancel</Button3D>
              <Button3D type="submit" disabled={editSaving}>{editSaving ? "Saving…" : "Save Changes"}</Button3D>
            </div>
          </form>
        </div>
      )}

      {editForm && (
        <OrderPickerModal
          open={showOrderPicker}
          onClose={() => setShowOrderPicker(false)}
          orders={adminData?.orders || []}
          onPick={(order) => {
            setEditForm((p) => ({ ...p, orderId: order.id, customerName: order.userName || p.customerName }));
            setShowOrderPicker(false);
          }}
        />
      )}

      {/* Add Evidence */}
      {evidenceModal.shouldRender && (
        <div className={`modal-overlay ${evidenceModal.overlayClass}`}>
          <div className={`admin-modal ${evidenceModal.modalClass}`}>
            <div className="admin-modal-header">
              <h3>Add Evidence</h3>
              <Button3D variant="cancel" iconOnly onClick={() => evidenceModal.close(() => setEvidenceFiles([]))}><img src={closeIcon} alt="" /></Button3D>
            </div>
            <div className="admin-modal-body">
              <div className="file-wrap">
                <input type="file" multiple onChange={(e) => setEvidenceFiles((prev) => [...prev, ...Array.from(e.target.files || [])])} className="file-input" />
                <div className="file-label">{evidenceFiles.length ? `✔ ${evidenceFiles.length} file(s)` : "Choose files"}</div>
              </div>
              {evidenceFiles.length > 0 && (
                <ul className="memo-evidence-preview-list">
                  {evidenceFiles.map((f, i) => (
                    <li key={i}>
                      {f.name}
                      <button type="button" onClick={() => setEvidenceFiles((prev) => prev.filter((_, idx) => idx !== i))}>✕</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={() => evidenceModal.close(() => setEvidenceFiles([]))}>Cancel</Button3D>
              <Button3D onClick={addEvidence} disabled={evidenceSaving}>{evidenceSaving ? "Uploading…" : "Add"}</Button3D>
            </div>
          </div>
        </div>
      )}

      {/* Add Corrective Action */}
      {caModal.shouldRender && (
        <div className={`modal-overlay ${caModal.overlayClass}`}>
          <div className={`admin-modal ${caModal.modalClass}`}>
            <div className="admin-modal-header">
              <h3>Add Corrective Action</h3>
              <Button3D variant="cancel" iconOnly onClick={() => caModal.close()}><img src={closeIcon} alt="" /></Button3D>
            </div>
            <div className="admin-modal-body">
              <div className="admin-form-group">
                <div className="mat">
                  <textarea className="mat-input mat-textarea" placeholder=" " value={caForm.description} onChange={(e) => setCaForm((p) => ({ ...p, description: allowTextInput(p.description, e.target.value, 500, 100) }))} />
                  <label className="mat-label">What must be done?<span className="rf-req">*</span></label>
                  <span className="mat-bar" />
                </div>
              </div>
              <div className="admin-form-group">
                <CustomDropdown
                  label="Assigned To"
                  value={caForm.assignedTo}
                  onChange={(val) => {
                    const opt = staffOptions.find((o) => o.value === val);
                    setCaForm((p) => ({ ...p, assignedTo: val, assignedToName: opt ? opt.label.split(" — ")[0] : "" }));
                  }}
                  options={staffOptions}
                  placeholder="Select assignee"
                />
              </div>
              <div className="admin-form-group">
                <CustomDatePicker label="Due Date" value={caForm.dueDate} onChange={(v) => setCaForm((p) => ({ ...p, dueDate: v }))} />
              </div>
              <div className="admin-form-group">
                <div className="mat">
                  <textarea className="mat-input mat-textarea" placeholder=" " value={caForm.notes} onChange={(e) => setCaForm((p) => ({ ...p, notes: allowTextInput(p.notes, e.target.value, 300, 60) }))} />
                  <label className="mat-label">Notes (optional)</label>
                  <span className="mat-bar" />
                </div>
              </div>
            </div>
            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={() => caModal.close()}>Cancel</Button3D>
              <Button3D onClick={addCorrectiveAction} disabled={caSaving}>{caSaving ? "Saving…" : "Add"}</Button3D>
            </div>
          </div>
        </div>
      )}

      {/* Root Cause */}
      {rootCauseModal.shouldRender && (
        <div className={`modal-overlay ${rootCauseModal.overlayClass}`}>
          <div className={`admin-modal ${rootCauseModal.modalClass}`}>
            <div className="admin-modal-header">
              <h3>Root Cause</h3>
              <Button3D variant="cancel" iconOnly onClick={() => rootCauseModal.close()}><img src={closeIcon} alt="" /></Button3D>
            </div>
            <div className="admin-modal-body">
              <div className="admin-form-group">
                <CustomDropdown label="Root Cause" value={rcForm.rootCause} onChange={(v) => setRcForm((p) => ({ ...p, rootCause: v }))} options={ROOT_CAUSES.map((r) => ({ value: r, label: r }))} placeholder="Select root cause" />
              </div>
              <div className="admin-form-group">
                <div className="mat">
                  <textarea className="mat-input mat-textarea" placeholder=" " value={rcForm.rootCauseDescription} onChange={(e) => setRcForm((p) => ({ ...p, rootCauseDescription: allowTextInput(p.rootCauseDescription, e.target.value, 800, 150) }))} />
                  <label className="mat-label">Description</label>
                  <span className="mat-bar" />
                </div>
              </div>
              <div className="admin-form-group">
                <div className="mat">
                  <textarea className="mat-input mat-textarea" placeholder=" " value={rcForm.preventiveAction} onChange={(e) => setRcForm((p) => ({ ...p, preventiveAction: allowTextInput(p.preventiveAction, e.target.value, 500, 100) }))} />
                  <label className="mat-label">Preventive Action</label>
                  <span className="mat-bar" />
                </div>
              </div>
            </div>
            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={() => rootCauseModal.close()}>Cancel</Button3D>
              <Button3D onClick={saveRootCause} disabled={rcSaving}>{rcSaving ? "Saving…" : "Save"}</Button3D>
            </div>
          </div>
        </div>
      )}

      {/* Aftermath */}
      {aftermathModal.shouldRender && (
        <div className={`modal-overlay ${aftermathModal.overlayClass}`}>
          <div className={`admin-modal ${aftermathModal.modalClass}`}>
            <div className="admin-modal-header">
              <h3>Record Impact</h3>
              <Button3D variant="cancel" iconOnly onClick={() => aftermathModal.close()}><img src={closeIcon} alt="" /></Button3D>
            </div>
            <div className="admin-modal-body">
              <div className="admin-form-group">
                <CustomDropdown label="Customer Impact" value={amForm.customerImpact} onChange={(v) => setAmForm((p) => ({ ...p, customerImpact: v }))} options={CUSTOMER_IMPACTS.map((c) => ({ value: c, label: c }))} placeholder="Select" />
              </div>
              <div className="admin-form-group">
                <CustomDropdown label="Operational Impact" value={amForm.operationalImpact} onChange={(v) => setAmForm((p) => ({ ...p, operationalImpact: v }))} options={OPERATIONAL_IMPACTS.map((c) => ({ value: c, label: c }))} placeholder="Select" />
              </div>
              <div className="admin-form-group">
                <div className="mat">
                  <input className="mat-input" placeholder=" " value={amForm.financialLoss} onChange={(e) => setAmForm((p) => ({ ...p, financialLoss: e.target.value.replace(/[^0-9.]/g, "") }))} />
                  <label className="mat-label">Financial Loss (₹, optional)</label>
                  <span className="mat-bar" />
                </div>
              </div>
              <div className="admin-form-group">
                <div className="mat">
                  <textarea className="mat-input mat-textarea" placeholder=" " value={amForm.otherConsequences} onChange={(e) => setAmForm((p) => ({ ...p, otherConsequences: allowTextInput(p.otherConsequences, e.target.value, 500, 100) }))} />
                  <label className="mat-label">Other Consequences</label>
                  <span className="mat-bar" />
                </div>
              </div>
            </div>
            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={() => aftermathModal.close()}>Cancel</Button3D>
              <Button3D onClick={saveAftermath} disabled={amSaving}>{amSaving ? "Saving…" : "Save"}</Button3D>
            </div>
          </div>
        </div>
      )}

      {/* Staff Action */}
      {staffActionModal.shouldRender && (
        <div className={`modal-overlay ${staffActionModal.overlayClass}`}>
          <div className={`admin-modal ${staffActionModal.modalClass}`}>
            <div className="admin-modal-header">
              <h3>Record Staff Action</h3>
              <Button3D variant="cancel" iconOnly onClick={() => staffActionModal.close()}><img src={closeIcon} alt="" /></Button3D>
            </div>
            <div className="admin-modal-body">
              <div className="admin-form-group">
                <CustomDropdown label="Action" value={saForm.action} onChange={(v) => setSaForm((p) => ({ ...p, action: v }))} options={STAFF_ACTION_TYPES.map((s) => ({ value: s, label: s }))} placeholder="Select action" required />
              </div>
              <div className="admin-form-group">
                <CustomDropdown
                  label="Staff Member"
                  value={saForm.staffId}
                  onChange={(val) => {
                    const opt = staffOptions.find((o) => o.value === val);
                    setSaForm((p) => ({ ...p, staffId: val, staffName: opt ? opt.label.split(" — ")[0] : "" }));
                  }}
                  options={staffOptions}
                  placeholder="Select staff member"
                />
              </div>
              <div className="admin-form-group">
                <div className="mat">
                  <textarea className="mat-input mat-textarea" placeholder=" " value={saForm.reason} onChange={(e) => setSaForm((p) => ({ ...p, reason: allowTextInput(p.reason, e.target.value, 500, 100) }))} />
                  <label className="mat-label">Reason</label>
                  <span className="mat-bar" />
                </div>
              </div>
            </div>
            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={() => staffActionModal.close()}>Cancel</Button3D>
              <Button3D onClick={addStaffAction} disabled={saSaving}>{saSaving ? "Saving…" : "Record"}</Button3D>
            </div>
          </div>
        </div>
      )}

      {/* Compensation */}
      {compModal.shouldRender && (
        <div className={`modal-overlay ${compModal.overlayClass}`}>
          <div className={`admin-modal ${compModal.modalClass}`}>
            <div className="admin-modal-header">
              <h3>Customer Compensation</h3>
              <Button3D variant="cancel" iconOnly onClick={() => compModal.close()}><img src={closeIcon} alt="" /></Button3D>
            </div>
            <div className="admin-modal-body">
              <div className="admin-form-group">
                <CustomDropdown label="Compensation Type" value={compForm.compensationType} onChange={(v) => setCompForm((p) => ({ ...p, compensationType: v }))} options={COMPENSATION_TYPES.map((c) => ({ value: c, label: c }))} placeholder="Select type" />
              </div>
              <div className="admin-form-group">
                <div className="mat">
                  <input className="mat-input" placeholder=" " value={compForm.compensationAmount} onChange={(e) => setCompForm((p) => ({ ...p, compensationAmount: e.target.value.replace(/[^0-9.]/g, "") }))} />
                  <label className="mat-label">Amount (₹)</label>
                  <span className="mat-bar" />
                </div>
              </div>
              <div className="admin-form-group">
                <div className="mat">
                  <textarea className="mat-input mat-textarea" placeholder=" " value={compForm.compensationDescription} onChange={(e) => setCompForm((p) => ({ ...p, compensationDescription: allowTextInput(p.compensationDescription, e.target.value, 400, 80) }))} />
                  <label className="mat-label">Description</label>
                  <span className="mat-bar" />
                </div>
              </div>
              <div className="admin-form-group">
                <CustomDropdown label="Status" value={compForm.compensationStatus} onChange={(v) => setCompForm((p) => ({ ...p, compensationStatus: v }))} options={COMPENSATION_STATUSES.map((c) => ({ value: c, label: c }))} placeholder={null} />
              </div>
              {compForm.compensationStatus === "Issued" && (
                <div className="admin-form-group">
                  <CustomDatePicker label="Compensation Date" value={compForm.compensationDate} onChange={(v) => setCompForm((p) => ({ ...p, compensationDate: v }))} />
                </div>
              )}
            </div>
            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={() => compModal.close()}>Cancel</Button3D>
              <Button3D onClick={saveCompensation} disabled={compSaving}>{compSaving ? "Saving…" : "Save"}</Button3D>
            </div>
          </div>
        </div>
      )}

      {/* Resolve */}
      {resolveModal.shouldRender && (
        <div className={`modal-overlay ${resolveModal.overlayClass}`}>
          <div className={`admin-modal ${resolveModal.modalClass}`}>
            <div className="admin-modal-header">
              <h3>Mark Resolved</h3>
              <Button3D variant="cancel" iconOnly onClick={() => resolveModal.close()}><img src={closeIcon} alt="" /></Button3D>
            </div>
            <div className="admin-modal-body">
              <div className="admin-form-group">
                <div className="mat">
                  <textarea className="mat-input mat-textarea" placeholder=" " value={resForm.resolutionSummary} onChange={(e) => setResForm((p) => ({ ...p, resolutionSummary: allowTextInput(p.resolutionSummary, e.target.value, 1000, 200) }))} />
                  <label className="mat-label">Resolution Summary<span className="rf-req">*</span></label>
                  <span className="mat-bar" />
                </div>
              </div>
              <div className="admin-form-group">
                <CustomDropdown label="Resolution Type" value={resForm.resolutionType} onChange={(v) => setResForm((p) => ({ ...p, resolutionType: v }))} options={RESOLUTION_TYPES.map((r) => ({ value: r, label: r }))} placeholder="Select type" />
              </div>
              <div className="admin-form-group">
                <label className="memo-picker-label" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={resForm.verificationRequired} onChange={(e) => setResForm((p) => ({ ...p, verificationRequired: e.target.checked }))} />
                  Requires verification by another user
                </label>
              </div>
              <div className="admin-form-group">
                <div className="file-wrap">
                  <input type="file" multiple onChange={(e) => setResFiles((prev) => [...prev, ...Array.from(e.target.files || [])])} className="file-input" />
                  <div className="file-label">{resFiles.length ? `✔ ${resFiles.length} file(s)` : "Resolution evidence (optional)"}</div>
                </div>
                {resFiles.length > 0 && (
                  <ul className="memo-evidence-preview-list">
                    {resFiles.map((f, i) => (
                      <li key={i}>
                        {f.name}
                        <button type="button" onClick={() => setResFiles((prev) => prev.filter((_, idx) => idx !== i))}>✕</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={() => resolveModal.close()}>Cancel</Button3D>
              <Button3D onClick={submitResolve} disabled={resSaving}>{resSaving ? "Saving…" : "Mark Resolved"}</Button3D>
            </div>
          </div>
        </div>
      )}

      {/* Verify */}
      {verifyModal.shouldRender && (
        <div className={`modal-overlay ${verifyModal.overlayClass}`}>
          <div className={`admin-modal ${verifyModal.modalClass}`}>
            <div className="admin-modal-header">
              <h3>Verify Resolution</h3>
              <Button3D variant="cancel" iconOnly onClick={() => verifyModal.close()}><img src={closeIcon} alt="" /></Button3D>
            </div>
            <div className="admin-modal-body">
              <div className="admin-form-group">
                <CustomDropdown label="Result" value={verifyForm.result} onChange={(v) => setVerifyForm((p) => ({ ...p, result: v }))} options={VERIFICATION_RESULTS.map((r) => ({ value: r, label: r }))} placeholder="Select result" required />
              </div>
              <div className="admin-form-group">
                <div className="mat">
                  <textarea className="mat-input mat-textarea" placeholder=" " value={verifyForm.notes} onChange={(e) => setVerifyForm((p) => ({ ...p, notes: allowTextInput(p.notes, e.target.value, 400, 80) }))} />
                  <label className="mat-label">Verification Notes</label>
                  <span className="mat-bar" />
                </div>
              </div>
            </div>
            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={() => verifyModal.close()}>Cancel</Button3D>
              <Button3D onClick={submitVerify} disabled={verifySaving}>{verifySaving ? "Saving…" : "Submit"}</Button3D>
            </div>
          </div>
        </div>
      )}

      {/* Reopen */}
      {reopenModal.shouldRender && (
        <div className={`modal-overlay ${reopenModal.overlayClass}`}>
          <div className={`admin-modal ${reopenModal.modalClass}`}>
            <div className="admin-modal-header">
              <h3>Reopen Memo</h3>
              <Button3D variant="cancel" iconOnly onClick={() => reopenModal.close()}><img src={closeIcon} alt="" /></Button3D>
            </div>
            <div className="admin-modal-body">
              <div className="admin-form-group">
                <div className="mat">
                  <textarea className="mat-input mat-textarea" placeholder=" " value={reopenReason} onChange={(e) => setReopenReason(allowTextInput(reopenReason, e.target.value, 500, 100))} />
                  <label className="mat-label">Reason for Reopening<span className="rf-req">*</span></label>
                  <span className="mat-bar" />
                </div>
              </div>
            </div>
            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={() => reopenModal.close()}>Cancel</Button3D>
              <Button3D onClick={submitReopen} disabled={reopenSaving}>{reopenSaving ? "Reopening…" : "Reopen"}</Button3D>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemoDetails;