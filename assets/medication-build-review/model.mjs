export const target = { item: "MED-DEMO", oldPackage: "PKG-100", newPackage: "PKG-200", unit: "EA", unitsPerPack: 24 };
export const baseline = [
  { id: "ORD-17", system: "Order set", item: target.item, package: target.oldPackage, unit: "EA", unitsPerPack: 12 },
  { id: "CAB-41", system: "Dispensing cabinet", item: target.item, package: target.oldPackage, unit: "EA", unitsPerPack: 12 },
  { id: "CHG-09", system: "Charge mapping", item: target.item, package: target.oldPackage, unit: "EA", unitsPerPack: 12 },
  { id: "ORD-19", system: "Order set", item: "MED-OTHER", package: "PKG-700", unit: "EA", unitsPerPack: 6 },
];
export const candidate = baseline.map(row => {
  if (row.id === "ORD-17") return { ...row, package: target.newPackage, unitsPerPack: 24 };
  if (row.id === "CHG-09") return { ...row, package: target.newPackage, unit: "BOX", unitsPerPack: 24 };
  return { ...row };
});

export const freshRun = () => ({ version: 1, rows: candidate.map(row => ({ ...row })), results: null,
  testedVersion: null, reviews: {}, signoff: null, history: [] });

export function check(rows) {
  const results = [];
  const known = new Map(baseline.map(row => [row.id, row]));
  for (const original of baseline.filter(row => row.item === target.item)) {
    const matches = rows.filter(row => row.id === original.id);
    const row = matches[0];
    const identityOk = matches.length === 1 && row.item === target.item && row.system === original.system;
    results.push({ id: original.id, system: original.system, checks: [
      { name: "Record identity", expected: "Unique linked record", actual: identityOk ? "Unique linked record" : "Missing, duplicated or mismatched", pass: identityOk },
      { name: "Package code", expected: target.newPackage, actual: row?.package, pass: identityOk && row.package === target.newPackage },
      { name: "Transaction unit", expected: target.unit, actual: row?.unit, pass: identityOk && row.unit === target.unit },
      { name: "Units per pack", expected: target.unitsPerPack, actual: row?.unitsPerPack, pass: identityOk && row.unitsPerPack === target.unitsPerPack },
    ] });
  }
  for (const original of baseline.filter(row => row.item !== target.item)) {
    const matches = rows.filter(row => row.id === original.id);
    const unchanged = matches.length === 1 && Object.keys(original).every(key => matches[0][key] === original[key]);
    results.push({ id: original.id, system: original.system, checks: [
      { name: "Unrelated record", expected: "Unchanged", actual: unchanged ? "Unchanged" : "Changed, missing or duplicated", pass: unchanged },
    ] });
  }
  for (const row of rows.filter(row => !known.has(row.id))) {
    results.push({ id: row.id, system: row.system, checks: [
      { name: "Unexpected record", expected: "No additional records in this release", actual: row.id, pass: false },
    ] });
  }
  return results;
}

export function readiness(state) {
  if (!state.results || state.testedVersion !== state.version) return "Run checks for the current revision";
  if (state.results.some(row => row.checks.some(result => !result.pass))) return "Resolve failed checks";
  if (state.results.some(row => !state.reviews[row.id])) return "Record review for each tested row";
  return state.signoff ? "Signed off in the simulation" : "Ready for simulated sign-off";
}

export function transition(state, action, at = new Date().toISOString()) {
  const next = structuredClone(state);
  const add = (event, detail) => next.history.push({ at, version: next.version, event, detail });
  if (action.type === "edit") {
    const row = next.rows.find(row => row.id === action.id && row.item === target.item);
    const { package: code, unit, unitsPerPack } = action;
    if (!row || !code?.trim() || !["EA", "BOX"].includes(unit) || !Number.isInteger(unitsPerPack) || unitsPerPack < 1) {
      throw new Error("Enter a package code, a transaction unit, and a positive integer pack size.");
    }
    const changes = { package: code.trim(), unit, unitsPerPack };
    if (Object.keys(changes).every(key => row[key] === changes[key])) return state;
    const before = `${row.package} / ${row.unit} / ${row.unitsPerPack}`;
    Object.assign(row, changes);
    next.version++;
    next.reviews = {};
    next.signoff = null;
    add("Candidate edited", `${row.id}: ${before} → ${row.package} / ${row.unit} / ${row.unitsPerPack}`);
  } else if (action.type === "run") {
    next.results = check(next.rows);
    next.testedVersion = next.version;
    const total = next.results.flatMap(row => row.checks);
    add("Checks run", `${total.filter(result => result.pass).length} of ${total.length} passed`);
    next.history.at(-1).results = next.results;
  } else if (action.type === "review") {
    const row = next.results?.find(row => row.id === action.id);
    if (next.testedVersion !== next.version || !row || row.checks.some(result => !result.pass) ||
        !action.name?.trim() || !action.note?.trim() || next.signoff) {
      throw new Error("The row must pass this revision’s checks. Add a reviewer name and a review note.");
    }
    next.reviews[row.id] = { name: action.name.trim(), note: action.note.trim(), at };
    add("Review recorded", `${row.id} · ${action.name.trim()} · ${action.note.trim()}`);
  } else if (action.type === "sign") {
    if (readiness(state) !== "Ready for simulated sign-off" || !action.name?.trim()) {
      throw new Error("Complete current checks and reviews and provide a release lead name.");
    }
    next.signoff = { name: action.name.trim(), at };
    add("Simulated sign-off", action.name.trim());
  } else {
    throw new Error("Unknown workflow action.");
  }
  return next;
}

export function releaseReport(state) {
  const results = state.testedVersion === state.version ? state.results : null;
  return {
    scenario: "Synthetic hospital medication package change",
    version: state.version, disposition: readiness(state), target, baseline, candidate: state.rows,
    results, reviews: state.reviews, signoff: state.signoff, history: state.history,
  };
}
