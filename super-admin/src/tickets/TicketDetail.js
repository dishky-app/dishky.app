import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Button3D from "../components/Button3D.js";
import CustomDropdown from "../components/CustomDropdown.js";
import FloatingChat from "../components/FloatingChat.js";
import MediaPicker from "../components/MediaPicker.js";
import PageLoader from "../components/PageLoader.js";
import useTabLiquid from "../hooks/useTabLiquid.js";
import { DetailsPage, Section, Value } from "../components.js";
import { useToast } from "../useToast.js";
import ActionDialog, { ACTION_FORMS, ACTION_ORDER } from "./ActionDialog.js";
import { Field } from "./Modal.js";
import { DeadlineText, PriorityTag, StatusTag, bytesLabel, dateTime, readFileAsDataUrl, saveBlob, usePolling, useTicketApi } from "./ui.js";

// Actions that live in the "Assignment" section (who works on it, how urgent, by when).
// Everything else the workflow allows is offered in the footer.
const ASSIGNMENT_ACTIONS = ["triage", "assign", "set_priority", "set_deadline"];
const MEDIA_ACCEPT = ".png,.jpg,.jpeg,.webp,.gif,.pdf,.doc,.docx,.txt,.log,.json";

const Text = ({ label, children }) => (children ? <Section title={label} wide><Value>{children}</Value></Section> : null);
const btnVariant = (a) => (ACTION_FORMS[a].danger ? "danger" : ACTION_FORMS[a].primary ? "save" : "cancel");

/**
 * Full ticket workspace used by Super Admin and developers — same page layout as the Admin Panel's
 * DishDetails: header (back · title · status) → body of sections → sticky footer with the workflow actions.
 * The public conversation with the restaurant is the floating chat (bottom-right); internal notes stay on the page.
 */
export default function TicketDetail({ backTo = "/tickets", backLabel = "Tickets" }) {
  const { id } = useParams();
  const api = useTicketApi();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [d, setD] = useState(null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null);
  const [tab, setTab] = useState("notes");
  const [note, setNote] = useState("");
  const [uploadVis, setUploadVis] = useState("public");
  const [busy, setBusy] = useState(false);
  const typing = useRef(false);
  const { containerRef: tabsRef, thumbStyle } = useTabLiquid(tab);

  const load = useCallback(async () => {
    try { setD(await api.ticket(id)); setError(""); } catch (e) { setError(e.message); }
  }, [api, id]);
  useEffect(() => { api.meta().then(setMeta).catch(() => {}); }, [api]);
  // Refresh every 10 s (that is also how new chat messages arrive) unless the user is writing a note or a dialog is open.
  usePolling(() => { if (!typing.current && !dialog) load(); }, 10000, [load, dialog]);

  const back = () => navigate(backTo);

  if (error && !d) {
    return (
      <DetailsPage title="Ticket" onBack={back} footer={<Button3D variant="cancel" onClick={back}>{`Back to ${backLabel}`}</Button3D>}>
        <div className="details-notice is-error" role="alert">{error}</div>
      </DetailsPage>
    );
  }
  if (!d || !meta) return <PageLoader fill label="Loading ticket…" />;

  const { ticket: t, comments, history, qaReports, releases, actions, canComment } = d;
  const acts = ACTION_ORDER.filter((a) => actions.includes(a) && ACTION_FORMS[a]);
  const assignmentActs = acts.filter((a) => ASSIGNMENT_ACTIONS.includes(a));
  const footerActs = acts.filter((a) => !ASSIGNMENT_ACTIONS.includes(a));
  const done = (res) => { setD(res); setDialog(null); toast.success("Ticket updated"); };

  const internalNotes = comments.filter((c) => c.visibility === "internal");
  const publicComments = comments.filter((c) => c.visibility !== "internal");

  const postNote = async () => {
    if (!note.trim()) return;
    setBusy(true);
    try { await api.comment(t.ticketId, { body: note, visibility: "internal" }); setNote(""); typing.current = false; await load(); toast.success("Note added"); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const sendChat = async (text) => { await api.comment(t.ticketId, { body: text, visibility: "public" }); await load(); };
  const upload = async (files) => {
    setBusy(true);
    try {
      await api.attach(t.ticketId, await Promise.all(files.map(readFileAsDataUrl)), uploadVis === "internal");
      await load(); toast.success(`${files.length} file${files.length === 1 ? "" : "s"} uploaded`);
    } catch (er) { toast.error(er.message); } finally { setBusy(false); }
  };
  const download = async (a) => { try { saveBlob(await api.download(t.ticketId, a.id), a.name); } catch (e) { toast.error(e.message); } };

  const visOptions = [canComment.public && { value: "public", label: "Public (visible to restaurant)" }, canComment.internal && { value: "internal", label: "Internal note" }].filter(Boolean);
  const canUpload = canComment.public || canComment.internal;
  const chatMessages = publicComments.map((c) => ({
    id: c.id, body: c.body, at: c.createdAt,
    side: c.author && c.author.kind === "reporter" ? "them" : "me",
    author: (c.author && c.author.name) || "Dishky team",
    showAuthor: true,
  }));
  const catLabel = meta.categories.find((c) => c.value === t.category)?.label || t.category;
  const reporterName = t.reporter && t.reporter.name;

  const needsTriage = assignmentActs.includes("triage");
  const canAssign = assignmentActs.includes("assign");

  return (
    <DetailsPage
      title={`${t.ticketId} · ${t.title}`}
      onBack={back}
      meta={
        <>
          <StatusTag status={t.status} label={t.statusLabel} />
          <PriorityTag priority={t.priority} suggested={t.suggestedPriority} />
          {t.severity && <span className="subtitle">Severity: {t.severity}</span>}
          {t.reopenCount > 0 && <span className="subtitle">Reopened ×{t.reopenCount}</span>}
        </>
      }
      footer={
        <>
          <Button3D variant="cancel" style={{ marginRight: "auto" }} onClick={back}>Back</Button3D>
          {footerActs.map((a) => <Button3D key={a} variant={btnVariant(a)} onClick={() => setDialog(a)}>{ACTION_FORMS[a].label}</Button3D>)}
        </>
      }
    >
      {error && <div className="details-notice is-error" role="alert">{error}</div>}
      {t.blockerReason && t.status === "blocked" && <div className="details-notice">Blocked: {t.blockerReason}</div>}
      {t.changesReason && ["changes_requested", "release_rejected"].includes(t.status) && <div className="details-notice">Returned: {t.changesReason}</div>}
      {t.lastQA && t.status === "qa_failed" && <div className="details-notice">QA failed: {t.lastQA.summary}</div>}

      {/* ASSIGNMENT — who solves this ticket, how urgent, by when */}
      <Section title="Assignment" wide>
        <div className="horizontal-form-group">
          <Section title="Developer"><Value>{t.developerName || "Unassigned"}</Value></Section>
          <Section title="Tester"><Value>{t.testerName}</Value></Section>
          <Section title="Reviewer"><Value>{t.reviewerName}</Value></Section>
          <Section title="Deadline"><p><DeadlineText ticket={t} /></p></Section>
        </div>
        <div className="horizontal-form-group">
          <Section title="Assigned"><Value>{t.assignedAt ? dateTime(t.assignedAt) : ""}</Value></Section>
          <Section title="Acknowledged"><Value>{t.acknowledgedAt ? dateTime(t.acknowledgedAt) : ""}</Value></Section>
          <Section title="Last progress"><Value>{t.lastProgressAt ? dateTime(t.lastProgressAt) : ""}</Value></Section>
        </div>
        {assignmentActs.length > 0 && (
          <>
            {!t.developerId && (
              <p className="section-hint">
                {needsTriage ? "Step 1: triage the ticket (priority and severity). Step 2: assign a developer — tester and reviewer are optional."
                  : "Choose a developer, optionally a tester and reviewer, and set the deadline."}
              </p>
            )}
            <div className="actions">
              {assignmentActs.map((a) => (
                <Button3D key={a} variant={a === "assign" || (a === "triage" && !canAssign) ? "save" : "cancel"} onClick={() => setDialog(a)}>
                  {a === "assign" ? (t.developerId ? "Reassign / change team" : "Assign developer & tester") : ACTION_FORMS[a].label}
                </Button3D>
              ))}
            </div>
          </>
        )}
        {t.deadlineHistory && t.deadlineHistory.length > 0 && (
          <>
            <div className="section-title"><span>Deadline changes</span></div>
            <table className="data-table">
              <thead><tr><th>When</th><th>By</th><th>From → to</th><th>Reason</th></tr></thead>
              <tbody>
                {t.deadlineHistory.map((h, i) => (
                  <tr key={i}><td>{dateTime(h.at)}</td><td>{h.by}</td><td>{h.from ? dateTime(h.from) : "none"} → {dateTime(h.to)}</td><td>{h.reason || "—"}</td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Section>

      {/* REPORTER */}
      <div className="horizontal-form-group">
        <Section title="Restaurant"><Value>{t.restaurantName}</Value></Section>
        <Section title="Branch"><Value>{t.branchName}</Value></Section>
        <Section title="Reported by"><Value>{reporterName ? `${reporterName}${t.reporter.onBehalfOf ? " (on behalf)" : ""}` : ""}</Value></Section>
        <Section title="Role"><Value>{t.reporter && t.reporter.roleTitle}</Value></Section>
      </div>
      <div className="horizontal-form-group">
        <Section title="Email"><Value>{t.reporter && t.reporter.email}</Value></Section>
        <Section title="Category"><Value>{catLabel}</Value></Section>
        <Section title="Module"><Value>{t.module}</Value></Section>
        <Section title="Created"><Value>{dateTime(t.createdAt)}</Value></Section>
      </div>

      {/* ISSUE */}
      <Text label="Description">{t.description}</Text>
      <Text label="Expected behaviour">{t.expected}</Text>
      <Text label="Actual behaviour">{t.actual}</Text>
      <Text label="Steps to reproduce">{t.steps}</Text>
      <Text label="Business impact">{t.impact}</Text>
      <Text label="Resolution">{t.resolutionSummary}</Text>

      {/* ATTACHMENTS */}
      <Section title="Attachments" wide>
        {t.attachments.length === 0 ? <Value>None</Value> : (
          <table className="data-table">
            <thead><tr><th>File</th><th>Size</th><th>Uploaded by</th><th>Visibility</th></tr></thead>
            <tbody>
              {t.attachments.map((a) => (
                <tr key={a.id}>
                  <td><button type="button" className="details-link clickable" onClick={() => download(a)}>{a.name}</button></td>
                  <td>{bytesLabel(a.size)}</td><td>{a.uploadedBy}</td><td>{a.internal ? "Internal" : "Public"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {canUpload && (
          <div className="horizontal-form-group" style={{ alignItems: "flex-end", marginTop: 6 }}>
            <div style={{ flex: "0 1 240px" }}>
              <MediaPicker label={busy ? "Uploading…" : "Add attachments"} accept={MEDIA_ACCEPT} multiple disabled={busy} onPick={upload} />
            </div>
            {visOptions.length > 1 && (
              <div style={{ flex: "0 1 260px" }}>
                <CustomDropdown label="Visible to" value={uploadVis} onChange={(v) => setUploadVis(v || "public")} options={visOptions} placeholder={null} />
              </div>
            )}
          </div>
        )}
        <span className="section-hint">Never attach passwords, tokens or customer data. Files are scanned for credentials.</span>
      </Section>

      {/* INVESTIGATION & FIX */}
      <Section title="Investigation & fix" wide>
        <div className={`details-meter${(t.progressPct || 0) > 85 ? " is-hot" : ""}`} title={`${t.progressPct || 0}%`}><span style={{ width: `${t.progressPct || 0}%` }} /></div>
        {t.investigationNotes && <Section title="Investigation notes"><Value>{t.investigationNotes}</Value></Section>}
        {t.rootCause && <Section title="Root-cause analysis"><Value>{t.rootCause}</Value></Section>}
        {t.fixSummary && <Section title="Fix summary"><Value>{t.fixSummary}</Value></Section>}
        {t.testEvidence && <Section title="Test evidence"><Value>{t.testEvidence}</Value></Section>}
        {(t.branch || t.commitRef) && (
          <div className="horizontal-form-group">
            <Section title="Branch"><Value>{t.branch}</Value></Section>
            <Section title="Commit / PR"><Value>{t.commitRef}</Value></Section>
          </div>
        )}
        {!t.investigationNotes && !t.rootCause && !t.fixSummary && !t.testEvidence && <Value>No work recorded yet.</Value>}
      </Section>

      {/* QA, REVIEW & RELEASE */}
      {(qaReports.length > 0 || t.review || t.releaseApproval || t.codePush || releases.length > 0) && (
        <Section title="QA, review & release" wide>
          {qaReports.length > 0 && (
            <table className="data-table">
              <thead><tr><th>Verdict</th><th>Cycle</th><th>Tester</th><th>When</th><th>Summary</th></tr></thead>
              <tbody>
                {qaReports.map((q) => (
                  <tr key={q.id}>
                    <td><StatusTag status={q.verdict === "pass" ? "qa_passed" : "qa_failed"} label={`QA ${q.verdict}`} /></td>
                    <td>{q.cycle}</td><td>{q.tester && q.tester.name}</td><td>{dateTime(q.createdAt)}</td>
                    <td>{q.summary}{q.evidence ? ` — Evidence: ${q.evidence}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {t.review && t.review.approved && <p>✔ Fix approved in review by {t.review.by} · {dateTime(t.review.at)}{t.review.note ? ` — ${t.review.note}` : ""}</p>}
          {t.releaseApproval && <p>✔ Release approved by {t.releaseApproval.by} · {dateTime(t.releaseApproval.at)}</p>}
          {t.codePush && <p>⬆ Code pushed: {t.codePush.branch} @ {t.codePush.commitRef} by {t.codePush.by} · {dateTime(t.codePush.at)}</p>}
          {releases.length > 0 && (
            <table className="data-table">
              <thead><tr><th>Release</th><th>Environment</th><th>Result</th><th>Operator</th><th>When</th><th>Notes</th></tr></thead>
              <tbody>
                {releases.map((r) => (
                  <tr key={r.id}><td>{r.releaseId}</td><td>{r.environment}</td><td><strong>{r.result.replace("_", " ")}</strong></td><td>{r.operator}</td><td>{dateTime(r.createdAt)}</td><td>{r.notes || "—"}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      )}

      {/* INTERNAL NOTES + ACTIVITY (the public conversation is the floating chat) */}
      <Section title="Notes & activity" wide>
        <div className="app-tab-pills" ref={tabsRef}>
          <span className="app-tab-pill-liquid" style={thumbStyle} />
          <button type="button" className={`app-tab-pill${tab === "notes" ? " active" : ""}`} onClick={() => setTab("notes")}>Internal notes ({internalNotes.length})</button>
          <button type="button" className={`app-tab-pill${tab === "activity" ? " active" : ""}`} onClick={() => setTab("activity")}>Activity ({history.length})</button>
        </div>

        {tab === "notes" && (
          <>
            {internalNotes.length === 0 ? <Value>No internal notes yet.</Value> : (
              <table className="data-table">
                <thead><tr><th>Author</th><th>When</th><th>Note</th></tr></thead>
                <tbody>
                  {internalNotes.map((c) => (
                    <tr key={c.id}><td>{c.author && c.author.name}</td><td>{dateTime(c.createdAt)}</td><td style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{c.body}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
            {canComment.internal && (
              <>
                <Field label="Write an internal note…">
                  <textarea value={note} onFocus={() => { typing.current = true; }} onBlur={() => { typing.current = !!note; }} onChange={(e) => setNote(e.target.value)} />
                </Field>
                <div className="actions"><Button3D disabled={busy || !note.trim()} onClick={postNote}>Add note</Button3D></div>
                <span className="section-hint">Internal notes are never shown to the restaurant.</span>
              </>
            )}
          </>
        )}

        {tab === "activity" && (
          <table className="data-table">
            <thead><tr><th>When</th><th>By</th><th>Change</th></tr></thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i}>
                  <td>{dateTime(h.at)}</td><td>{h.actor && h.actor.name}</td>
                  <td>
                    {h.to && h.from !== h.to ? <>{meta.statuses[h.from] ? `${meta.statuses[h.from]} → ` : ""}<strong>{meta.statuses[h.to] || h.to}</strong></> : <strong>{h.type}</strong>}
                    {h.note ? ` — ${h.note}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <FloatingChat
        title={t.restaurantName || "Restaurant"}
        subtitle={`${reporterName ? `${reporterName} · ` : ""}${t.ticketId}`}
        themLabel={reporterName || t.restaurantName || "Restaurant"}
        storageKey={`staff-${t.ticketId}`}
        messages={chatMessages}
        canSend={!!canComment.public}
        disabledNote="You don't have permission to message the restaurant."
        onSend={sendChat}
        placeholder="Reply to the restaurant…"
      />

      {dialog && <ActionDialog action={dialog} ticket={t} meta={meta} onClose={() => setDialog(null)} onDone={done} />}
    </DetailsPage>
  );
}
