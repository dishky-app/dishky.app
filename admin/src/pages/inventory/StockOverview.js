/**
 * StockOverview.js — item totals with reorder status, and the row-level
 * (item / location / batch) view with expiry & quarantine filters. Opening
 * stock, adjustments, waste and quarantine are posted from here; every one of
 * them becomes an immutable stock-ledger entry on the server.
 */
import React, { useMemo, useState } from "react";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../useToast";
import { Badge, Btn, DataTable, DateInput, Field, Modal, PageHead, SearchBox, Select, Tabs, Toolbar, dateShort, errText, money, qty, useDebounced, usePagedList, useRef_ } from "./InvUi";

const ROW_VIEWS = [
  ["all", "All stock"], ["available", "Available"], ["reserved", "Reserved"], ["quarantined", "Quarantined"],
  ["damaged", "Damaged"], ["expired", "Expired"], ["near_expiry", "Near expiry"],
];
const ITEM_VIEWS = [["", "All items"], ["low", "Low stock"], ["out_of_stock", "Out of stock"]];
const REORDER_TONE = { ok: "green", low: "amber", out_of_stock: "red" };
const WASTE = ["spoilage", "expired", "damaged", "spillage", "preparation_loss", "theft", "other"];

const ACTIONS = {
  opening: { title: "Opening stock", path: "/inventory/stock/opening", needsCost: true },
  adjust_in: { title: "Add stock", path: "/inventory/stock/adjust", direction: "in", needsCost: true, needsReason: true },
  adjust_out: { title: "Remove stock", path: "/inventory/stock/adjust", direction: "out", needsReason: true },
  waste: { title: "Record waste", path: "/inventory/stock/waste", waste: true },
  quarantine: { title: "Quarantine stock", path: "/inventory/stock/status", status: "quarantine", needsReason: true },
  release: { title: "Release from quarantine", path: "/inventory/stock/status", status: "release", needsReason: true },
};

function PostForm({ action, preset, items, locations, onClose, onDone }) {
  const cfg = ACTIONS[action];
  const { toast } = useToast();
  const [f, setF] = useState({
    itemId: preset?.itemId || "", locationId: preset?.locationId || "", batchNo: preset?.batchNo || "",
    qty: "", unit: "", unitCost: "", reason: "", wasteReason: "spoilage", expiryDate: "", mfgDate: "",
  });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  // One idempotency key per open form: a double-click or retry can never post twice.
  const idemKey = useMemo(() => (window.crypto?.randomUUID ? window.crypto.randomUUID() : String(Date.now() + Math.random())), []);
  const item = items.find((i) => i.id === f.itemId);
  const unitChoices = item ? [item.baseUnit, ...(item.conversions || []).map((c) => c.unit)] : [];
  const set = (k) => (e) => { setF((p) => ({ ...p, [k]: e.target.value })); setErrors((p) => ({ ...p, [k]: "" })); };

  const validate = () => {
    const e = {};
    if (!f.itemId) e.itemId = "Choose an item";
    if (!f.locationId) e.locationId = "Choose a location";
    if (!(Number(f.qty) > 0)) e.qty = "Enter a quantity above 0";
    if (item?.trackBatches && !f.batchNo.trim()) e.batchNo = "This item is batch-tracked";
    if (item?.trackExpiry && cfg.needsCost && !f.expiryDate) e.expiryDate = "This item tracks expiry";
    if (cfg.needsReason && !f.reason.trim()) e.reason = "A reason is required";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      const body = { itemId: f.itemId, locationId: f.locationId, batchNo: f.batchNo, qty: f.qty, unit: f.unit || item.baseUnit, reason: f.reason };
      if (cfg.needsCost && f.unitCost !== "") body.unitCost = f.unitCost;
      if (f.expiryDate) body.expiryDate = f.expiryDate;
      if (f.mfgDate) body.mfgDate = f.mfgDate;
      if (cfg.direction) body.direction = cfg.direction;
      if (cfg.waste) body.wasteReason = f.wasteReason;
      if (cfg.status) body.action = cfg.status;
      const { data } = await api.post(cfg.path, body, { headers: { "Idempotency-Key": `${action}-${idemKey}` } });
      toast.success(data.replayed ? "Already recorded — nothing changed" : `Posted ${data.entry.txnNo}`);
      onDone();
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };

  return (
    <Modal title={cfg.title} onClose={onClose}
      footer={<><Btn type="button" kind="plain" onClick={onClose}>Cancel</Btn><Btn type="submit" form="inv-post-form" kind="primary" disabled={busy}>{busy ? "Posting…" : "Post"}</Btn></>}>
      <form id="inv-post-form" onSubmit={submit} noValidate>
        <div className="inv-grid">
          <Field label="Item" required error={errors.itemId} full>
            <Select value={f.itemId} onChange={(e) => { setF((p) => ({ ...p, itemId: e.target.value, unit: "" })); setErrors((p) => ({ ...p, itemId: "" })); }}>
              <option value="">Select item…</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>)}
            </Select>
          </Field>
          <Field label="Storage location" required error={errors.locationId}>
            <Select value={f.locationId} onChange={set("locationId")}><option value="">Select…</option>{locations.filter((l) => l.status === "active").map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select>
          </Field>
          <Field label="Batch number" required={!!item?.trackBatches} error={errors.batchNo}><input className="inv-input" value={f.batchNo} onChange={set("batchNo")} maxLength={60} /></Field>
          <Field label="Quantity" required error={errors.qty}><input className={`inv-input${errors.qty ? " inv-invalid" : ""}`} inputMode="decimal" value={f.qty} onChange={set("qty")} /></Field>
          <Field label="Unit" hint="Converted to the item's base unit on the server">
            <Select value={f.unit || item?.baseUnit || ""} onChange={set("unit")} disabled={!item}>{unitChoices.map((u) => <option key={u} value={u}>{u}</option>)}</Select>
          </Field>
          {cfg.needsCost && <Field label={`Unit cost (₹ per ${f.unit || item?.baseUnit || "unit"})`}><input className="inv-input" inputMode="decimal" value={f.unitCost} onChange={set("unitCost")} /></Field>}
          {cfg.needsCost && <Field label="Expiry date" required={!!item?.trackExpiry} error={errors.expiryDate}><DateInput value={f.expiryDate} onChange={set("expiryDate")} /></Field>}
          {cfg.needsCost && <Field label="Manufactured on"><DateInput value={f.mfgDate} onChange={set("mfgDate")} /></Field>}
          {cfg.waste && <Field label="Waste reason" required><Select value={f.wasteReason} onChange={set("wasteReason")}>{WASTE.map((w) => <option key={w} value={w}>{w.replace("_", " ")}</option>)}</Select></Field>}
          <Field label={cfg.needsReason ? "Reason" : "Notes"} required={cfg.needsReason} error={errors.reason} full><textarea className="inv-textarea" value={f.reason} onChange={set("reason")} maxLength={500} /></Field>
        </div>
      </form>
    </Modal>
  );
}

export default function StockOverview() {
  const { hasModulePermission } = useAuth();
  const canWrite = hasModulePermission("inventoryStock", "write");
  const [tab, setTab] = useState("items");
  const [view, setView] = useState("");
  const [rowView, setRowView] = useState("all");
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const itemsList = usePagedList("/inventory/stock/items", { search: q, view });
  const rowsList = usePagedList("/inventory/stock", { search: q, view: rowView });
  const [post, setPost] = useState(null); // { action, preset }
  const items = useRef_("/inventory/items", { status: "active", limit: 200 }, (d) => d.data);
  const locations = useRef_("/inventory/locations", {});
  const active = tab === "items" ? itemsList : rowsList;
  const totals = itemsList.extra?.totals;
  const noLoc = locations.length === 0;
  const reloadAll = () => { itemsList.reload(); rowsList.reload(); };
  const { toast } = useToast();
  const canImport = canWrite && hasModulePermission("inventoryItems", "write");
  const importIngredients = () => toast.confirm(
    "Bring this branch's Ingredients under the stock ledger? Each ingredient becomes an inventory item and its current Stock Remaining (kg) is recorded as opening stock. Already-imported ingredients are skipped.",
    async () => {
      try {
        const { data } = await api.post("/inventory/import-ingredients");
        const bad = data.skipped?.length ? ` ${data.skipped.length} skipped.` : "";
        toast.success(`Imported: ${data.created} new items, ${data.linked} linked to existing items, ${data.opened} opening balances.${bad}`, "medium");
        reloadAll();
      } catch (e) { toast.error(errText(e)); }
    }
  );

  const itemCols = [
    { key: "sku", label: "SKU", render: (r) => <span className="inv-strong">{r.sku}</span> },
    { key: "name", label: "Item" },
    { key: "onHand", label: "On hand", num: true, render: (r) => `${qty(r.onHand)} ${r.unit}` },
    { key: "available", label: "Available", num: true, render: (r) => qty(r.available) },
    { key: "quarantined", label: "Quarantined", num: true, render: (r) => (r.quarantined ? qty(r.quarantined) : "—") },
    { key: "expired", label: "Expired", num: true, render: (r) => (r.expired ? qty(r.expired) : "—") },
    { key: "rp", label: "Reorder pt", num: true, render: (r) => (r.reorderPoint ? qty(r.reorderPoint) : "—") },
    { key: "value", label: "Value", num: true, render: (r) => money(r.stockValue) },
    { key: "status", label: "Status", render: (r) => <Badge tone={REORDER_TONE[r.reorderStatus]}>{r.reorderStatus.replace(/_/g, " ")}</Badge> },
  ];
  const rowCols = [
    { key: "itemName", label: "Item", render: (r) => <div><div className="inv-strong">{r.itemName}</div><div className="inv-muted">{r.sku}</div></div> },
    { key: "locationName", label: "Location" },
    { key: "batchNo", label: "Batch", render: (r) => r.batchNo || "—" },
    { key: "onHand", label: "On hand", num: true, render: (r) => `${qty(r.onHand)} ${r.unit}` },
    { key: "reserved", label: "Reserved", num: true, render: (r) => (r.reserved ? qty(r.reserved) : "—") },
    { key: "quarantined", label: "Quarantined", num: true, render: (r) => (r.quarantined ? qty(r.quarantined) : "—") },
    { key: "damaged", label: "Damaged", num: true, render: (r) => (r.damaged ? qty(r.damaged) : "—") },
    { key: "available", label: "Available", num: true, render: (r) => qty(r.available) },
    { key: "cost", label: "Unit cost", num: true, render: (r) => money(r.unitCost) },
    { key: "value", label: "Value", num: true, render: (r) => money(r.stockValue) },
    { key: "expiry", label: "Expiry", render: (r) => (r.expiryDate ? <Badge tone={r.isExpired ? "red" : "grey"}>{dateShort(r.expiryDate)}</Badge> : "—") },
    ...(canWrite ? [{ key: "act", label: "", render: (r) => (
      <span style={{ display: "flex", gap: 6 }}>
        <Btn type="button" kind="plain" sm onClick={() => setPost({ action: "waste", preset: r })}>Waste</Btn>
        <Btn type="button" kind="plain" sm onClick={() => setPost({ action: r.quarantined ? "release" : "quarantine", preset: r })}>{r.quarantined ? "Release" : "Quarantine"}</Btn>
      </span>) }] : []),
  ];

  return (
    <div className="inner-page inv-page">
      <PageHead title="Stock overview">
        {canWrite && <>
          {canImport && <Btn type="button" kind="plain" onClick={importIngredients}>Import from Ingredients</Btn>}
          <Btn type="button" kind="plain" disabled={noLoc} onClick={() => setPost({ action: "opening" })}>Opening stock</Btn>
          <Btn type="button" kind="plain" disabled={noLoc} onClick={() => setPost({ action: "adjust_in" })}>Add stock</Btn>
          <Btn type="button" kind="plain" disabled={noLoc} onClick={() => setPost({ action: "adjust_out" })}>Remove stock</Btn>
          <Btn type="button" kind="plain" disabled={noLoc} onClick={() => setPost({ action: "waste" })}>Record waste</Btn>
        </>}
      </PageHead>
      {canWrite && noLoc && <div className="inv-banner">Create a storage location first (Storage Locations) before posting stock.</div>}

      {totals && (
        <div className="inv-kpis">
          <div className="inv-card inv-kpi"><span>Stock value</span><b>{money(totals.stockValue)}</b></div>
          <div className="inv-card inv-kpi"><span>Low stock</span><b>{totals.lowCount}</b></div>
          <div className="inv-card inv-kpi"><span>Out of stock</span><b>{totals.outOfStockCount}</b></div>
        </div>
      )}

      <div className="inv-stack">
        <Toolbar>
          <Tabs inline tabs={[["items", "By item"], ["rows", "By location & batch"]]} value={tab} onChange={setTab} />
          <SearchBox placeholder=" Search item, SKU, barcode" aria-label="Search stock" value={search} onChange={(e) => setSearch(e.target.value)} />
          {tab === "items"
            ? <Select aria-label="Item view" value={view} onChange={(e) => setView(e.target.value)}>{ITEM_VIEWS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
            : <Select aria-label="Stock view" value={rowView} onChange={(e) => setRowView(e.target.value)}>{ROW_VIEWS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>}
        </Toolbar>
        <DataTable columns={tab === "items" ? itemCols : rowCols} rows={active.rows} loading={active.loading} error={active.error} onRetry={active.reload}
          rowKey={(r) => `${r.itemId}|${r.locationId || ""}|${r.batchNo || ""}`}
          empty={tab === "items" ? "No items to show. Add inventory items first." : "No stock in this view."} more={active} />
      </div>

      {post && <PostForm action={post.action} preset={post.preset} items={items} locations={locations} onClose={() => setPost(null)} onDone={() => { setPost(null); reloadAll(); }} />}
    </div>
  );
}
