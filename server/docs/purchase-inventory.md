# Purchase & Inventory module

Status: **Phase 1 (inventory foundation) implemented.** Phases 2–5 are implemented (see sections 10–13).

## 1. Existing architecture this builds on

| Area | What exists | How the module uses it |
|---|---|---|
| Apps | `admin/` (Vite + React 19, the Admin Panel), `user/`, `developer/`, `super-admin/`, `website/`, `server/` | UI lives in `admin/src/pages/inventory/` |
| API | Single Express 5 + Mongoose 9 app, `server/server.js`, modules in `server/src/modules/*` | New module `server/src/modules/inventory/`, mounted at `/inventory` |
| Tenancy | Global Mongoose plugin (`core/tenancy.js`) stamps/filters `restaurantId` on every model, per-tenant unique indexes, fails closed | All inventory models inherit it; nothing is hand-filtered |
| Branches | "Venue" = branch, `venueId` on branch data; non-Super-Admins are pinned to their venue (`scopeFilter`, `scopeVenueForCreate`) | Same helpers are injected into the router |
| RBAC | Permission matrix by `roleTitle` × module (`auth/permissions.js`), plan gating (`platform/plans.js`) | Four new modules, default rows, plan entitlements |
| Audit | `logAudit(req, …)` | Every create/update/posting is audited |
| Realtime | `emitChange(resource, action, payload)` to the restaurant's staff room | Emitted **after** the write is persisted |
| Existing stock | Generic `ingredients` collection with `stockRemaining` (kg) decremented directly by `POST /orders` | **Not yet integrated — see §6** |

## 2. Data model (collections)

`invSuppliers`, `invCategories`, `invUnits`, `invLocations`, `invItems`, `invBalances`, `invLedger`, `invCounters`.

### Number representation
Everything persisted is an **integer** (`server/src/modules/inventory/precision.js`):

* quantity — milli base-units (`…Milli`), e.g. 1.25 kg of a gram-based item → `1250`
* unit cost — micro-rupees per base unit (`…Micro`)
* money — paise (`…Paise`)

Products are computed in BigInt and rounded half-away-from-zero once, at the end. The API accepts/returns decimals.

### Consistency model
`invLedger` is the append-only history; `invBalances` is current state per (branch, item, location, batch), changed only by `stockService` in the same transaction that inserts the ledger entry. Item totals are always aggregated from balances (never stored). Costing: weighted average per balance row. `availableMilli = onHand − reserved − quarantined − damaged`; expired batches are excluded from "available" at read time and cannot be consumed.

### Units
System units: mg/g/kg, ml/l, pcs/dozen. **Packaging units (carton, bag, case…) are never built in**; each item declares `conversions: [{unit, factor}]`. Conversions across dimensions without a declared factor are rejected (`UNIT_MISMATCH`). The base unit is locked once an item has ledger history.

## 3. Stock-posting guarantees (`stockService.js`)

* **Atomic** — balance + ledger in one MongoDB transaction. Without a replica set, posting returns `503 TRANSACTIONS_REQUIRED`. `INVENTORY_ALLOW_NO_TRANSACTIONS=true` is a development/test-only override and is logged.
* **Idempotent** — every posting has a unique `idempotencyKey` (client `Idempotency-Key` header/`idempotencyKey`, else random). Replays return the original entry with `replayed: true`. Opening stock defaults to a deterministic key so re-submitting cannot double it.
* **Concurrent-safe** — balances use a `rev` compare-and-set with retries (+ an in-process per-row lock).
* **No negative stock** unless the item sets `allowNegativeStock`.
* **Append-only ledger** — update/delete hooks throw; corrections are `reversal` entries (deterministic key `reversal:<id>` ⇒ reversible once). Status moves and reversals are not themselves reversible.

## 4. API (all under `/inventory`, session-authenticated)

Lists return `{ data, page, limit, total }` (`limit` ≤ 200). Super Admins pass `?venueId=`.

| Method & path | Permission | Notes |
|---|---|---|
| `GET /config` | inventoryStock:read | transactions flag, enums |
| `GET/POST /units`, `GET/POST/PATCH /categories` | inventoryItems | custom units |
| `GET/POST /locations`, `PATCH /locations/:id` | inventoryItems | per branch |
| `GET/POST /suppliers`, `GET/PATCH /suppliers/:id`, `POST /suppliers/:id/status` | suppliers | GSTIN/PAN validated; block needs a reason; full account number stored **encrypted** (AES-256-GCM via `SETTINGS_ENCRYPTION_KEY`); never in list/detail responses |
| `GET /suppliers/:id/bank` | suppliers:write | decrypts and returns the account number; audited |
| `GET/POST /items`, `GET/PATCH /items/:id`, `GET /items/lookup?barcode=` | inventoryItems | lookup identifies only; never posts stock |
| `GET /stock` | inventoryStock:read | views: all, available, reserved, quarantined, damaged, expired, near_expiry (`days`) |
| `GET /stock/items` | inventoryStock:read | per-item totals + reorder status, KPI totals |
| `POST /stock/opening` `/adjust` `/waste` `/status` | inventoryStock:write | adjust/status require a reason; waste requires `wasteReason` |
| `GET /ledger` | stockLedger:read | filters: itemId, locationId, batchNo, type, refType/refId, from/to |
| `POST /ledger/:id/reverse` | stockLedger:write | reason required |

Errors: `{ error, code, details? }` — e.g. `INSUFFICIENT_STOCK` 409, `IDEMPOTENCY_CONFLICT` 409, `UNIT_MISMATCH` 400, `TRANSACTIONS_REQUIRED` 503.

## 5. Permissions and plans

New permission modules: `suppliers`, `inventoryItems`, `inventoryStock`, `stockLedger`. Included in Professional/Premium/Custom plans (Essential → 402). Defaults for Chef & Sous Chef: items/stock read+write, ledger read, suppliers read; ledger **reversal** and supplier writes are Super Admin until granted on the Permissions page. Missing rows fail closed. UI hides what the role cannot read; the API enforces it independently.

## 6. Known gaps, risks and decisions needed

1. **Resolved (Option A): the ledger is the source of truth** for ingredients linked via `ingredientBridge.js`. Orders consume through FEFO ledger postings, Stocks-page edits become adjustments, and the ledger balance is projected back to `ingredients.stockRemaining` (kg). Ingredients not yet imported (`POST /inventory/import-ingredients`) keep the legacy behaviour. Tests: `ingredient-bridge.test.js`.
2. **Transactions not verified here.** The sandbox database (FerretDB) has no transactions and non-atomic compare-and-set, so the transactional path and cross-process concurrency were **not** tested. Run the suite against a MongoDB replica set before production.
3. Thresholds (min/reorder/max) are per item, not per branch.
4. Adjustment approval thresholds / maker-checker, stock transfers, batch FEFO consumption and the dashboard are later phases.
5. Supplier account numbers are stored encrypted and revealed only via the audited `/suppliers/:id/bank` endpoint. Losing or changing `SETTINGS_ENCRYPTION_KEY` makes saved numbers unreadable.
6. Frontend was compiled, not exercised in a browser; no frontend tests exist in the repo's tooling.
7. Pre-existing: 2 `attender` tests fail on the untouched code base (404 responses).

## 7. Configuration

| Variable | Purpose |
|---|---|
| `MONGO_URI` | Must point at a replica set / Atlas for stock posting |
| `SETTINGS_ENCRYPTION_KEY` | Required to save supplier bank account numbers (already used for payment gateway secrets) |
| `INVENTORY_ALLOW_NO_TRANSACTIONS` | `true` only for local dev/tests on a standalone database |

## 8. Roadmap
Phases 2–5 are done (sections 10–13). Remaining work is listed under "Not done" in each section. Each phase shipped with tests before the next started.

## 9. Tests
`server/test/inventory.test.js` (19 tests): precision, units, supplier/item rules, opening/adjust/waste/quarantine, expiry views, concurrency, idempotency, reversal, append-only ledger, tenant isolation, plan gate, transaction refusal. Run: `npm run test:db && npm test`.

## 10. Phase 2 — procurement (`purchaseRoutes.js`, mounted at `/purchase`)

**Flow:** purchase request (draft → pending approval → approved) → either an RFQ (suppliers invited → quotations recorded → compared → awarded) or a direct order → purchase order (draft → approval → sent → received/closed). Reorder planning creates draft requests from low stock.

| Area | Endpoints |
|---|---|
| Settings | `GET/PATCH /settings` |
| Requests | `GET/POST /requests`, `GET/PATCH /requests/:id`, `POST /requests/:id/{submit,approve,reject,request-changes,cancel,convert-to-rfq,convert-to-po}` |
| Reorder | `GET /reorder/suggestions`, `POST /reorder/create-requests` |
| RFQs | `GET/POST /rfqs`, `GET/PATCH /rfqs/:id`, `POST /rfqs/:id/{send,evaluate,award,close,cancel}`, `GET /rfqs/:id/comparison`, `POST /rfqs/:id/quotations`, `POST /quotations/:id/{shortlist,reject,request-revision}` |
| Orders | `GET/POST /orders`, `GET/PATCH /orders/:id`, `POST /orders/:id/{submit,approve,reject,send,revise,cancel,close}` |

New permission modules (Professional+ plans): `purchaseRequests`, `purchaseApprovals` (write = approve/reject), `purchaseRfq`, `purchaseOrders`, `purchaseSettings`. Chef/Sous Chef default: requests read+write, orders and RFQs read; approvals and settings are Super Admin until granted.

**Rules enforced by the server**
- Totals, discount, GST, round-off (to the nearest rupee, recorded), CGST/SGST vs IGST and document numbers are always recalculated; client totals are ignored.
- Status changes are conditional updates, so two people cannot both approve/award; invalid moves return 409 `INVALID_STATE`.
- Maker-checker: you cannot approve a request/order you created unless *Allow self-approval* is on (default off). Reject / request-changes / cancel / revise / close / award require a reason.
- Approval limits: a document at or below the limit is auto-approved; limit 0 means everything needs approval.
- RFQ award is always a person's choice with a recorded reason; the comparison highlights the lowest full-coverage quotation for information only. Expired, rejected or revision-requested quotations cannot be awarded; blocked/inactive suppliers cannot be invited, quoted or ordered.
- Manual purchase orders (no request/quotation) are refused unless *Allow manual orders* is on.
- A PO revision snapshots the old version, bumps the version and returns to draft; it is refused once goods have been received. A PO with receipts cannot be cancelled, only closed (short-closed).
- Reorder: position = available + open PO outstanding + open requests (drafts included); level = max(reorder point, safety + average daily use × lead time); quantity rounds up to a whole pack. Average daily use comes from ledger consumption over `reorderLookbackDays`.

**Not done / assumptions (Phase 2)**
- Dishky **does not transmit** RFQs or POs. "Mark as sent" records that the buyer sent them (print / WhatsApp / email) and how. PDF is the browser print view; no server PDF generation.
- Attachments (quotation PDFs etc.) are not implemented; fields exist but there is no upload.
- Supplier reliability/quality scores in the comparison are `null` until goods receipts exist (Phase 3).
- `receivedMilli` on PO lines is only written by Phase 3 receiving; tests set it directly to exercise the rules.
- Reservation/event-based demand forecasting is not in reorder planning (consumption history only).
- Approval is single-level (limit-based), not multi-step by role/amount slab.
- Concurrency of the conditional transitions is verified only against the sandbox database; re-run on a real replica set.
- Admin screens compile but were not exercised in a browser.

Tests: `server/test/purchase.test.js` (13 tests): calculations, reorder maths, approvals, maker-checker, auto-approval, reorder planning, RFQ → quotation → award → PO, revisions/closing, manual-PO policy, tenant isolation, permission and plan gating.

## 11. Phase 3 — receiving, quality, quarantine, returns (`receivingRoutes.js`, mounted at `/receiving`)

| Area | Endpoints |
|---|---|
| Goods receipts | `GET/POST /grns`, `GET/PATCH /grns/:id`, `POST /grns/:id/{post,cancel}` |
| Quarantine | `GET /quarantine` (release / write-off use the existing `/inventory/stock/status`) |
| Supplier returns | `GET/POST /returns`, `GET/PATCH /returns/:id`, `POST /returns/:id/{submit,approve,reject,cancel,dispatch,credit}` |
| Performance | `GET /suppliers/:id/performance` (also feeds the RFQ comparison) |

New permission modules: `purchaseReceiving` (Chef/Sous Chef read+write by default), `purchaseReturns` (read by default; approving uses `purchaseApprovals`). New setting: over-delivery tolerance (%).

**Rules**
- Goods can only be received against a **sent** (or partly received) order. Each line is split into accepted + quarantined + rejected, which must equal the delivered quantity; a reason is required for anything held or rejected.
- Only accepted and quarantined goods enter stock (`receipt` ledger entries; quarantined quantity is then moved to the quarantine bucket). Rejected goods never enter stock and can be returned via a `rejected_at_gate` return (limited to the rejected quantity, once).
- Batch number and expiry are enforced for items that track them; expired goods cannot be accepted. Over-delivery beyond outstanding + tolerance is refused.
- Stock cost = order price after discount, before GST (GST assumed recoverable input tax). **Freight and other charges are not allocated to stock cost (no landed cost yet).**
- Posting is **idempotent and resumable**: ledger keys `grn:<id>:<line>:in|q`; a receipt interrupted mid-way stays `posting` and "Post" resumes without duplicating.
- PO line `receivedMilli` and PO status are **recomputed** from posted receipts and dispatched returns (reopening returns subtract), never incremented, so retries cannot double count.
- Returns: draft → approval (maker-checker, same self-approval policy) → dispatch (ledger `supplier_return`, from available or quarantined stock) → credit note recorded (variance vs value shown). Dispatch flips status first, so it cannot be cancelled meanwhile; if stock posting fails the status reverts.
- Supplier performance: on-time %, fill rate, rejection %, quarantine %, quality compliance, returns, from posted receipts only; `null` when there is no history (never invented).

**Not done / assumptions (Phase 3)**
- No reversal of a posted receipt. Correct a mistake with a supplier return (reopening the order) or a stock adjustment. A receipt crash between the stock entry and the final status leaves it in `posting` (visible, resumable).
- The recompute of PO quantities uses an in-process lock plus a verify-and-retry loop; true cross-process races are unverified (no real MongoDB here).
- No photo/document attachments for inspection; checks are packaging/label/quality flags and temperature, informational only (not enforced against limits).
- Gate-reject returns and "reopen order" returns are available in the API; the screen offers returns from stock/quarantine.
- No barcode/scanner receiving UI; no minimum remaining shelf-life rule.
- Admin screens compile but were not exercised in a browser.

Tests: `server/test/receiving.test.js` (10 tests).

## 12. Phase 4 — supplier invoices, three-way match, payments, reports (`financeRoutes.js`, mounted at `/finance`)

| Area | Endpoints |
|---|---|
| Invoices | `GET /orders/:poId/billable`, `GET/POST /invoices`, `GET/PATCH /invoices/:id`, `POST /invoices/:id/{submit,approve,reject,dispute,cancel,apply-credit}` |
| Payments | `GET/POST /payments`, `GET /payments/:id`, `POST /payments/:id/{approve,reject,cancel,reverse,allocate}` |
| Reports | `GET /reports/{purchase-summary,payables-aging,price-trend,consumption-cost,invoice-variance}` (add `format=csv`) |

New permission modules (Professional+ plans, **Super Admin only until granted**): `purchaseInvoices`, `purchasePayments`, `purchaseReports`. Approving invoices/payments and reversing payments use `purchaseApprovals`. New settings: invoice quantity/price tolerance (%), invoice total tolerance (₹), payment auto-approval limit.

**Rules**
- The server calculates every invoice line, GST, round-off and total (same integer maths as orders). The total printed on the paper invoice is optional and only cross-checked.
- **Duplicate guard:** one supplier invoice number per supplier (case, spaces and punctuation ignored) → 409. A same supplier + date + total invoice with a different number only produces a warning.
- **Three-way match** per line against the order and its *received* quantity: not on order, nothing received, billed more than received-and-not-yet-billed (quantities already on other submitted/approved/disputed invoices are deducted; drafts do not count), price above the order's net price (tolerance %), GST rate differs. Header: stated-total mismatch. An invoice with no order is "unmatched". Match is recomputed on submit and again on approve.
- A non-matching invoice cannot be approved without a written **override reason** (stored on the invoice and visible in the variance report). Maker-checker applies (the recorder cannot approve unless self-approval is on).
- **Payments** can only be allocated to approved invoices, never beyond what is still payable (pending payments count), never twice for the same reference per supplier and method, and are replay-safe via `Idempotency-Key`. Above the auto-approval limit (0 = always) they wait for a second person. Reversal needs a reason. An unallocated remainder is an **advance** that can be allocated later.
- Invoice paid/pending amounts and applied credits are **derived** from payments and returns, never incremented. A supplier credit note (from a credited return) can be set against one invoice, once.
- Cash payments over ₹10,000 produce a warning about the income-tax deductibility rule (section 40A(3)); this is guidance, not legal advice.
- Reports: purchases by supplier/item/month on a goods-received or approved-invoice basis (returns netted), payables aging by due date, item price trend per supplier/month, cost of usage and waste, invoice variances.

**Not done / assumptions (Phase 4)**
- Dishky records payments; it does **not** pay suppliers, generate bank files, or reconcile bank statements.
- No accounting-ledger/general-ledger posting, no TDS/withholding, no GST input-credit (GSTR-2B) reconciliation, no e-invoice/IRN handling.
- Landed cost (freight and charges spread over stock cost) is not implemented; stock stays at order net price.
- One order per invoice; an invoice spanning several orders, or part-invoicing by receipt (GRN-level), is not supported.
- Invoice attachments (scans) are not implemented.
- Reports are computed in the application from up to 20,000–50,000 records per request; very large histories need database aggregation and date partitioning. Overdue-only list counts are approximate.
- Aggregations were checked on the sandbox database only; re-run on MongoDB.
- Admin screens compile but were not exercised in a browser.

Tests: `server/test/finance.test.js` (12 tests).

## 13. Phase 5 — automation (`automationRoutes.js`, mounted at `/automation`)

| Area | Endpoints |
|---|---|
| Settings | `GET/PUT /settings` (expiry window, due-soon window, forecast defaults, WhatsApp template name and hourly limit) |
| Alerts | `GET /alerts` (computed live), `POST /alerts/consumption-issues/:id/resolve` |
| Forecast / usage | `GET /forecast`, `GET /consumption?from&to` |
| Scorecards | `GET /suppliers/performance` |
| Stock audits | `GET/POST /audits`, `GET /audits/:id`, `PUT /audits/:id/counts`, `POST /audits/:id/{submit,approve,reject,cancel,post}` |
| WhatsApp | `POST /whatsapp/purchase-list/{preview,send}`, `GET /whatsapp/log` |

New permission modules (Professional+ plans): `inventoryAlerts`, `stockAudits`, `purchaseWhatsapp`, `supplierScorecards`. Chef / Sous Chef defaults: alerts read, audits read+write, scorecards read. Approving and posting an audit needs `purchaseApprovals` (write); settings need `purchaseSettings`; sending WhatsApp needs `purchaseWhatsapp` (Super Admin until granted). New collections: `invAutomationSettings`, `invStockAudits`, `invWhatsappLogs`, `invConsumptionIssues`.

**Rules**
- **Alerts** are computed from stock balances, open orders, approved invoices and pending approvals each time the page loads (low / out of stock, expired and near-expiry batches, quarantine, overdue POs, overdue and due-soon invoices). Only order-consumption problems are stored: when an order needs more stock than exists, or the ledger posting fails and the legacy deduction is used, a consumption issue is recorded once per order and item. Alerts are **not pushed** to phones or by WhatsApp; the page must be opened.
- **Stock audit** = snapshot of on-hand quantities for a branch/location/category → counters enter counts (blind by default: system quantity hidden until submission) → submit (every line counted, a reason for every difference) → a *different* person approves (self-approval only if the purchase setting allows it) → **post** writes one `adjustment_in`/`adjustment_out` per differing line through the stock ledger with a deterministic idempotency key (`audit:<id>:<line>`). Posting is resumable: finished lines are skipped. Differences are measured against the opening snapshot, so counting during service will show noise. Only one open audit per scope.
- **Forecast** = average consumption per day over the look-back window (weekday-seasonal with ≥ 28 days of history and ≥ 14 active days, flat otherwise), projected over the horizon; cover days, expected stock-out date and a suggested order quantity (usage over horizon + supplier lead time + safety stock − available − on order). Trend is shown, not applied. Confidence is high/medium/low by number of days with usage.
- **Consumption integration**: dish ingredients on each order already flow into the ledger (FEFO) for ingredients linked to inventory items (Phase 1 bridge). `/consumption` reports usage by order vs. waste vs. manual adjustments with cost, and lists ingredients that are **not linked** (their usage is invisible to the ledger).
- **Supplier scorecard** = weighted average of on-time delivery (30), fill rate (25), quality compliance (25) and clean invoice matching (20); components with no data are left out and weights re-balanced. Fewer than 3 posted receipts = not rated. Grades A ≥ 90, B ≥ 80, C ≥ 65, else D.
- **WhatsApp purchase list**: a user builds a list (or the server builds it from a PO's outstanding quantities), previews it (phone masked) and presses send. It uses the existing AiSensy integration and needs `AISENSY_API_KEY` plus a WhatsApp-approved template with 4 variables ({{1}} supplier, {{2}} branch, {{3}} item list, {{4}} date). Per-user hourly limit, 10-minute duplicate guard (override with `force`), every attempt logged (sent / failed) and audited; a failure is never retried automatically.

**Not done / assumptions (Phase 5)**
- No automatic or scheduled sends, alert push, e-mail/SMS, or reorder-to-WhatsApp automation; everything is user-triggered.
- Delivery/read receipts and supplier replies are not received; "sent" means AiSensy accepted the request. The template name must match an approved template exactly. Supplier numbers are assumed to be Indian mobiles.
- Dishky has no dedicated kitchen/KMS recipe module in this codebase (kitchen entries are permission names only). "Consumption integration" is the existing order → dish ingredients → ledger path; there is no recipe costing, yield or production-batch posting.
- Forecasting is statistics on past consumption only: it does not know reservations, events, holidays, menu changes or supplier delays; days are bucketed in IST; limited to 50,000 ledger entries per request.
- Scorecards cover all branches and all time and ignore price competitiveness.
- Audit counts are per existing balance row; stock found in a new batch must first be added through opening stock/adjustment.
- Admin screens compile but were not exercised in a browser.

Tests: `server/test/automation.test.js` (9 tests) and one added check in `ingredient-bridge.test.js`.
