import { baseline, freshRun, releaseReport, readiness, target, transition } from "./model.mjs";

const byId = id => document.getElementById(id);
const storageKey = "pharmicode-medication-review-v1";
let state = freshRun();
let selected;
let storageAvailable = true;
try {
  const saved = localStorage.getItem(storageKey);
  if (saved) state = JSON.parse(saved);
} catch {
  storageAvailable = false;
}

function apply(action) {
  state = transition(state, action);
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    storageAvailable = false;
  }
  render();
}

function element(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text, handler, disabled = false) {
  const node = element("button", text);
  node.type = "button";
  node.className = "secondary";
  node.disabled = disabled;
  node.addEventListener("click", handler);
  return node;
}

function describe(row) {
  return `${row.package} · ${row.unit} · ${row.unitsPerPack}/pack`;
}

function openDialog(id, row) {
  selected = row.id;
  if (id === "editor") {
    byId("edit-title").textContent = `Edit ${row.id}`;
    byId("package").value = row.package;
    byId("unit").value = row.unit;
    byId("pack").value = row.unitsPerPack;
    byId("edit-error").textContent = "";
  } else {
    byId("review-title").textContent = `Review ${row.id}`;
    byId("review-name").value = state.reviews[row.id]?.name ?? "";
    byId("note").value = state.reviews[row.id]?.note ?? "";
    byId("review-error").textContent = "";
  }
  byId(id).showModal();
}

function render() {
  const result = releaseReport(state).results ?? [];
  const ready = readiness(state);
  byId("readiness").textContent = `Revision ${state.version} · ${ready}`;
  byId("storage-note").textContent = storageAvailable ? "Saved in this browser." : "Local saving unavailable. Download evidence before closing.";
  byId("sign").disabled = ready !== "Ready for simulated sign-off";
  byId("signed").textContent = state.signoff ? `Signed off by ${state.signoff.name} on ${state.signoff.at}.` : "";
  byId("records").replaceChildren(...state.rows.map(row => {
    const old = baseline.find(item => item.id === row.id);
    const checks = result.find(item => item.id === row.id)?.checks;
    const failures = checks?.filter(item => !item.pass).length;
    const review = state.reviews[row.id];
    const tr = element("tr");
    const record = element("th", row.id);
    record.scope = "row";
    record.append(element("small", row.system));
    const checkCell = element("td", checks ? (failures ? `${failures} failed` : "Passed") : "Pending");
    if (failures) checkCell.className = "fail";
    const reviewCell = element("td", review ? review.name : "Pending");
    if (review) reviewCell.append(element("small", review.note));
    const action = element("td");
    action.className = "actions";
    if (row.item === target.item) action.append(button(`Edit ${row.id}`, () => openDialog("editor", row)));
    action.append(button(`Review ${row.id}`, () => openDialog("reviewer", row), !checks || failures > 0 || Boolean(state.signoff)));
    tr.append(record, element("td", describe(old)), element("td", describe(row)), checkCell, reviewCell, action);
    return tr;
  }));
  byId("evidence").replaceChildren(...result.map(row => {
    const details = element("details");
    details.open = row.checks.some(check => !check.pass);
    const list = element("ul");
    for (const check of row.checks) {
      const item = element("li", `${check.pass ? "Pass" : "Fail"} · ${check.name}. Expected ${check.expected}. Observed ${check.actual ?? "missing"}.`);
      if (!check.pass) item.className = "fail";
      list.append(item);
    }
    details.append(element("summary", `${row.id} check evidence`), list);
    return details;
  }));
  byId("history").replaceChildren(...state.history.map(event =>
    element("li", `${event.at} · Revision ${event.version} · ${event.event} · ${event.detail}`)));
  const checks = result.flatMap(row => row.checks);
  const notes = element("ul");
  for (const row of state.rows) {
    const review = state.reviews[row.id];
    const status = result.find(item => item.id === row.id)?.checks;
    const outcome = status ? (status.every(check => check.pass) ? "passed" : "failed") : "pending";
    notes.append(element("li", `${row.id} · ${row.system} · ${describe(row)} · Checks ${outcome} · ${review ? `${review.name}: ${review.note}` : "Review pending"}`));
  }
  byId("print-summary").replaceChildren(element("h1", "Medication change release summary"),
    element("p", "Synthetic training exercise"),
    element("p", `MED-DEMO · PKG-100 to PKG-200 · Revision ${state.version} · ${ready}`),
    element("p", checks.length ? `${checks.filter(check => check.pass).length} of ${checks.length} checks passed.` : "Checks pending."),
    notes, element("p", state.signoff ? `Release lead: ${state.signoff.name} · ${state.signoff.at}` : "Release sign-off pending."));
}

function submit(dialog, form, error, action) {
  byId(form).addEventListener("submit", event => {
    event.preventDefault();
    try {
      apply(action());
      byId(dialog).close();
    } catch (failure) {
      byId(error).textContent = failure.message;
    }
  });
}

submit("editor", "editor-form", "edit-error", () => ({ type: "edit", id: selected,
  package: byId("package").value, unit: byId("unit").value, unitsPerPack: byId("pack").valueAsNumber }));
submit("reviewer", "review-form", "review-error", () => ({ type: "review", id: selected,
  name: byId("review-name").value, note: byId("note").value }));
document.querySelectorAll("[data-close]").forEach(node => node.addEventListener("click", () => node.closest("dialog").close()));
byId("run").addEventListener("click", () => apply({ type: "run" }));
byId("print").addEventListener("click", () => window.print());
byId("release-form").addEventListener("submit", event => {
  event.preventDefault();
  try {
    apply({ type: "sign", name: byId("lead").value });
  } catch (error) {
    byId("signed").textContent = error.message;
  }
});
byId("reset").addEventListener("click", () => {
  if (!window.confirm("Reset this browser’s exercise and clear the local review history?")) return;
  state = freshRun();
  byId("lead").value = "";
  try {
    localStorage.removeItem(storageKey);
  } catch {
    storageAvailable = false;
  }
  render();
});
byId("download").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(releaseReport(state), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = element("a");
  link.href = url;
  link.download = `medication-release-revision-${state.version}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
render();
