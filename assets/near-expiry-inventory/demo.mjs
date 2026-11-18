import { analyze, buckets, sampleDate, sampleInventory } from "./inventory.mjs";

const pick = selector => document.querySelector(selector);
const dateInput = pick("#as-of");
const show = pick("#window");
const search = pick("#search");
const cash = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const cost = cents => cents === null ? "—" : cash.format(cents / 100);

function row(values, status) {
  const tr = document.createElement("tr");
  for (const value of values) {
    const td = document.createElement("td");
    td.textContent = value;
    if (value === status && ["Expired", "Verify input"].includes(status)) td.className = "attention";
    tr.append(td);
  }
  return tr;
}

function render() {
  const validDate = dateInput.value && dateInput.checkValidity();
  const inventory = validDate ? analyze(sampleInventory, dateInput.value) : [];
  const summary = buckets.map(bucket => {
    const items = inventory.filter(item => item.bucket === bucket);
    return [bucket, items.length, items.reduce((sum, item) => sum + item.quantity, 0),
      items.reduce((sum, item) => sum + (item.valueCents ?? 0), 0)];
  });
  const atRisk = summary.slice(0, 4);
  pick("#headline").textContent = validDate
    ? `${atRisk.reduce((sum, item) => sum + item[1], 0)} lot rows expired or due within 90 days · ${cost(atRisk.reduce((sum, item) => sum + item[3], 0))} at cost`
    : "Choose a valid as-of date to see results.";
  pick("#summary tbody").replaceChildren(...(validDate
    ? summary.map(([bucket, count, units, value]) => row([bucket, count, units, cost(value)], bucket)) : []));
  const term = search.value.trim().toLowerCase();
  const matching = inventory.filter(item => (show.value === "all" || !["Over 90 days", "No stock"].includes(item.bucket))
    && [item.sku, item.product, item.lot, item.location].join(" ").toLowerCase().includes(term));
  pick("#queue tbody").replaceChildren(...matching.map(item => row([
    `${item.product} · ${item.lot}`, item.location, item.expiration || "Missing", item.bucket, item.quantity, cost(item.valueCents),
  ], item.bucket)));
  pick("#result-count").textContent = `${matching.length} lot rows shown`;
}

dateInput.value = sampleDate;
dateInput.addEventListener("input", render);
show.addEventListener("change", render);
search.addEventListener("input", render);
render();
