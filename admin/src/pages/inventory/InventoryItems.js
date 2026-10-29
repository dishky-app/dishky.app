/** InventoryItems.js — item master: units & conversions, thresholds, tracking, GST. */
import React, { useState } from "react";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../useToast";
import { Badge, Btn, DataTable, Field, Modal, PageHead, SearchBox, Select, Toolbar, errText, qty, useDebounced, usePagedList, useRef_ } from "./InvUi";

const TYPES = ["ingredient", "raw_material", "packaging", "beverage", "cleaning", "other"];
const label = (t) => t.replace("_", " ");
const EMPTY = {
  name: "", sku: "", description: "", itemType: "ingredient", categoryId: "", brand: "", barcode: "",
  baseUnit: "kg", purchaseUnit: "", conversions: [], preferredSupplierId: "",
  minStock: "", reorderPoint: "", safetyStock: "", maxStock: "", reorderQty: "",
  trackBatches: false, trackExpiry: false, requiresInspection: false, allowNegativeStock: false,
  gstRate: "", hsn: "", status: "active",
};

function ItemForm({ item, units, suppliers, categories, onClose, onSaved }) {
  const { toast } = useToast();
  const editing = !!item;
  const [f, setF] = useState(() => (item
    ? { ...EMPTY, ...item, categoryId: item.categoryId || "", preferredSupplierId: item.preferredSupplierId || "", gstRate: item.gstRate ?? "",
        minStock: item.minStock || "", reorderPoint: item.reorderPoint || "", safetyStock: item.safetyStock || "", maxStock: item.maxStock || "", reorderQty: item.reorderQty || "" }
    : EMPTY));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setF((p) => ({ ...p, [k]: e.target.value })); setErrors((p) => ({ ...p, [k]: "" })); };
  const flag = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.checked }));
  const unitCodes = [...units.system.map((u) => u.code), ...units.custom.map((u) => u.code)];
  const addConv = () => setF((p) => ({ ...p, conversions: [...p.conversions, { unit: "", factor: "" }] }));
  const setConv = (i, k, v) => setF((p) => ({ ...p, conversions: p.conversions.map((c, j) => (j === i ? { ...c, [k]: v } : c)) }));
  const delConv = (i) => setF((p) => ({ ...p, conversions: p.conversions.filter((_, j) => j !== i) }));
  const packagingUnits = f.conversions.map((c) => c.unit).filter(Boolean);

  const validate = () => {
    const e = {};
    if (!f.name.trim()) e.name = "Name is required";
    if (!f.baseUnit) e.baseUnit = "Base unit is required";
    f.conversions.forEach((c, i) => {
      if (!c.unit.trim() || !(Number(c.factor) > 0)) e[`conv${i}`] = "Needs a unit name and a factor above 0";
    });
    if (f.gstRate !== "" && (Number(f.gstRate) < 0 || Number(f.gstRate) > 100)) e.gstRate = "Between 0 and 100";
    for (const k of ["minStock", "reorderPoint", "safetyStock", "maxStock", "reorderQty"]) if (f[k] !== "" && Number(f[k]) < 0) e[k] = "Cannot be negative";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      const body = { ...f, conversions: f.conversions.map((c) => ({ unit: c.unit.trim(), factor: Number(c.factor) })) };
      for (const k of ["id", "createdAt", "updatedAt", "createdBy", "costingMethod", "minStockMilli", "reorderPointMilli", "safetyStockMilli", "maxStockMilli", "reorderQtyMilli"]) delete body[k];
      if (!body.sku) delete body.sku;
      if (editing) delete body.sku;
      const { data } = editing ? await api.patch(`/inventory/items/${item.id}`, body) : await api.post("/inventory/items", body);
      toast.success(editing ? "Item updated" : `Item ${data.sku} created`);
      onSaved();
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };

  const numField = (k, text, hint) => (
    <Field label={text} error={errors[k]} hint={hint}><input className={`inv-input${errors[k] ? " inv-invalid" : ""}`} inputMode="decimal" value={f[k]} onChange={set(k)} /></Field>
  );

  return (
    <Modal title={editing ? `Edit ${item.name}` : "New inventory item"} onClose={onClose} wide
      footer={<><Btn type="button" kind="plain" onClick={onClose}>Cancel</Btn><Btn type="submit" form="inv-item-form" kind="primary" disabled={busy}>{busy ? "Saving…" : "Save item"}</Btn></>}>
      <form id="inv-item-form" onSubmit={submit} noValidate>
        <div className="inv-grid">
          <Field label="Item name" required error={errors.name} full><input className={`inv-input${errors.name ? " inv-invalid" : ""}`} value={f.name} onChange={set("name")} maxLength={200} /></Field>
          <Field label="SKU" hint={editing ? "Cannot be changed" : "Leave blank to auto-generate"}><input className="inv-input" value={f.sku} disabled={editing} onChange={set("sku")} maxLength={40} /></Field>
          <Field label="Barcode"><input className="inv-input" value={f.barcode} onChange={set("barcode")} maxLength={64} /></Field>
          <Field label="Item type"><Select value={f.itemType} onChange={set("itemType")}>{TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</Select></Field>
          <Field label="Category"><Select value={f.categoryId} onChange={set("categoryId")}><option value="">—</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <Field label="Brand"><input className="inv-input" value={f.brand} onChange={set("brand")} /></Field>
          <Field label="Preferred supplier"><Select value={f.preferredSupplierId} onChange={set("preferredSupplierId")}><option value="">—</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          <Field label="Description" full><textarea className="inv-textarea" value={f.description} onChange={set("description")} /></Field>

          <div className="inv-section inv-full">Units</div>
          <Field label="Base (stock) unit" required error={errors.baseUnit} hint={editing ? "Locked once the item has stock history" : "Stock is counted in this unit"}>
            <Select value={f.baseUnit} onChange={set("baseUnit")}>{unitCodes.map((u) => <option key={u} value={u}>{u}</option>)}</Select>
          </Field>
          <Field label="Purchase unit" hint="Unit you buy in"><Select value={f.purchaseUnit} onChange={set("purchaseUnit")}><option value="">Same as base</option>{[...unitCodes, ...packagingUnits.filter((u) => !unitCodes.includes(u))].map((u) => <option key={u} value={u}>{u}</option>)}</Select></Field>
          <div className="inv-full">
            <div className="inv-hint" style={{ marginBottom: 6 }}>Packaging conversions — only for units whose size depends on the product (carton, bag, case…). 1 unit = N base units.</div>
            {f.conversions.map((c, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div className="inv-row">
                  <Field label={i === 0 ? "Unit" : ""}><input className="inv-input" aria-label="Packaging unit" placeholder="e.g. carton" value={c.unit} onChange={(e) => setConv(i, "unit", e.target.value)} /></Field>
                  <Field label={i === 0 ? `Base units (${f.baseUnit}) per 1` : ""}><input className="inv-input" aria-label="Base units per packaging unit" inputMode="decimal" value={c.factor} onChange={(e) => setConv(i, "factor", e.target.value)} /></Field>
                  <Btn type="button" kind="plain" sm aria-label="Remove conversion" onClick={() => delConv(i)}>Remove</Btn>
                </div>
                {errors[`conv${i}`] && <div className="inv-err">{errors[`conv${i}`]}</div>}
              </div>
            ))}
            <Btn type="button" kind="plain" sm onClick={addConv}>+ Add packaging conversion</Btn>
          </div>

          <div className="inv-section inv-full">Stock levels (in {f.baseUnit})</div>
          {numField("minStock", "Minimum stock")}
          {numField("reorderPoint", "Reorder point")}
          {numField("safetyStock", "Safety stock")}
          {numField("maxStock", "Maximum stock")}
          {numField("reorderQty", "Preferred reorder quantity")}

          <div className="inv-section inv-full">Tracking &amp; tax</div>
          <div className="inv-full" style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <label className="checkbox-item inv-check"><input type="checkbox" checked={f.trackBatches} onChange={flag("trackBatches")} /> Track batches</label>
            <label className="checkbox-item inv-check"><input type="checkbox" checked={f.trackExpiry} onChange={flag("trackExpiry")} /> Track expiry</label>
            <label className="checkbox-item inv-check"><input type="checkbox" checked={f.requiresInspection} onChange={flag("requiresInspection")} /> Needs quality inspection</label>
            <label className="checkbox-item inv-check"><input type="checkbox" checked={f.allowNegativeStock} onChange={flag("allowNegativeStock")} /> Allow negative stock</label>
          </div>
          <Field label="GST rate (%)" error={errors.gstRate}><input className={`inv-input${errors.gstRate ? " inv-invalid" : ""}`} inputMode="decimal" value={f.gstRate} onChange={set("gstRate")} /></Field>
          <Field label="HSN code"><input className="inv-input" value={f.hsn} onChange={set("hsn")} maxLength={12} /></Field>
        </div>
      </form>
    </Modal>
  );
}

export default function InventoryItems() {
  const { hasModulePermission } = useAuth();
  const { toast } = useToast();
  const canWrite = hasModulePermission("inventoryItems", "write");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [itemType, setItemType] = useState("");
  const q = useDebounced(search);
  const list = usePagedList("/inventory/items", { search: q, status, itemType });
  const [editing, setEditing] = useState(null);
  const units = useRef_("/inventory/units", {}, (d) => d);
  const suppliers = useRef_("/inventory/suppliers", { status: "active", limit: 200 }, (d) => d.data);
  const categories = useRef_("/inventory/categories", {}, (d) => d);
  const unitSet = units.system ? units : { system: [], custom: [] };

  const toggle = async (it) => {
    try { await api.patch(`/inventory/items/${it.id}`, { status: it.status === "active" ? "inactive" : "active" }); list.reload(); }
    catch (e) { toast.error(errText(e)); }
  };

  const columns = [
    { key: "sku", label: "SKU", render: (i) => <span className="inv-strong">{i.sku}</span> },
    { key: "name", label: "Item", render: (i) => <div><div className="inv-strong">{i.name}</div><div className="inv-muted">{[i.brand, label(i.itemType)].filter(Boolean).join(" · ")}</div></div> },
    { key: "unit", label: "Base unit", render: (i) => i.baseUnit },
    { key: "rp", label: "Reorder pt", num: true, render: (i) => (i.reorderPoint ? `${qty(i.reorderPoint)} ${i.baseUnit}` : "—") },
    { key: "track", label: "Tracking", render: (i) => [i.trackBatches && "batch", i.trackExpiry && "expiry", i.requiresInspection && "QC"].filter(Boolean).join(", ") || "—" },
    { key: "gst", label: "GST", num: true, render: (i) => `${i.gstRate || 0}%` },
    { key: "status", label: "Status", render: (i) => <Badge tone={i.status === "active" ? "green" : "grey"}>{i.status}</Badge> },
    ...(canWrite ? [{ key: "act", label: "", render: (i) => (
      <span style={{ display: "flex", gap: 6 }}>
        <Btn type="button" kind="plain" sm onClick={() => setEditing(i)}>Edit</Btn>
        <Btn type="button" kind="plain" sm onClick={() => toggle(i)}>{i.status === "active" ? "Deactivate" : "Activate"}</Btn>
      </span>) }] : []),
  ];

  return (
    <div className="inner-page inv-page">
      <PageHead title="Inventory items" count={`${list.total} item(s)`}>
        {canWrite && <Btn type="button" kind="primary" onClick={() => setEditing({})}>+ New item</Btn>}
      </PageHead>
      <div className="inv-stack">
        <Toolbar>
          <SearchBox placeholder=" Search name, SKU, barcode, brand" aria-label="Search items" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select aria-label="Filter by type" value={itemType} onChange={(e) => setItemType(e.target.value)}><option value="">All types</option>{TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</Select>
          <Select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></Select>
        </Toolbar>
        <DataTable columns={columns} rows={list.rows} loading={list.loading} error={list.error} onRetry={list.reload} empty="No items yet. Add ingredients, packaging and supplies to start tracking stock." more={list} />
      </div>
      {editing && <ItemForm item={editing.id ? editing : null} units={unitSet} suppliers={suppliers} categories={categories} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); list.reload(); }} />}
    </div>
  );
}
