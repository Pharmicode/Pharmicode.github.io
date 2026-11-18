const projects = new Set(["claims", "adherence", "network", "formulary", "reconciliation"]);
const requested = new URLSearchParams(location.search).get("project");
const project = projects.has(requested) ? requested : "claims";
const select = (query) => document.querySelector(query);

function tableRow(values, tag) {
  const row = document.createElement("tr");
  for (const value of values) {
    const cell = document.createElement(tag);
    if (tag === "th") cell.scope = "col";
    cell.textContent = value ?? "—";
    row.append(cell);
  }
  return row;
}

function showMap(scenarios) {
  select("#map-panel").hidden = false;
  const scenario = select("#scenario");
  scenario.replaceChildren(...Object.keys(scenarios).map(name => new Option(name)));
  function renderMap() {
    const map = select("#map");
    const cells = [...scenarios[scenario.value]].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    map.setAttribute("aria-label", scenario.value + ". Scenario totals are in the results table.");
    map.replaceChildren(...cells.map(([x, y, population, minutes]) => {
      const cell = document.createElement("div");
      cell.className = minutes !== null && minutes <= 12 ? "cell covered" : "cell";
      cell.textContent = minutes ?? "—";
      cell.title = `Area (${x}, ${y}) · ${population} simulated residents`;
      return cell;
    }));
  }
  scenario.addEventListener("change", renderMap);
  renderMap();
}

async function load() {
  const response = await fetch(`${project}.json`);
  if (!response.ok) throw new Error("Data download failed");
  const { title, description, columns, rows, map } = await response.json();
  document.title = `${title} | Pharmicode`;
  select("#title").textContent = title;
  select("#description").textContent = description;
  select(`nav a[href="?project=${project}"]`).setAttribute("aria-current", "page");
  select("thead").replaceChildren(tableRow(columns, "th"));
  select("#download").href = `${project}-data.json`;
  select("#download").hidden = false;
  if (map) showMap(map);
  function renderRows() {
    const term = select("#filter").value.trim().toLowerCase();
    const matches = rows.filter(row => row.some(value => String(value).toLowerCase().includes(term)));
    select("tbody").replaceChildren(...matches.map(row => tableRow(row, "td")));
    select("#summary").textContent = `${matches.length} of ${rows.length} rows`;
  }
  select("#filter").addEventListener("input", renderRows);
  renderRows();
}

load().catch(() => {
  select("#summary").textContent = "The demo data could not be loaded. Reload the page to retry.";
});
