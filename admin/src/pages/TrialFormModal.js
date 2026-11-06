/**
 * TrialFormModal.js  —  Dishky Admin Panel   (prefix: td-)
 * "Add Trial Dish" / "Edit Trial Dish" dialog. Used by the list page and the trial page.
 * Required: dish name, category, ingredients (≥ 1), assigned chef, start + expected completion dates.
 * The picture is shrunk in the browser before it is sent (see readDishImage).
 */
import React, { useEffect, useState } from "react";

import api from "../api";
import closeIcon from "../icon/close-icon.png";
import { allowTextInput } from "../App";
import { useToast } from "../useToast";
import { useVenue } from "../context/VenueContext";
import Button3D from "../components/Button3D";
import CustomDropdown from "../components/CustomDropdown";
import { CustomDatePicker } from "../components/CustomDatePicker";
import { errMsg, Mat, readDishImage, todayStr, cap } from "./TrialDishShared";

const blankIng = () => ({ name: "", quantity: "", unit: "" });
const EMPTY = () => ({
  name: "", image: "", description: "", category: "", ingredients: [blankIng()], preparationMethod: "", assignedStaffId: "",
  estimatedCost: "", sellingPrice: "", trialStartDate: todayStr(), expectedCompletion: "", priority: "medium", remarks: "",
});

export default function TrialFormModal({ modal, trial, meta, staffOptions, categoryOptions, onSaved }) {
  const { toast } = useToast();
  const { venueId, venueParam } = useVenue();
  const [form, setForm] = useState(EMPTY());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [imageChanged, setImageChanged] = useState(false);
  const editing = !!trial;

  useEffect(() => {
    if (!modal.shouldRender) return undefined;
    setErrors({}); setImageChanged(false);
    if (!trial) { setForm(EMPTY()); return undefined; }
    // the list rows are slim — load the full trial (ingredients, method) for editing
    let live = true;
    setLoadingDetail(true);
    api.get(`/trial-dishes/${trial.id}`, { params: venueParam() }).then((r) => {
      if (!live) return;
      const d = r.data;
      setForm({
        name: d.name || "", image: d.image || "", description: d.description || "", category: d.category || "",
        ingredients: d.ingredients && d.ingredients.length ? d.ingredients.map((i) => ({ ...i })) : [blankIng()],
        preparationMethod: d.preparationMethod || "", assignedStaffId: d.assignedStaffId || "",
        estimatedCost: d.estimatedCost || "", sellingPrice: d.sellingPrice || "", trialStartDate: d.trialStartDate || "",
        expectedCompletion: d.expectedCompletion || "", priority: d.priority || "medium", remarks: d.remarks || "",
      });
    }).catch((e) => { toast.error(errMsg(e, "Could not load the trial")); modal.close(); })
      .finally(() => live && setLoadingDetail(false));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal.shouldRender, trial && trial.id]);

  if (!modal.shouldRender || !meta) return null;

  const set = (k) => (v) => { setForm((p) => ({ ...p, [k]: v && v.target ? v.target.value : v })); setErrors((p) => ({ ...p, [k]: "" })); };
  const setText = (k, max, words) => (e) => { setForm((p) => ({ ...p, [k]: allowTextInput(p[k], e.target.value, max, words) })); setErrors((p) => ({ ...p, [k]: "" })); };
  const setIng = (i, k, v) => { setForm((p) => ({ ...p, ingredients: p.ingredients.map((x, n) => (n === i ? { ...x, [k]: v } : x)) })); setErrors((p) => ({ ...p, ingredients: "" })); };
  const addIng = () => setForm((p) => (p.ingredients.length >= 60 ? p : { ...p, ingredients: [...p.ingredients, blankIng()] }));
  const delIng = (i) => setForm((p) => ({ ...p, ingredients: p.ingredients.length > 1 ? p.ingredients.filter((_, n) => n !== i) : [blankIng()] }));

  const pickImage = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    try { const url = await readDishImage(f); setForm((p) => ({ ...p, image: url })); setImageChanged(true); }
    catch (err) { toast.error(err.message); }
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Dish name is required";
    if (!form.category) e.category = "Choose a food category";
    if (!form.ingredients.some((i) => i.name.trim())) e.ingredients = "Add at least one ingredient";
    if (!form.assignedStaffId) e.assignedStaffId = "Assign a chef / staff member";
    if (form.estimatedCost !== "" && !(Number(form.estimatedCost) >= 0)) e.estimatedCost = "Enter a valid cost";
    if (form.sellingPrice !== "" && !(Number(form.sellingPrice) >= 0)) e.sellingPrice = "Enter a valid price";
    if (!form.trialStartDate) e.trialStartDate = "Choose the start date";
    if (!form.expectedCompletion) e.expectedCompletion = "Choose the expected completion date";
    else if (form.trialStartDate && form.expectedCompletion < form.trialStartDate) e.expectedCompletion = "Cannot be before the start date";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async () => {
    if (!validate()) { toast.error("Please fix the highlighted fields"); return; }
    setSaving(true);
    try {
      const body = {
        ...form,
        ingredients: form.ingredients.filter((i) => i.name.trim()),
        estimatedCost: form.estimatedCost === "" ? 0 : Number(form.estimatedCost),
        sellingPrice: form.sellingPrice === "" ? 0 : Number(form.sellingPrice),
      };
      if (editing && !imageChanged) delete body.image; // keep the stored picture untouched
      const res = editing
        ? await api.put(`/trial-dishes/${trial.id}`, body)
        : await api.post("/trial-dishes", { ...body, venueId: venueId || undefined });
      toast.success(editing ? "Trial dish updated" : `Trial ${res.data.trialId} created`);
      modal.close();
      onSaved && onSaved(res.data);
    } catch (err) { toast.error(errMsg(err, "Could not save the trial dish")); }
    finally { setSaving(false); }
  };

  const cats = categoryOptions.some((c) => c.value === form.category) || !form.category ? categoryOptions : [...categoryOptions, { value: form.category, label: form.category }];

  return (
    <div className={`modal-overlay ${modal.overlayClass}`}>
      <form className={`admin-modal td-form-modal ${modal.modalClass}`} onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
        <div className="admin-modal-header">
          <h3>{editing ? `Edit Trial Dish — ${trial.trialId}` : "Add Trial Dish"}</h3>
          <Button3D variant="cancel" iconOnly aria-label="Close" onClick={() => modal.close()}><img src={closeIcon} alt="" /></Button3D>
        </div>
        <div className="admin-modal-body">
          {loadingDetail ? <p className="td-muted">Loading…</p> : (
            <>
              <Mat label="Dish name" required error={errors.name}>
                <input className={`mat-input${errors.name ? " mat-error" : ""}`} placeholder=" " autoFocus maxLength={100} value={form.name} onChange={set("name")} />
              </Mat>

              {/* picture — same picker + crop + preview as Dishes / Categories */}
              <div className="admin-form-group">
                <div className="file-wrap">
                  <input type="file" accept="image/*" onChange={pickImage} className="file-input" />
                  <div className="file-label">{form.image ? "✔ Dish Image selected" : "Choose Dish Image"}</div>
                </div>
                {form.image && (
                  <>
                    <img src={form.image} alt="Preview" className="staff-image-preview" />
                    <div><button type="button" className="td-link" onClick={() => { setForm((p) => ({ ...p, image: "" })); setImageChanged(true); }}>Remove image</button></div>
                  </>
                )}
              </div>

              <Mat label="Description">
                <textarea className="mat-input mat-textarea" placeholder=" " value={form.description} onChange={setText("description", 1000, 200)} />
              </Mat>

              <div className="horizontal-form-group">
                <div className="admin-form-group">
                  <CustomDropdown label="Food category" required value={form.category} onChange={set("category")} options={cats} placeholder="Select category" hasError={!!errors.category} />
                  {errors.category && <div className="field-error-msg">{errors.category}</div>}
                </div>
                <div className="admin-form-group">
                  <CustomDropdown label="Assigned chef / staff" required value={form.assignedStaffId} onChange={set("assignedStaffId")} options={staffOptions} placeholder="Select staff" hasError={!!errors.assignedStaffId} />
                  {errors.assignedStaffId && <div className="field-error-msg">{errors.assignedStaffId}</div>}
                </div>
              </div>

              {/* ingredients */}
              <div className="admin-form-group">
                <label className="td-field-label">Ingredients<span className="rf-req">*</span></label>
                <div className="td-ing-list">
                  {form.ingredients.map((ing, i) => (
                    <div className="td-ing-row" key={i}>
                      <input className={`td-input td-ing-name${errors.ingredients && !ing.name.trim() ? " td-input-error" : ""}`} placeholder="Ingredient" maxLength={80} value={ing.name} onChange={(e) => setIng(i, "name", e.target.value)} />
                      <input className="td-input td-ing-qty" placeholder="Qty" maxLength={30} value={ing.quantity} onChange={(e) => setIng(i, "quantity", e.target.value)} />
                      <input className="td-input td-ing-unit" placeholder="Unit" maxLength={20} value={ing.unit} onChange={(e) => setIng(i, "unit", e.target.value)} />
                      <button type="button" className="td-icon-btn" aria-label="Remove ingredient" onClick={() => delIng(i)}>✕</button>
                    </div>
                  ))}
                </div>
                {errors.ingredients && <div className="field-error-msg">{errors.ingredients}</div>}
                <button type="button" className="td-link" onClick={addIng}>+ Add ingredient</button>
              </div>

              <Mat label="Preparation method">
                <textarea className="mat-input mat-textarea" placeholder=" " value={form.preparationMethod} onChange={setText("preparationMethod", 4000, 700)} />
              </Mat>

              <div className="horizontal-form-group">
                <Mat label="Estimated preparation cost (₹)" error={errors.estimatedCost}>
                  <input className={`mat-input${errors.estimatedCost ? " mat-error" : ""}`} placeholder=" " inputMode="decimal" value={form.estimatedCost}
                    onChange={(e) => set("estimatedCost")(e.target.value.replace(/[^\d.]/g, "").slice(0, 10))} />
                </Mat>
                <Mat label="Proposed selling price (₹)" error={errors.sellingPrice}>
                  <input className={`mat-input${errors.sellingPrice ? " mat-error" : ""}`} placeholder=" " inputMode="decimal" value={form.sellingPrice}
                    onChange={(e) => set("sellingPrice")(e.target.value.replace(/[^\d.]/g, "").slice(0, 10))} />
                </Mat>
              </div>

              <div className="horizontal-form-group">
                <div className="admin-form-group">
                  <label className="td-field-label">Trial start date<span className="rf-req">*</span></label>
                  <CustomDatePicker value={form.trialStartDate} onChange={set("trialStartDate")} />
                  {errors.trialStartDate && <div className="field-error-msg">{errors.trialStartDate}</div>}
                </div>
                <div className="admin-form-group">
                  <label className="td-field-label">Expected completion<span className="rf-req">*</span></label>
                  <CustomDatePicker value={form.expectedCompletion} onChange={set("expectedCompletion")} min={form.trialStartDate || undefined} placeholder="Select date" />
                  {errors.expectedCompletion && <div className="field-error-msg">{errors.expectedCompletion}</div>}
                </div>
              </div>

              <div className="admin-form-group">
                <CustomDropdown label="Priority" value={form.priority} onChange={set("priority")} options={meta.priorities.map((p) => ({ value: p, label: cap(p) }))} placeholder={null} />
              </div>

              <Mat label="Remarks">
                <textarea className="mat-input mat-textarea" placeholder=" " value={form.remarks} onChange={setText("remarks", 1000, 200)} />
              </Mat>
            </>
          )}
        </div>
        <div className="admin-modal-footer">
          <Button3D variant="cancel" onClick={() => modal.close()}>Cancel</Button3D>
          <Button3D type="submit" disabled={saving || loadingDetail}>{saving ? "Saving…" : editing ? "Save Changes" : "Add Trial Dish"}</Button3D>
        </div>
      </form>
    </div>
  );
}
