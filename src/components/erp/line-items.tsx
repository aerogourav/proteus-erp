"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { commit, nowIso, useErp } from "@/components/erp/store";
import { formatMoney, partNumber, revisionLabel, setLineItemPrice, setLineItemQuantity, type LineItem } from "@/lib/erp/model";

/** Quantity and price per part, editable until the order is dispatched (price until invoiced). */
export function LineItemsEditor({ projectId }: { projectId: string }) {
  const state = useErp();
  const lines = state.lineItems.filter((line) => line.projectId === projectId);
  const order = state.purchaseOrders.find((item) => item.projectId === projectId);
  const dispatched = state.dispatches.some((item) => item.projectId === projectId);
  const invoiced = state.invoices.some((item) => item.projectId === projectId);
  if (!lines.length || !order) return null;
  const total = lines.reduce((sum, line) => sum + (line.unitPrice ?? 0) * line.quantity, 0);
  return <div className="erp-lines">
    <div className="erp-lines-head" aria-hidden="true"><span>Part</span><span>Quantity</span><span>Price per unit ({order.currency})</span><span>Line value</span><span /></div>
    {lines.map((line) => <LineRow key={`${line.id}-${line.quantity}-${line.unitPrice}`} line={line} label={`${partNumber(state, line.partId)} rev ${revisionLabel(state, line.revisionId)}`} currency={order.currency} lockQty={dispatched} lockPrice={invoiced} />)}
    <p className="erp-lines-total"><span>Order value</span><b>{formatMoney(total, order.currency)}</b></p>
    <p className="erp-faint">{invoiced ? "Invoiced: quantities and prices are locked." : dispatched ? "Dispatched: quantities are locked. Prices can change until the invoice is created." : "Changes update the order value and, later, the invoice."}</p>
  </div>;
}

function LineRow({ line, label, currency, lockQty, lockPrice }: { line: LineItem; label: string; currency: string; lockQty: boolean; lockPrice: boolean }) {
  const [qty, setQty] = useState(String(line.quantity));
  const [price, setPrice] = useState(line.unitPrice === null ? "" : line.unitPrice.toFixed(2));
  const [error, setError] = useState("");
  const parsedPrice = Number(price.replace(",", "."));
  const changed = qty !== String(line.quantity) || (price.trim() !== "" && parsedPrice !== line.unitPrice);
  const save = () => {
    const quantity = Number(qty);
    if (!Number.isInteger(quantity) || quantity <= 0) { setError("Whole number above 0"); return; }
    if (price.trim() && !(parsedPrice >= 0)) { setError("Enter a valid price"); return; }
    commit((state) => {
      let next = state;
      if (!lockQty) next = setLineItemQuantity(next, line.id, quantity, nowIso());
      if (!lockPrice && price.trim()) next = setLineItemPrice(next, line.id, parsedPrice, nowIso());
      return next;
    });
    setError("");
  };
  return <div className="erp-lines-row">
    <strong>{label}<small>{line.unit}</small></strong>
    <input className="erp-input" aria-label={`Quantity for ${label}`} inputMode="numeric" disabled={lockQty} value={qty} onChange={(event) => setQty(event.target.value.replace(/[^0-9]/g, ""))} />
    <input className="erp-input" aria-label={`Price per unit for ${label}`} inputMode="decimal" disabled={lockPrice} value={price} onChange={(event) => setPrice(event.target.value)} />
    <span className="erp-num">{line.unitPrice !== null ? formatMoney(line.unitPrice * line.quantity, currency as never) : "—"}</span>
    <span>{changed ? <button type="button" className="erp-btn erp-btn-primary erp-btn-sm" onClick={save}><Check size={13} /> Save</button> : null}{error && <small className="erp-error">{error}</small>}</span>
  </div>;
}
