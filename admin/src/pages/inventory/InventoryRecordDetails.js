/** InventoryRecordDetails.js — details pages of the Inventory module (items, stock audits). */
import React from "react";
import RecordView from "../pi-shared/RecordView";
import ItemBatches from "./ItemBatches";

export const KINDS = {
  items: { api: "/inventory/items", list: "/inventory/items", title: "Inventory item", no: "sku" },
  audits: { api: "/automation/audits", list: "/inventory/audits", title: "Stock audit", no: "auditNo" },
};

export default function InventoryRecordDetails({ kind }) {
  return <RecordView kind={kind} cfg={KINDS[kind]} extras={kind === "items" ? (doc) => <ItemBatches item={doc} /> : undefined} />;
}
