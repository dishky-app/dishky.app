import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import "./FloatingChat.css";

/**
 * FloatingChat — animated chat-bubble launcher + chat window for a ticket conversation
 * (restaurant owner ⇄ Dishky team). Identical file in the Admin Panel, the Super Admin console
 * and the Developer Panel; it only needs React and its own stylesheet.
 *
 *   <FloatingChat
 *     title="Dishky Support"                // chat window heading
 *     subtitle="DSK-1042 · In progress"     // line under the heading
 *     messages={[{ id, body, side: "me" | "them", author, at }]}
 *     canSend={true}
 *     disabledNote="This ticket is closed." // shown instead of the composer when !canSend
 *     onSend={async (text) => { … }}        // must throw / reject on failure — the draft is then kept
 *     storageKey={ticketId}                 // remembers what has been read, per ticket
 *     attention="Dishky needs your reply"   // optional teaser above the launcher
 *     placeholder="Write a message…"
 *     themLabel="Dishky Support"            // fallback author name for the other side
 *   />
 *
 * The launcher bounces in, pulses and shows a badge while there are unread messages from the other side.
 * The window springs open from the launcher; Enter sends, Shift+Enter adds a line, Esc minimises.
 */

const EXIT_MS = 200;
const MAX_LEN = 4000;

const dayKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`; };
const timeLabel = (d) => (d ? new Date(d).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "");
function dayLabel(d) {
  const x = new Date(d);
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  if (dayKey(x) === dayKey(today)) return "Today";
  if (dayKey(x) === dayKey(yest)) return "Yesterday";
  return x.toLocaleDateString(undefined, { dateStyle: "medium" });
}
const initialOf = (s) => (String(s || "?").trim().charAt(0) || "?").toUpperCase();

function readSeen(key) {
  try { return Number(window.localStorage.getItem(`fc_seen_${key}`)) || 0; } catch { return 0; }
}
function writeSeen(key, n) {
  try { window.localStorage.setItem(`fc_seen_${key}`, String(n)); } catch { /* storage may be blocked */ }
}

const ChatIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.6-.8L3 21l1.9-5.1A8.4 8.4 0 1 1 21 11.5z" />
    <path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" strokeWidth="2.6" />
  </svg>
);
const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7z" />
  </svg>
);
const MinimiseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
);

export default function FloatingChat({
  title = "Support chat",
  subtitle,
  messages = [],
  canSend = true,
  disabledNote,
  onSend,
  storageKey = "default",
  attention,
  placeholder = "Write a message…",
  themLabel = "Support",
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [seen, setSeen] = useState(() => readSeen(storageKey));
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const closeTimer = useRef(null);
  const knownIds = useRef(null);      // ids already on screen — anything else animates in
  const stickToBottom = useRef(true);

  const themCount = useMemo(() => messages.filter((m) => m.side === "them").length, [messages]);
  const unread = open ? 0 : Math.max(0, themCount - seen);

  // Re-read the stored marker when the conversation changes (navigating between tickets).
  useEffect(() => { setSeen(readSeen(storageKey)); knownIds.current = null; setOpen(false); setClosing(false); setDraft(""); setSendError(""); }, [storageKey]);
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  const markRead = useCallback(() => { setSeen(themCount); writeSeen(storageKey, themCount); }, [themCount, storageKey]);
  // While the window is open, anything that arrives counts as read straight away.
  useEffect(() => { if (open) markRead(); }, [open, markRead]);

  const openChat = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    setClosing(false); setOpen(true); stickToBottom.current = true;
  };
  const closeChat = useCallback(() => {
    if (!open || closing) return;
    setClosing(true);
    closeTimer.current = setTimeout(() => { setOpen(false); setClosing(false); closeTimer.current = null; }, EXIT_MS);
  }, [open, closing]);

  // Esc minimises.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") closeChat(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeChat]);

  // Focus the composer when the window opens.
  useEffect(() => { if (open && canSend) { const t = setTimeout(() => inputRef.current && inputRef.current.focus(), 260); return () => clearTimeout(t); } return undefined; }, [open, canSend]);

  // Scroll to the newest message: always on open / own message, otherwise only when already near the bottom.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!open || !el) return;
    if (stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [open, messages.length, sending]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  // Auto-grow composer (up to ~4 lines).
  useLayoutEffect(() => {
    const t = inputRef.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${Math.min(t.scrollHeight, 110)}px`;
  }, [draft, open]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending || !onSend) return;
    setSending(true); setSendError("");
    stickToBottom.current = true;
    try {
      await onSend(text);
      setDraft("");
    } catch (e) {
      setSendError((e && e.message) || "Could not send your message.");
    } finally {
      setSending(false);
      if (inputRef.current) inputRef.current.focus();
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
  };

  // Which messages are new since the window last rendered them → slide-in animation.
  const rendered = useMemo(() => {
    const prev = knownIds.current;
    return messages.map((m) => ({ ...m, isNew: !!prev && !prev.has(m.id) }));
  }, [messages]);
  useEffect(() => { if (open) knownIds.current = new Set(messages.map((m) => m.id)); }, [open, messages]);

  let lastDay = "";
  const showTeaser = !open && !closing && attention && unread === 0;

  return (
    <div className="fc-root">
      {open && (
        <section className={`fc-window${closing ? " is-closing" : ""}`} role="dialog" aria-label={title} aria-modal="false">
          <header className="fc-head">
            <div className="fc-avatar" aria-hidden="true">{initialOf(themLabel)}<span className="fc-online" /></div>
            <div className="fc-head-text">
              <strong>{title}</strong>
              {subtitle && <span>{subtitle}</span>}
            </div>
            <button type="button" className="fc-icon-btn" onClick={closeChat} aria-label="Minimise chat" title="Minimise"><MinimiseIcon /></button>
          </header>

          <div className="fc-list" ref={listRef} onScroll={onScroll} role="log" aria-live="polite">
            {rendered.length === 0 && (
              <div className="fc-empty">
                <span className="fc-empty-bubble"><ChatIcon /></span>
                <p>No messages yet.</p>
                <small>{canSend ? "Write below — the other side is notified right away." : "Messages will appear here."}</small>
              </div>
            )}
            {rendered.map((m) => {
              const k = dayKey(m.at || Date.now());
              const sep = k !== lastDay ? <div className="fc-day" key={`d-${k}-${m.id}`}><span>{dayLabel(m.at || Date.now())}</span></div> : null;
              lastDay = k;
              return (
                <React.Fragment key={m.id}>
                  {sep}
                  <div className={`fc-row ${m.side === "me" ? "is-me" : "is-them"}${m.isNew ? " is-new" : ""}`}>
                    {m.side !== "me" && <span className="fc-mini-avatar" aria-hidden="true">{initialOf(m.author || themLabel)}</span>}
                    <div className="fc-bubble-wrap">
                      {(m.side !== "me" || m.showAuthor) && <span className="fc-author">{m.author || themLabel}</span>}
                      <div className="fc-bubble">{m.body}</div>
                      <span className="fc-time">{timeLabel(m.at)}</span>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            {sending && (
              <div className="fc-row is-me is-new"><div className="fc-bubble-wrap"><div className="fc-bubble fc-sending"><i /><i /><i /></div></div></div>
            )}
          </div>

          {canSend ? (
            <footer className="fc-compose">
              {sendError && <div className="fc-error" role="alert">{sendError}</div>}
              <div className="fc-compose-row">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={draft}
                  maxLength={MAX_LEN}
                  placeholder={placeholder}
                  aria-label="Message"
                  onChange={(e) => { setDraft(e.target.value); if (sendError) setSendError(""); }}
                  onKeyDown={onKeyDown}
                />
                <button type="button" className="fc-send" onClick={send} disabled={!draft.trim() || sending} aria-label="Send message" title="Send"><SendIcon /></button>
              </div>
              <span className="fc-hint">Enter to send · Shift+Enter for a new line</span>
            </footer>
          ) : (
            <footer className="fc-compose fc-disabled">{disabledNote || "You can't reply to this conversation."}</footer>
          )}
        </section>
      )}

      {showTeaser && (
        <button type="button" className="fc-teaser" onClick={openChat}>
          <span className="fc-teaser-dot" />{attention}
        </button>
      )}

      {(!open || closing) && (
        <button
          type="button"
          className={`fc-launcher${unread > 0 ? " has-unread" : ""}`}
          onClick={openChat}
          aria-label={unread > 0 ? `Open chat, ${unread} unread message${unread === 1 ? "" : "s"}` : "Open chat"}
          title="Chat"
        >
          <span className="fc-launcher-ring" aria-hidden="true" />
          <ChatIcon />
          {unread > 0 && <span className="fc-badge">{unread > 9 ? "9+" : unread}</span>}
        </button>
      )}
    </div>
  );
}
