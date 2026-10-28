import React, { useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { fadeUp, staggerChildren } from "../../animations/variants.js";
import { viewportOnce } from "../../animations/transitions.js";
import { submitDemoRequest } from "../../services/api.js";
import { gsap } from "../../animations/gsapSetup.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";
import useMediaQuery, { QUERIES } from "../../hooks/useMediaQuery.js";
import ParallaxImage from "../ParallaxImage/ParallaxImage.js";
import { images } from "../../assets/images/imageUrls.js";
import { toast } from "../Toast/Toast.js";
import SuccessCard from "../Toast/SuccessCard.js";
import SelectBox from "../Form/SelectBox.js";
import { collect, formatName, formatTitle, formatEmail, sanitizePhone, formatDigits, vName, vRequired, vEmail, vPhone } from "../../utils/validate.js";

const initialForm = {
  restaurantName: "",
  contactName: "",
  phone: "",
  email: "",
  city: "",
  restaurantType: "",
  restaurantTypeOther: "",
  numberOfOutlets: "1",
  currentSoftware: "",
  message: "",
};

// Field definitions drive the form so labels, mobile keyboards and autofill
// hints are declared in one place instead of nine copy-pasted <input>s.
export const RESTAURANT_TYPES = ["Cafe", "Fine Dining", "Quick Service (QSR)", "Cloud Kitchen", "Bakery & Sweets"];
const OTHER = "Other";

const fields = [
  { name: "restaurantName", label: "Restaurant name", autoComplete: "organization", required: true, fmt: formatTitle, max: 80 },
  { name: "contactName", label: "Owner / manager name", autoComplete: "name", required: true, fmt: formatName, max: 60 },
  { name: "phone", label: "Mobile number", type: "tel", inputMode: "numeric", autoComplete: "tel-national", required: true, fmt: sanitizePhone, placeholder: "10-digit mobile number" },
  { name: "email", label: "Email", type: "email", inputMode: "email", autoComplete: "email", required: true, fmt: formatEmail, max: 100 },
  { name: "city", label: "City", autoComplete: "address-level2", fmt: formatName, max: 60 },
  { name: "restaurantType", label: "Restaurant type", type: "select" },
  { name: "numberOfOutlets", label: "Number of outlets", type: "text", inputMode: "numeric", fmt: (v) => formatDigits(v, 3), max: 3 },
  { name: "currentSoftware", label: "Current software (if any)", fmt: formatTitle, max: 60 },
];

export function DemoRequestForm() {
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
    const [invalid, setInvalid] = useState([]); // names of fields that failed the check

  const handleChange = (e) => {
    const { name, value } = e.target;
    const f = fields.find((x) => x.name === name);
    setForm((cur) => ({ ...cur, [name]: f?.fmt ? f.fmt(value) : value }));
    setInvalid((list) => list.filter((n) => n !== name));
  };

  const pickType = (v) => {
    setForm((cur) => ({ ...cur, restaurantType: v }));
    if (v === OTHER) setTimeout(() => document.getElementById("demo-restaurantTypeOther")?.focus(), 0);
  };

  // Checked here instead of by the browser, so no native bubble appears.
  // Failing fields get a red outline and the first problem is raised as a toast.
  const check = () =>
    collect([
      ["restaurantName", vRequired(form.restaurantName, "Restaurant name")],
      ["contactName", vName(form.contactName, "Owner / manager name")],
      ["phone", vPhone(form.phone, { required: true })],
      ["email", vEmail(form.email)],
      ["restaurantTypeOther", form.restaurantType === OTHER && !form.restaurantTypeOther.trim() ? "Enter your restaurant type." : ""],
      ["numberOfOutlets", String(form.numberOfOutlets).trim() !== "" && Number(form.numberOfOutlets) < 1 ? "Number of outlets must be at least 1." : ""],
    ]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = check();
    if (res.fields.length) {
      setInvalid(res.fields);
      setStatus("error");
      toast.error(res.first);
      const el = document.getElementById(`demo-${res.fields[0]}`);
      if (el) el.focus();
      return;
    }
    setStatus("loading");
    try {
      const { restaurantTypeOther, ...rest } = form;
      await submitDemoRequest({
        ...rest,
        restaurantType: form.restaurantType === OTHER ? restaurantTypeOther.trim() : form.restaurantType,
        numberOfOutlets: Number(form.numberOfOutlets) || 1,
      });
      setStatus("success");
      setForm(initialForm);
      toast.success("Demo request received. Our team will reach out shortly.");
    } catch (err) {
      setStatus("error");
      toast.error(err.message || "Couldn't send your request. Please try again.");
    }
  };

  if (status === "success") {
    return <SuccessCard dark title="Demo request received" text="Our team will reach out shortly." />;
  }

  return (
    <form onSubmit={handleSubmit} noValidate autoComplete="on" className="form-grid content-start rounded-3xl bg-white/5 p-5 sm:p-8">
      {fields.map((f) => (
        <div key={f.name} className="field">
          <label htmlFor={`demo-${f.name}`} className="text-cream/80">
            {f.label}
            {f.required && <span aria-hidden="true" className="text-amber"> *</span>}
          </label>
          {f.type === "select" ? (
            <>
              <SelectBox
                id={`demo-${f.name}`}
                dark
                value={form.restaurantType}
                onChange={pickType}
                options={[...RESTAURANT_TYPES, OTHER]}
                placeholder="Select restaurant type"
              />
              {form.restaurantType === OTHER && (
                <input
                  id="demo-restaurantTypeOther"
                  name="restaurantTypeOther"
                  type="text"
                  maxLength={60}
                  placeholder="Enter your restaurant type"
                  aria-invalid={invalid.includes("restaurantTypeOther") || undefined}
                  value={form.restaurantTypeOther}
                  onChange={(e) => { setForm((cur) => ({ ...cur, restaurantTypeOther: formatTitle(e.target.value) })); setInvalid((l) => l.filter((n) => n !== "restaurantTypeOther")); }}
                  className="input input-dark mt-2"
                />
              )}
            </>
          ) : (
          <input
            id={`demo-${f.name}`}
            name={f.name}
            type={f.type || "text"}
            inputMode={f.inputMode}
            autoComplete={f.autoComplete}
            maxLength={f.max}
            autoCapitalize={f.fmt === formatEmail ? "none" : undefined}
            aria-required={f.required || undefined}
            aria-invalid={invalid.includes(f.name) || undefined}
            placeholder={f.placeholder}
            value={form[f.name]}
            onChange={handleChange}
            className="input input-dark"
          />
          )}
        </div>
      ))}

      <div className="field col-span-full">
        <label htmlFor="demo-message" className="text-cream/80">Message (optional)</label>
        <textarea
          id="demo-message"
          name="message"
          rows={3}
          maxLength={500}
          value={form.message}
          onChange={handleChange}
          className="input input-dark"
        />
      </div>

      <button
        type="submit"
        disabled={status === "loading"}
        className="btn-primary col-span-full disabled:opacity-60"
      >
        {status === "loading" ? "Sending..." : "Book a Demo"} <ArrowRight size={18} />
      </button>
    </form>
  );
}

export default function FinalCTASection() {
  const sectionRef = useRef(null);
  const glowRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const finePointer = useMediaQuery(QUERIES.finePointer);

  // A soft amber glow drifts upward behind the closing section as it
  // scrolls through — a quiet parallax "warm-up" behind the final CTA
  // rather than a static background.
  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section || reducedMotion || !finePointer) return;

    const ctx = gsap.context(() => {
      gsap.to(glowRef.current, {
        yPercent: -35,
        scale: 1.4,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      });
    }, section);

    return () => ctx.revert();
  }, [reducedMotion, finePointer]);

  return (
    <section ref={sectionRef} data-nav-theme="dark" className="relative overflow-hidden bg-ink text-cream" style={{ paddingBlock: "var(--section-space)" }} id="book-demo">
      <ParallaxImage
        src={images.restaurantInterior1}
        art="cta"
        alt=""
        className="absolute inset-0 opacity-40 md:opacity-50"
        strength={14}
        mobilePosition="60% center"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/50 via-ink/70 to-ink" />
      <div
        ref={glowRef}
        className="glow left-1/2 top-1/3 h-[300px] w-[300px] -translate-x-1/2 bg-amber/10 md:h-[420px] md:w-[420px]"
      />

      <div className="container-dishky relative grid gap-[var(--gap-xl)] lg:grid-cols-2 lg:items-stretch">
        <motion.div
          variants={staggerChildren(0.1)}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
        >
          <motion.h2 variants={fadeUp} className="heading-lg">
            READY TO RUN <span className="br-desktop"><br /></span>YOUR RESTAURANT{" "}
            <span className="block text-amber">DIFFERENTLY?</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-lead mt-5 max-w-md text-cream/60 md:mt-6">
            Bring your restaurant's customers, operations and business
            management into one connected platform.
          </motion.p>
          <motion.div variants={fadeUp} className="cta-row mt-7 md:mt-8">
            <Link to="/pricing" className="btn-primary">Start with Dishky</Link>
            <Link to="/contact" className="btn-secondary !border-cream/20 !text-cream hover:!border-cream/50">
              Talk to Sales
            </Link>
          </motion.div>
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={viewportOnce} className="min-w-0 h-full">
          <DemoRequestForm />
        </motion.div>
      </div>
    </section>
  );
}
