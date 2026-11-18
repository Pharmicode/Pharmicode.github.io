export const sampleDate = "2026-11-18";
const dayMs = 86400000;
const products = [
  ["DEMO-101", "Saline spray"], ["DEMO-102", "Oral rehydration packets"],
  ["DEMO-103", "Sterile gauze"], ["DEMO-104", "Alcohol prep pads"],
  ["DEMO-105", "Vitamin D tablets"], ["DEMO-106", "Adhesive bandages"],
];
const offsets = [61, 0, 91, 31, -3, 60, 30, 1, 90, 15, null, 43, 127, 82, 6, 22, 10, 5];
export const sampleInventory = offsets.map((offset, i) => {
  const [sku, product] = products[i % products.length];
  return {
    sku, product, lot: `LOT-${101 + i}`, location: ["Front shelf", "Stockroom", "Will-call cabinet"][i % 3],
    expiration: offset === null ? "" : new Date(Date.parse(sampleDate) + offset * dayMs).toISOString().slice(0, 10),
    quantity: i === 16 ? 0 : 5 + (i * 7) % 38, unitCost: i === 17 ? null : (175 + (i * 169) % 2200) / 100,
  };
});

export const buckets = ["Expired", "0–30 days", "31–60 days", "61–90 days", "Over 90 days", "Verify input", "No stock"];

export function analyze(inventory, asOf) {
  const rows = inventory.map(item => {
    const countOk = Number.isInteger(item.quantity) && item.quantity >= 0;
    const costOk = item.unitCost !== null && Number.isFinite(item.unitCost) && item.unitCost >= 0;
    const expiration = Date.parse(item.expiration);
    const days = Number.isFinite(expiration) ? (expiration - Date.parse(asOf)) / dayMs : null;
    const valid = item.sku && item.product && item.lot && item.location && countOk && costOk && days !== null;
    let bucket = buckets[5];
    if (valid) {
      if (item.quantity === 0) bucket = buckets[6];
      else if (days < 0) bucket = buckets[0];
      else if (days <= 30) bucket = buckets[1];
      else if (days <= 60) bucket = buckets[2];
      else if (days <= 90) bucket = buckets[3];
      else bucket = buckets[4];
    }
    const valueCents = countOk && costOk ? Math.round(item.quantity * item.unitCost * 100) : null;
    return { ...item, days, bucket, valueCents };
  });
  const priority = ["Verify input", ...buckets.slice(0, 5), "No stock"];
  return rows.sort((a, b) => priority.indexOf(a.bucket) - priority.indexOf(b.bucket)
    || (a.days ?? Infinity) - (b.days ?? Infinity) || (b.valueCents ?? -1) - (a.valueCents ?? -1)
    || a.lot.localeCompare(b.lot));
}
