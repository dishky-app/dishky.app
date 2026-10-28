import React, { useState } from "react";
import PageBackdrop from "../components/ReactBits/PageBackdrop.js";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, MessageSquare, CalendarCheck, Tag, Compass } from "lucide-react";
import { fadeUp, staggerChildren } from "../animations/variants.js";
import { submitContact } from "../services/api.js";
import { toast } from "../components/Toast/Toast.js";
import SuccessCard from "../components/Toast/SuccessCard.js";
import { collect, formatName, formatEmail, sanitizePhone, vName, vEmail, vPhone, vRequired } from "../utils/validate.js";

const initialForm = { name: "", email: "", phone: "", message: "" };

export default function Contact() {
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState("idle");
  const [invalid, setInvalid] = useState([]); // names of fields that failed the check

  const FMT = { name: formatName, email: formatEmail, phone: sanitizePhone };
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: FMT[name] ? FMT[name](value) : value }));
    setInvalid((list) => list.filter((n) => n !== name));
  };

  // Checked here instead of by the browser, so no native "Please fill out this
  // field" bubble appears. Failing fields get a red outline; the first problem is a toast.
  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = collect([
      ["name", vName(form.name, "Your name")],
      ["email", vEmail(form.email)],
      ["phone", vPhone(form.phone)],
      ["message", vRequired(form.message, "Message")],
    ]);
    if (res.fields.length) {
      setInvalid(res.fields);
      toast.error(res.first);
      const el = document.getElementById(`contact-${res.fields[0]}`);
      if (el) el.focus();
      return;
    }
    setStatus("loading");
    try {
      await submitContact(form);
      setStatus("success");
      setForm(initialForm);
      toast.success("Message sent. We'll get back to you soon.");
    } catch (err) {
      setStatus("error");
      toast.error(err.message || "Couldn't send your message. Please try again.");
    }
  };

  return (
    <div className="relative isolate min-h-screen-safe overflow-x-clip bg-white" style={{ paddingTop: "calc(var(--header-clearance) + clamp(24px, 6vw, 64px))", paddingBottom: "var(--section-space)" }}>
      <PageBackdrop tone="light" />
      <div className="container-dishky">
        <motion.div variants={staggerChildren(0.1)} initial="hidden" animate="visible" className="max-w-3xl">
          <motion.p variants={fadeUp} className="text-xs font-extrabold uppercase tracking-[0.25em] text-amber">Contact</motion.p>
          <motion.h1 variants={fadeUp} className="mt-3 font-display font-extrabold leading-[0.92] tracking-tight text-ink" style={{ fontSize: "clamp(2.75rem, 9vw, 7rem)" }}>Say hello. <span className="text-amber">We reply.</span></motion.h1>
          <motion.p variants={fadeUp} className="text-lead mt-5 max-w-lg text-ink/60">Questions about Dishky, pricing, or your restaurant's setup? Send us a message.</motion.p>
        </motion.div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.15fr] lg:gap-10">
          <motion.div variants={staggerChildren(0.1)} initial="hidden" animate="visible" className="grid content-start gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {[
              [MessageSquare, "Ask a question", "Use the form. A real person reads every message.", null],
              [CalendarCheck, "See it in action", "Book a walkthrough of the guest and admin panels.", "/book-demo"],
              [Tag, "Talk about plans", "Not sure which plan fits? Start with the plan finder.", "/pricing"],
              [Compass, "Explore on your own", "Browse every module with live demos.", "/features"],
            ].map(([Icon, t, d, to]) => {
              const inner = (
                <>
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ink text-white transition-colors group-hover:bg-amber"><Icon size={20} /></span>
                  <span><span className="block font-display text-lg font-bold text-ink">{t}</span><span className="block text-sm text-ink/60">{d}</span></span>
                </>
              );
              const cls = "group flex items-center gap-4 rounded-3xl bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl md:p-5";
              return <motion.div key={t} variants={fadeUp}>{to ? <Link to={to} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>}</motion.div>;
            })}
          </motion.div>
          <motion.div variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.15 }} className="min-w-0 h-full">
          {status === "success" ? (
            <SuccessCard title="Message sent" text="We'll get back to you soon." className="card-surface" />
          ) : (
            <form onSubmit={handleSubmit} noValidate className="card-surface grid gap-4 p-5 sm:p-8">
              <div className="field">
                <label htmlFor="contact-name">Your name <span aria-hidden="true" className="text-amber">*</span></label>
                <input id="contact-name" maxLength={60} aria-required="true" aria-invalid={invalid.includes("name") || undefined} name="name" autoComplete="name" value={form.name} onChange={handleChange} className="input" />
              </div>
              <div className="field">
                <label htmlFor="contact-email">Email <span aria-hidden="true" className="text-amber">*</span></label>
                <input id="contact-email" maxLength={100} autoCapitalize="none" aria-required="true" aria-invalid={invalid.includes("email") || undefined} type="email" name="email" inputMode="email" autoComplete="email" value={form.email} onChange={handleChange} className="input" />
              </div>
              <div className="field">
                <label htmlFor="contact-phone">Mobile number (optional)</label>
                <input id="contact-phone" type="tel" name="phone" placeholder="10-digit mobile number" aria-invalid={invalid.includes("phone") || undefined} inputMode="numeric" autoComplete="tel-national" value={form.phone} onChange={handleChange} className="input" />
              </div>
              <div className="field">
                <label htmlFor="contact-message">Message <span aria-hidden="true" className="text-amber">*</span></label>
                <textarea id="contact-message" maxLength={500} aria-required="true" aria-invalid={invalid.includes("message") || undefined} name="message" rows={4} value={form.message} onChange={handleChange} className="input" />
              </div>
              <button type="submit" disabled={status === "loading"} className="btn-primary disabled:opacity-60">
                {status === "loading" ? "Sending..." : "Send Message"} <ArrowRight size={18} />
              </button>
            </form>
          )}
        </motion.div>
        </div>
      </div>
    </div>
  );
}
