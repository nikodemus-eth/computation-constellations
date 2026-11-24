import {
  initializeGovernance, versionLabel, revisionDigest, recordLocalReview, finalizationEligibility, finalizeRevision,
  boardSize, masterSeed,
  seed,
  semanticDiff,
  uid,
  clone,
  TYPES,
  META,
  instance,
  flow,
  view,
  createCase,
  inside,
  catalogFor,
  validate,
  evidenceState,
  editCase,
  renameCatalog,
  redact,
  saveDocument,
  recoverDocument,
} from "./model.js";
import { toDrawio, toVisio, toVisioStencil, fromDrawio, routeText, toSVG, download } from "./io.js";
const masterWorkspace = new URLSearchParams(location.search).has("master");
const workspaceStorage = { getItem: key => localStorage.getItem(masterWorkspace ? key + ".master17" : key), setItem: (key, value) => localStorage.setItem(masterWorkspace ? key + ".master17" : key, value) };
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const isolatedPreview = location.pathname === "/tests/preview";
let doc = masterWorkspace ? masterSeed() : seed(),
  loadError = "";
try {
  const saved = isolatedPreview ? null : workspaceStorage.getItem("cc.current");
  if (saved) {
    const parsed = JSON.parse(saved);
    if (validate(parsed).errors.length)
      loadError =
        "Saved draft has structural issues. Open Validation to resolve them.";
    doc = parsed;
  }
} catch {
  loadError =
    "Could not read the saved workspace. The original browser storage has not been replaced.";
}
initializeGovernance(doc);
let caseId = doc.cases[0].id,
  viewId = doc.cases[0].root,
  selection = null,
  mode = "design",
  tab = "canvas",
  search = "",
  step = -1,
  connectFrom = null,
  dirty = false,
  saveStatus = "Local workspace",
  navStack = [],
  zoom = 1,
  undo = [],
  redo = [];
const current = () => doc.cases.find((c) => c.id === caseId),
  currentView = () =>
    current().views.find((v) => v.id === viewId) || current().views[0],
  catalog = () => catalogFor(doc, current()) || doc.catalog;
const star = (id) => catalog().stars.find((s) => s.id === id),
  label = (i) => i.label || star(i.star)?.label || "Unknown component";
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("visible"), 4500);
}
function persist() {
  if (isolatedPreview) {
    dirty = false;
    saveStatus = "Isolated test preview";
    return true;
  }
  try {
    saveDocument(workspaceStorage, doc);
    dirty = false;
    saveStatus = "Saved on this device";
    return true;
  } catch (e) {
    dirty = true;
    saveStatus = "Save failed · changes in memory";
    toast(
      "Save failed. Your prior save remains available. Export an editable file to preserve current changes.",
    );
    return false;
  }
}
function mutation(description, fn) {
  if (mode !== "design") {
    toast("Switch to Design to edit.");
    return;
  }
  undo.push(clone(doc));
  if (undo.length > 30) undo.shift();
  redo = [];
  editCase(doc, caseId, description, fn);
  dirty = true;
  persist();
  render();
}
function switchCase(id) {
  caseId = id;
  viewId = current().root;
  selection = null;
  step = -1;
  connectFrom = null;
  navStack = [];
  zoom = 1;
  render();
}
function modal(title, body, onSubmit) {
  const d = $("#dialog");
  d.innerHTML = `<form method="dialog"><div class="modal-head"><h2>${esc(title)}</h2><button value="cancel" class="icon-button" aria-label="Close dialog">×</button></div>${body}</form>`;
  d.showModal();
  d.querySelector("form").addEventListener("submit", (e) => {
    if (e.submitter?.value === "cancel") return;
    e.preventDefault();
    try {
      Promise.resolve(onSubmit?.(new FormData(e.target))).catch(error => toast(error.message));
    } catch (error) {
      toast(error.message);
    }
  });
}
const field = (name, value, caption = name, type = "text") =>
  `<label class="field">${esc(caption)}<input name="${name}" type="${type}" value="${esc(value)}" placeholder="Unknown" ${type === "number" ? 'step="1"' : ""}></label>`;
const select = (name, value, values, caption = name) =>
  `<label class="field">${esc(caption)}<select name="${name}">${values.map((v) => `<option value="${esc(v)}" ${v === value ? "selected" : ""}>${esc(v.replaceAll("_", " "))}</option>`).join("")}</select></label>`;
function render() {
  const c = current(),
    v = currentView(),
    report = validate(doc, c.id),
    selected = [...v.instances, ...v.flows].find((x) => x.id === selection);
  const active = v.instances.filter((i) => i.active).length;
  $("#app").innerHTML =
    `<aside class="sidebar"><a class="brand" href="#" aria-label="Computation Constellations home"><span class="brand-symbol">✳</span><span>Computation<br><strong>Constellations</strong></span></a><div class="workspace-label"><span class="avatar">NC</span><div>Personal workspace<small>Local · single author</small></div></div><div class="side-heading">WORKSPACE <button class="icon-button" data-action="new" aria-label="New constellation">＋</button></div><button class="side-main active" data-action="home"><span>⌘</span> Constellations <span class="count">${doc.cases.length}</span></button><div class="case-list">${doc.cases.map((x, i) => `<button class="case-link ${x.id === c.id ? "selected" : ""}" data-case="${x.id}"><span class="case-dot"></span><span>${esc(x.title)}</span><small>0${i + 1}</small></button>`).join("")}</div><div class="side-divider"></div><a class="side-main" href="${masterWorkspace ? "/" : "/?master=1"}">${masterWorkspace ? "↶ Original workspace" : "✳ 17-star master version"}</a><button class="side-main" data-action="catalog"><span>✧</span> Star catalog <span class="count">${doc.catalog.stars.length}</span></button><button class="side-main" data-action="compare"><span>◫</span> Compare views</button><button class="side-main" data-action="history"><span>↶</span> Revision history</button><button class="side-main" data-action="import"><span>↥</span> Import diagram</button><input id="import-file" type="file" accept=".drawio,.xml" hidden><div class="sidebar-bottom"><span class="local-dot"></span> Your work stays on this device<button class="help-link" data-action="help">Keyboard & help <span>?</span></button></div></aside>
 <main><header class="topbar"><div class="breadcrumb">Workspace <span>/</span> Constellations <span>/</span> <b>${esc(c.title)}</b></div><div class="top-actions"><span class="save-state">${dirty ? "○" : "✓"} ${esc(saveStatus)}</span><button class="button" data-action="save">Save</button><button class="button primary" data-action="export">Export <span>↗</span></button></div></header>
 <section class="page-heading"><div><div class="eyebrow">CONSTELLATION / ${String(doc.cases.indexOf(c) + 1).padStart(2, "0")}</div><div class="title-row"><h1>${esc(c.title)}</h1><span class="status">${esc(c.status.replaceAll("_", " "))}</span><button class="icon-button" data-action="rename" aria-label="Rename constellation">✎</button></div><p>${esc(c.description)}</p></div><div class="mode-switch" aria-label="Editor mode"><button data-mode="design" class="${mode === "design" ? "chosen" : ""}">⌁ Design</button><button data-mode="explain" class="${mode === "explain" ? "chosen" : ""}">▷ Explain</button></div></section>
 <div class="workspace-toolbar"><div class="tabs"><button data-tab="canvas" class="${tab === "canvas" ? "chosen" : ""}">Architecture</button><button data-tab="list" class="${tab === "list" ? "chosen" : ""}">Components & flows</button><button data-action="walkthrough">Walkthrough <span>${c.steps.length}</span></button></div><div class="canvas-actions"><span>Catalog v${c.catalogRevision}</span><button class="text-button ${report.errors.length ? "error-text" : ""}" data-action="validate">${report.errors.length ? "⚠" : "✓"} ${report.errors.length ? report.errors.length + " issues" : "Structure valid"}</button><button class="icon-button" data-action="undo" aria-label="Undo" ${undo.length ? "" : "disabled"}>↶</button><button class="icon-button" data-action="redo" aria-label="Redo" ${redo.length ? "" : "disabled"}>↷</button></div></div>
 <section class="editor-layout"><div class="canvas-section"><div class="view-bar"><div>${v.parent ? '<button class="text-button" data-action="back">← Parent view</button> <span>/</span> ' : ""}<b>${esc(v.title)}</b><input class="workspace-search" id="workspace-search" aria-label="Search stars and flows" placeholder="Search stars…" value="${esc(search)}"><span class="subtle">${active} active components · ${v.flows.filter((f) => f.active).length} relationships</span></div><button class="text-button" data-action="connect">${connectFrom ? "Cancel connection" : "＋ Connect"}</button></div>${tab === "canvas" ? canvas(v) : list(v)}<div class="canvas-footer"><span><i class="legend-dot"></i> Solid: data · Dashed: control · Dotted: observation <span class="footer-separator">/</span> No system execution</span><div><button class="icon-button" data-action="zoom-out" aria-label="Zoom out">−</button><button class="text-button" data-action="zoom-reset">${Math.round(zoom * 100)}%</button><button class="icon-button" data-action="zoom-in" aria-label="Zoom in">＋</button></div></div>${mode === "explain" ? explainBar() : `<div class="hint"><span>↗</span> Drag a star into the active area. Select a component to inspect its relationships.<button class="text-button" data-action="help">View shortcuts</button></div>`}</div><aside class="inspector">${inspector(selected)}</aside></section><footer class="page-footer">A shared vocabulary. An intentional architecture.<span>Documentation workspace <span class="footer-separator">·</span> v0.1</span></footer></main>`;
  bind();
  if (connectFrom)
    toast("Select the destination component to create a connector.");
}
function canvas(v) {
  const {width: boardWidth, height: boardHeight} = boardSize(doc,current(),v);
  const cat = catalog(),
    parent = v.parent
      ? current()
          .views.flatMap((w) => w.instances)
          .find((i) => i.id === v.parent)
      : null;
  const permitted = parent ? star(parent.star)?.members : null;
  const available = cat.stars.filter(
    (s) =>
      (!permitted || permitted.includes(s.id)) &&
      s.label.toLowerCase().includes(search.toLowerCase()),
  );
  return `<div class="canvas-scroll"><div class="board" style="width:${100 * zoom}%;aspect-ratio:${boardWidth}/${boardHeight}"><svg id="canvas" viewBox="0 0 ${boardWidth} ${boardHeight}" aria-label="Constellation architecture" role="group"><defs><pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".75" fill="#dcdadf"/></pattern><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M1 1 L7 4 L1 7" fill="none" stroke="#a39bad" stroke-width="1.4"/></marker><marker id="arrow-active" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M1 1 L7 4 L1 7" fill="none" stroke="#7960b5" stroke-width="1.5"/></marker></defs><rect width="${boardWidth}" height="${boardHeight}" fill="url(#dots)"/><rect x="18" y="22" width="${boardWidth - 38}" height="${boardHeight - 50}" rx="12" class="outer-area"/><text x="40" y="54" class="svg-eyebrow">AVAILABLE STARS</text><text x="40" y="75" class="svg-muted">Drag in. Connect. Explain.</text><rect x="${v.area.x}" y="${v.area.y}" width="${v.area.width}" height="${v.area.height}" rx="14" class="active-area"/><text x="${v.area.x + 22}" y="${v.area.y + 30}" class="svg-eyebrow">ACTIVE COMPONENTS</text><text x="${v.area.x + 22}" y="${v.area.y + 50}" class="svg-muted">${esc(v.title)} · authored arrangement</text><text x="${v.area.x + v.area.width - 30}" y="${v.area.y + 32}" text-anchor="end" class="svg-muted">${v.instances.filter((i) => i.active).length} stars</text>${available.map((s, n) => `<g class="catalog-star" data-star="${s.id}" tabindex="0" role="button" aria-label="Add ${esc(s.label)}"><rect x="36" y="${112 + n * 68}" width="160" height="54" rx="8"/><text x="48" y="${145 + n * 68}" class="star-icon">${TYPES[s.type][0]}</text><text x="77" y="${135 + n * 68}" class="catalog-label">${esc(s.label.length > 18 ? s.label.slice(0, 17) + "…" : s.label)}</text><text x="77" y="${152 + n * 68}" class="svg-muted">${v.instances.filter((i) => i.star === s.id && i.active).length} in this view</text></g>`).join("")}${v.flows.map((f) => edge(v, f)).join("")}${v.instances.map((i) => node(i)).join("")}<text x="240" y="${boardHeight - 40}" class="svg-muted">${connectFrom ? "CONNECTING · select a destination" : mode === "explain" ? "EXPLANATION · saved positions preserved" : "DESIGN · arrow keys move a selected component"}</text></svg></div></div>`;
}
function node(i) {
  const s = star(i.star),
    highlight = selection === i.id || current().steps[step]?.target === i.id;
  return `<g class="node ${highlight ? "selected" : ""} ${!i.active ? "inactive" : ""}" data-node="${i.id}" tabindex="0" role="button" aria-label="${esc(label(i))}, ${TYPES[s?.type]?.[1] || "unknown"}, ${i.active ? "active" : "inactive"}" transform="translate(${i.x},${i.y})"><rect width="${i.width}" height="${i.height}" rx="10"/><text x="13" y="30" class="star-icon">${TYPES[s?.type]?.[0] || "?"}</text><text x="40" y="28" class="node-label">${esc(label(i).slice(0, i.width > 200 ? 30 : 19))}</text><text x="40" y="47" class="node-type">${esc(TYPES[s?.type]?.[1] || "Unknown")}</text><line x1="12" x2="${i.width - 12}" y1="58" y2="58"/><text x="13" y="74" class="node-state">${i.active ? "○ " + (i.claim?.intent || "proposed") : "◌ inactive appearance"}</text>${s?.type === "group" ? `<text x="140" y="74" class="node-state">↗</text>` : ""}<circle class="port" cx="${i.width}" cy="42" r="4"/></g>`;
}
function edge(v, f) {
  const a = v.instances.find((i) => i.id === f.source),
    b = v.instances.find((i) => i.id === f.target);
  if (!a || !b) return "";
  const vertical = Math.abs(b.y - a.y) > Math.abs(b.x - a.x);
  const x1 = vertical ? a.x + a.width / 2 : a.x + (b.x >= a.x ? a.width : 0),
    y1 = vertical ? a.y + (b.y >= a.y ? a.height : 0) : a.y + a.height / 2,
    x2 = vertical ? b.x + b.width / 2 : b.x + (b.x >= a.x ? 0 : b.width),
    y2 = vertical ? b.y + (b.y >= a.y ? 0 : b.height) : b.y + b.height / 2;
  const d = vertical
    ? `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`
    : `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`;
  const highlighted =
    selection === f.id || current().steps[step]?.target === f.id;
  return `<g class="edge ${highlighted ? "highlighted" : ""} ${f.kind === "control_flow" ? "control-edge" : f.kind === "observation" ? "observation-edge" : ""} ${f.path === "exception" ? "exception" : ""} ${!f.active ? "inactive" : ""}" data-edge="${f.id}" tabindex="0" role="button" aria-label="${esc(f.condition || f.kind)} relationship"><path class="edge-hit" d="${d}"/><path class="edge-line" d="${d}" marker-end="url(#${highlighted ? "arrow-active" : "arrow"})"/><text x="${(x1 + x2) / 2 + (vertical ? 9 : 0)}" y="${(y1 + y2) / 2 - 10}" class="edge-label" text-anchor="${vertical ? "start" : "middle"}">${esc((f.condition || f.kind.replaceAll("_", " ")).slice(0, 23))}</text></g>`;
}
function list(v) {
  return `<div class="list-view"><h3>Available stars</h3><div class="list-catalog">${catalog()
    .stars.map(
      (s) =>
        `<button class="button" data-add="${s.id}">${TYPES[s.type][0]} ${esc(s.label)} ＋</button>`,
    )
    .join("")}</div><h3>Appearances</h3>${v.instances
    .filter((i) =>
      (label(i) + " " + i.id + " " + (i.description || ""))
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .map(
      (i) =>
        `<button class="list-row" data-select="${i.id}"><span>${esc(label(i))}<small>${esc(i.id)}</small></span><span>${i.active ? "Active" : "Inactive"} →</span></button>`,
    )
    .join("")}<h3>Relationships</h3>${v.flows
    .filter((f) =>
      (f.kind + " " + (f.condition || "") + " " + (f.description || ""))
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .map(
      (f) =>
        `<button class="list-row" data-select="${f.id}"><span>${esc(label(v.instances.find((i) => i.id === f.source) || {}))} → ${esc(label(v.instances.find((i) => i.id === f.target) || {}))}<small>${esc(f.kind)} · ${esc(f.condition || "Condition unknown")}</small></span><span>${f.active ? "Active" : "Inactive"} →</span></button>`,
    )
    .join("")}</div>`;
}
function endpointField(name, value, v) {
  return `<label class="field">${name === "source" ? "Source" : "Target"} appearance<select name="${name}">${v.instances.map((i) => `<option value="${i.id}" ${i.id === value ? "selected" : ""}>${esc(label(i))} · ${esc(i.id.slice(-6))}</option>`).join("")}</select></label>`;
}
function inspector(selected) {
  const v = currentView(),
    c = current();
  if (!selected)
    return `<div class="inspector-heading"><span>CONSTELLATION DETAILS</span><span>ⓘ</span></div><div class="inspector-content"><div class="detail-symbol">✳</div><h2>${esc(c.title)}</h2><p class="subtle">${esc(c.description)}</p><div class="detail-rule"></div><dl><dt>Documentation status</dt><dd><span class="status">${esc(c.status.replaceAll("_", " "))}</span></dd><dt>Revision</dt><dd>${esc(versionLabel(c))}</dd><dt>Authorship</dt><dd>${esc(c.author?.kind || "unknown")} · unverified</dd><dt>Finalization</dt><dd>Blocked · trusted identity unavailable</dd><dt>Catalog</dt><dd>Core components · v${c.catalogRevision}</dd><dt>Implementation</dt><dd>Unverified</dd></dl><div class="detail-rule"></div><h3>About this view</h3><p class="subtle">Select a star or relationship to inspect its definition, contracts, and evidence.</p><div class="mini-stats"><span><b>${v.instances.filter((i) => i.active).length}</b> active stars</span><span><b>${v.flows.length}</b> relationships</span></div><button class="button full" data-action="review">Review this revision →</button><div class="quiet-note">A diagram describes a system. It does not execute it.</div></div>`;
  const isFlow = v.flows.some((f) => f.id === selected.id),
    s = isFlow ? null : star(selected.star),
    ev = evidenceState(doc, c, selected.id);
  return `<div class="inspector-heading"><span>${isFlow ? "RELATIONSHIP" : "COMPONENT"} DETAILS</span><button class="icon-button" data-action="deselect" aria-label="Close selection">×</button></div><div class="inspector-content"><div class="selected-title"><span class="detail-symbol small">${isFlow ? "↗" : TYPES[s?.type]?.[0] || "?"}</span><div><h2>${esc(isFlow ? selected.kind.replaceAll("_", " ") : label(selected))}</h2><small class="subtle">${isFlow ? "Use-case-owned connector" : TYPES[s?.type]?.[1]}</small></div></div>${!isFlow && s?.behavior ? `<p class="subtle">${esc(selected.behavior || s.behavior)}</p><details><summary>Source & metadata provenance</summary><p>${esc(s.source_reference)}</p><p>${esc(s.provenance)}</p></details>` : ""}<form id="inspector-form"><fieldset ${mode !== "design" ? "disabled" : ""}>${isFlow ? `${select("kind", selected.kind, ["data_flow", "control_flow", "dependency", "observation"], "Relationship type")}${field("condition", selected.condition, "Condition")}${endpointField("source", selected.source, v)}${endpointField("target", selected.target, v)}` : `${field("label", selected.label || s?.label, "Appearance label")}<div class="field-pair">${field("x", selected.x, "X position", "number")}${field("y", selected.y, "Y position", "number")}</div>`}<label class="field">Description<textarea name="description" rows="3" placeholder="Describe this ${isFlow ? "relationship" : "component"}…">${esc(selected.description || "")}</textarea></label>${field("owner", selected.owner, "Owner")}${select("classification", selected.classification || "public", ["public", "restricted"], "Sharing classification")}<label class="checkbox"><input name="active" type="checkbox" ${selected.active ? "checked" : ""}> Active ${isFlow ? "connector" : "appearance"}</label><details><summary>Intent & implementation</summary>${select("intent", selected.claim?.intent || "proposed", ["proposed", "as_documented"], "Design intent")}${select("implementation", selected.claim?.implementation || "unknown", ["unknown", "implemented", "observed"], "Implementation claim")}</details>${`<details><summary>Interface & contracts</summary>${["protocol", "operation", "input_contract", "output_contract", "transformation", "interface_version"].map((k) => field(k, selected[k], k.replaceAll("_", " "))).join("")}</details><details><summary>Access & failure behavior</summary>${["access", "permission", "policy", "enforcement", "failure", "timeout", "retry", "source_reference"].map((k) => field(k, selected[k], k.replaceAll("_", " "))).join("")}</details>`}<button class="button primary full" type="submit">Apply changes</button></fieldset></form><div class="detail-rule"></div><h3>Evidence <span class="status">${ev.assessment}</span></h3><p class="subtle">Freshness: ${ev.freshness}. Review approval is separate.</p><button class="button full" data-action="evidence">Manage evidence</button>${s?.type === "group" ? '<button class="button full" data-action="enter">Open nested view ↗</button>' : ""}<button class="button full" data-action="add-step">Add walkthrough step</button>${!isFlow ? '<button class="button full" data-action="connect">Connect to another star</button>' : ""}<details><summary>Stable identity</summary><code>${esc(selected.id)}</code>${s ? `<p class="subtle">Catalog: ${esc(s.id)}</p>` : ""}</details><button class="text-button danger" data-action="delete">Delete ${isFlow ? "relationship" : "appearance"}</button></div>`;
}
function explainBar() {
  const c = current(),
    s = c.steps[step];
  return `<div class="explain-bar"><div class="step-count">${step < 0 ? "▷" : String(step + 1).padStart(2, "0")}</div><div><b>${s ? "Step " + (step + 1) + " of " + c.steps.length : "Explore the architecture"}</b><p>${esc(s?.text || "Follow the documented route without changing the layout.")}</p></div><button class="button" data-action="prev-step" ${step <= 0 ? "disabled" : ""}>←</button><button class="button primary" data-action="next-step" ${step >= c.steps.length - 1 ? "disabled" : ""}>${step < 0 ? "Begin walkthrough" : "Next"} →</button></div>`;
}
function addStar(id, x = 280, y = 350) {
  if (mode !== "design") return toast("Switch to Design to add a component.");
  const v = currentView(),
    parent =
      v.parent &&
      current()
        .views.flatMap((w) => w.instances)
        .find((i) => i.id === v.parent);
  if (parent && !star(parent.star)?.members.includes(id))
    return toast("This star is not a declared member of the group.");
  const i = instance(id, x, y);
  i.active = inside(i, v.area);
  selection = i.id;
  mutation("Added appearance", (c) =>
    c.views.find((w) => w.id === viewId).instances.push(i),
  );
}
function selectItem(id) {
  if (connectFrom && currentView().instances.some((i) => i.id === id)) {
    if (connectFrom === id) return toast("Choose a different destination.");
    const f = flow(connectFrom, id);
    connectFrom = null;
    selection = f.id;
    mutation("Created relationship", (c) =>
      c.views.find((v) => v.id === viewId).flows.push(f),
    );
    return;
  }
  selection = id;
  render();
}
function enterGroup(id) {
  const i = currentView().instances.find((i) => i.id === id);
  if (star(i?.star)?.type !== "group") return;
  const parentState = {
    viewId,
    selection,
    zoom,
    scroll: $(".canvas-scroll")?.scrollLeft || 0,
    top: $(".canvas-scroll")?.scrollTop || 0,
  };
  let nested = current().views.find((v) => v.parent === id);
  if (!nested) {
    if (mode !== "design")
      return toast("This group has no authored nested view yet.");
    nested = view(label(i), id);
    mutation("Created nested view", (c) => c.views.push(nested));
  }
  navStack.push(parentState);
  viewId = nested.id;
  selection = null;
  zoom = nested.viewport?.zoom || 1;
  render();
}
function bind() {
  $("#workspace-search")?.addEventListener("input", (e) => {
    const position = e.target.selectionStart;
    search = e.target.value;
    render();
    const input = $("#workspace-search");
    input.focus();
    input.setSelectionRange(position, position);
  });
  document
    .querySelectorAll("[data-case]")
    .forEach((b) => (b.onclick = () => switchCase(b.dataset.case)));
  document.querySelectorAll("[data-mode]").forEach(
    (b) =>
      (b.onclick = () => {
        mode = b.dataset.mode;
        connectFrom = null;
        step = -1;
        render();
      }),
  );
  document.querySelectorAll("[data-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        tab = b.dataset.tab;
        render();
      }),
  );
  document
    .querySelectorAll("[data-action]")
    .forEach((b) => (b.onclick = () => action(b.dataset.action)));
  document
    .querySelectorAll("[data-select]")
    .forEach((b) => (b.onclick = () => selectItem(b.dataset.select)));
  document
    .querySelectorAll("[data-add]")
    .forEach((b) => (b.onclick = () => addStar(b.dataset.add)));
  document.querySelectorAll("[data-edge]").forEach((g) => {
    g.onclick = () => selectItem(g.dataset.edge);
    g.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectItem(g.dataset.edge);
      }
    };
  });
  document.querySelectorAll("[data-star]").forEach((g) => {
    g.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        addStar(g.dataset.star);
      }
    };
    g.onpointerdown = (e) => drag(e, null, g.dataset.star);
  });
  document.querySelectorAll("[data-node]").forEach((g) => {
    g.onpointerdown = (e) => drag(e, g.dataset.node);
    g.ondblclick = () => enterGroup(g.dataset.node);
    g.onkeydown = (e) => {
      if (["Enter", " "].includes(e.key)) {
        e.preventDefault();
        selectItem(g.dataset.node);
      }
      if (
        mode === "design" &&
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
      ) {
        e.preventDefault();
        const delta = e.shiftKey ? 1 : 10;
        selection = g.dataset.node;
        mutation("Moved appearance by keyboard", (c) => {
          const v = c.views.find((v) => v.id === viewId),
            i = v.instances.find((i) => i.id === selection);
          i.x +=
            e.key === "ArrowLeft" ? -delta : e.key === "ArrowRight" ? delta : 0;
          i.y +=
            e.key === "ArrowUp" ? -delta : e.key === "ArrowDown" ? delta : 0;
          i.active = inside(i, v.area);
        });
        document.querySelector(`[data-node="${selection}"]`)?.focus();
      }
    };
  });
  $("#inspector-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    mutation("Updated component metadata", (c) => {
      const v = c.views.find((v) => v.id === viewId),
        item = [...v.instances, ...v.flows].find((x) => x.id === selection);
      for (const [k, val] of data.entries()) {
        if (["intent", "implementation", "active"].includes(k)) continue;
        item[k] = ["x", "y"].includes(k) ? Number(val) : val;
      }
      item.claim = {
        intent: data.get("intent"),
        implementation: data.get("implementation"),
      };
      item.active = data.has("active");
      if (!item.source) {
        if (item.active && !inside(item, v.area)) {
          item.x = v.area.x + 35;
          item.y = v.area.y + 95;
        }
        if (!item.active && inside(item, v.area)) item.y = 680;
      }
    });
  });
  $("#import-file").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (file.size > 2097152) throw Error("File exceeds 2 MiB.");
      const text = await file.text(),
        candidate = fromDrawio(text);
      for (const incoming of [candidate.catalog, ...candidate.catalogHistory]) {
        const known = [doc.catalog, ...doc.catalogHistory].find(
          (x) => x.id === incoming.id && x.revision === incoming.revision,
        );
        if (!known || !semanticDiff(known, incoming).length) continue;
        if (incoming !== candidate.catalog)
          throw Error(
            "A historical catalog revision conflicts with the saved version. Resolve the conflict before import.",
          );
        const oldRevision = incoming.revision;
        candidate.catalogHistory = candidate.catalogHistory.filter(
          (x) => x.revision !== oldRevision,
        );
        candidate.catalogHistory.push(clone(known));
        incoming.revision =
          Math.max(
            doc.catalog.revision,
            ...[candidate.catalog, ...candidate.catalogHistory].map(
              (x) => x.revision,
            ),
          ) + 1;
        for (const c of candidate.cases)
          if (c.catalogRevision === oldRevision)
            c.catalogRevision = incoming.revision;
      }
      const hash = [
        ...new Uint8Array(
          await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
        ),
      ]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const report = validate(candidate);
      modal(
        "Review imported diagram",
        `<p>File: <b>${esc(file.name)}</b></p><p>${candidate.cases.length} use cases · ${candidate.catalog.stars.length} catalog stars · ${report.errors.length} structural errors</p><p class="subtle">This replaces the current workspace after preserving its previous save. Imported approval records remain historical; imported use cases open as new drafts.</p><details><summary>Semantic comparison</summary><pre>${esc(compareImports(doc, candidate))}</pre></details><p class="subtle">SHA-256: <code>${hash}</code></p><div class="modal-actions"><button class="button" value="cancel">Cancel</button><button class="button primary">Accept import</button></div>`,
        () => {
          const sources = new Map(
            [...candidate.imports, ...doc.imports].map((x) => [x.id, x]),
          );
          candidate.imports = [...sources.values()];
          candidate.history = [
            ...doc.history,
            ...doc.cases.map((c) => ({
              id: uid("H"),
              at: new Date().toISOString(),
              description: "Workspace before import",
              case: clone(c),
            })),
          ];
          candidate.imports.push({
            id: uid("IMPORT"),
            filename: file.name,
            hash,
            at: new Date().toISOString(),
            profile: candidate.profile,
            original: text,
          });
          initializeGovernance(candidate);
          for (const c of candidate.cases) editCase(candidate, c.id, "Imported claims retained as unverified; new draft", () => {});
          undo.push(clone(doc));
          doc = candidate;
          const saved = persist();
          caseId = doc.cases[0].id;
          viewId = current().root;
          selection = null;
          $("#dialog").close();
          render();
          toast(
            saved
              ? "Imported as a new draft. Original bytes retained on this device."
              : "Imported in memory only. Save failed; keep the original file.",
          );
        },
      );
    } catch (error) {
      toast("Import rejected: " + error.message);
    }
  };
}
function compareImports(a, b) {
  const scope = (d) => ({
    catalog: d.catalog,
    catalogHistory: d.catalogHistory,
    cases: d.cases,
    evidence: d.evidence,
  });
  const lines = semanticDiff(scope(a), scope(b));
  return (
    lines.slice(0, 500).join("\n") +
      (lines.length > 500
        ? `\n${lines.length - 500} additional differences; this import needs detailed review before acceptance.`
        : "") ||
    "No semantic differences in catalog, cases, walkthroughs, reviews, or evidence."
  );
}
function drag(e, id, starId) {
  if (e.button !== 0) return;
  if (mode !== "design" || connectFrom) {
    if (id) selectItem(id);
    return;
  }
  const svg = $("#canvas"),
    rect = svg.getBoundingClientRect(),
    sx = e.clientX,
    sy = e.clientY,
    i = id ? currentView().instances.find((i) => i.id === id) : null;
  const original = i ? { x: i.x, y: i.y } : null;
  const g = e.currentTarget;
  g.setPointerCapture(e.pointerId);
  let moved = false;
  g.onpointermove = (ev) => {
    if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 4) moved = true;
    if (i && moved) {
      const x = original.x + ((ev.clientX - sx) * svg.viewBox.baseVal.width) / rect.width,
        y = original.y + ((ev.clientY - sy) * svg.viewBox.baseVal.height) / rect.height;
      g.setAttribute("transform", `translate(${x},${y})`);
    }
  };
  g.onpointerup = (ev) => {
    g.onpointermove = null;
    g.onpointerup = null;
    if (!moved) {
      if (id) selectItem(id);
      else addStar(starId);
      return;
    }
    const x = Math.round(
        i
          ? original.x + ((ev.clientX - sx) * svg.viewBox.baseVal.width) / rect.width
          : ((ev.clientX - rect.left) * svg.viewBox.baseVal.width) / rect.width - 82,
      ),
      y = Math.round(
        i
          ? original.y + ((ev.clientY - sy) * svg.viewBox.baseVal.height) / rect.height
          : ((ev.clientY - rect.top) * svg.viewBox.baseVal.height) / rect.height - 42,
      );
    if (starId)
      addStar(
        starId,
        Math.max(20, Math.min(svg.viewBox.baseVal.width - (i?.width || 164) - 20, x)),
        Math.max(90, Math.min(svg.viewBox.baseVal.height - 84 - 20, y)),
      );
    else {
      selection = id;
      mutation("Moved appearance", (c) => {
        const v = c.views.find((v) => v.id === viewId),
          i = v.instances.find((i) => i.id === id);
        i.x = Math.max(20, Math.min(svg.viewBox.baseVal.width - (i?.width || 164) - 20, x));
        i.y = Math.max(90, Math.min(svg.viewBox.baseVal.height - 84 - 20, y));
        i.active = inside(i, v.area);
      });
    }
  };
}
function action(name) {
  if (
    mode !== "design" &&
    [
      "new",
      "rename",
      "import",
      "undo",
      "redo",
      "delete",
      "evidence",
      "catalog",
      "add-step",
      "walkthrough",
      "review",
    ].includes(name)
  )
    return toast("Switch to Design to edit documentation.");
  const c = current(),
    v = currentView(),
    item = [...v.instances, ...v.flows].find((x) => x.id === selection);
  switch (name) {
    case "home":
      tab = "canvas";
      render();
      break;
    case "deselect":
      selection = null;
      render();
      break;
    case "save":
      if (persist()) toast("Workspace saved on this device.");
      render();
      break;
    case "new":
      modal(
        "New constellation",
        `${field("title", "", "Title")}<label class="field">Description<textarea name="description" rows="3"></textarea></label><div class="modal-actions"><button class="button" value="cancel">Cancel</button><button class="button primary">Create constellation</button></div>`,
        (data) => {
          if (!data.get("title").trim()) throw Error("Enter a title.");
          const next = createCase(
            doc.catalog,
            data.get("title"),
            data.get("description"),
          );
          doc.cases.push(next);
          persist();
          $("#dialog").close();
          switchCase(next.id);
        },
      );
      break;
    case "rename":
      modal(
        "Edit constellation",
        `${field("title", c.title, "Title")}${field("description", c.description, "Description")}<div class="modal-actions"><button class="button primary">Save changes</button></div>`,
        (data) => {
          if (!data.get("title").trim()) throw Error("Enter a title.");
          mutation("Renamed constellation", (c) => {
            c.title = data.get("title");
            c.description = data.get("description");
          });
          $("#dialog").close();
        },
      );
      break;
    case "import":
      $("#import-file").click();
      break;
    case "undo":
      if (undo.length) {
        redo.push(clone(doc));
        doc = undo.pop();
        persist();
        if (!doc.cases.some((c) => c.id === caseId)) caseId = doc.cases[0].id;
        if (!current().views.some((v) => v.id === viewId))
          viewId = current().root;
        render();
      }
      break;
    case "redo":
      if (redo.length) {
        undo.push(clone(doc));
        doc = redo.pop();
        persist();
        render();
      }
      break;
    case "zoom-in":
      zoom = Math.min(1.8, zoom + 0.1);
      render();
      break;
    case "zoom-out":
      zoom = Math.max(0.5, zoom - 0.1);
      render();
      break;
    case "zoom-reset":
      zoom = 1;
      render();
      break;
    case "connect":
      if (mode !== "design")
        return toast("Switch to Design to connect components.");
      if (connectFrom) {
        connectFrom = null;
        render();
      } else if (item && !item.source) {
        connectFrom = item.id;
        render();
      } else connectDialog();
      break;
    case "enter":
      enterGroup(selection);
      break;
    case "back": {
      const state = navStack.pop();
      if (state) {
        viewId = state.viewId;
        selection = state.selection;
        zoom = state.zoom;
        render();
        if ($(".canvas-scroll")) {
          $(".canvas-scroll").scrollLeft = state.scroll;
          $(".canvas-scroll").scrollTop = state.top;
        }
      } else {
        viewId = c.root;
        render();
      }
      break;
    }
    case "next-step":
    case "prev-step":
      step += name === "next-step" ? 1 : -1;
      step = Math.max(0, Math.min(c.steps.length - 1, step));
      if (c.steps[step]) {
        viewId = c.steps[step].view;
        selection = c.steps[step].target;
      }
      render();
      break;
    case "walkthrough":
      walkthroughDialog();
      break;
    case "add-step":
      modal(
        "Add walkthrough step",
        `<p class="subtle">Target: ${esc(item?.id)}</p><label class="field">Explanation<textarea name="text" rows="4" required></textarea></label><div class="modal-actions"><button class="button primary">Add step</button></div>`,
        (data) => {
          mutation("Added walkthrough step", (c) =>
            c.steps.push({
              id: uid("STEP"),
              view: viewId,
              target: selection,
              text: data.get("text"),
            }),
          );
          $("#dialog").close();
        },
      );
      break;
    case "delete":
      if (!item) return;
      modal(
        "Delete selected item",
        `<p>Delete ${esc(item.id)}? For a group, this also removes its nested views. Related parent connectors and walkthrough steps remain flagged for explicit resolution. The prior revision remains recoverable.</p><div class="modal-actions"><button class="button" value="cancel">Cancel</button><button class="button primary">Delete item</button></div>`,
        () => {
          mutation("Deleted diagram item", (c) => {
            const v = c.views.find((v) => v.id === viewId);
            v.instances = v.instances.filter((i) => i.id !== selection);
            v.flows = v.flows.filter((f) => f.id !== selection);
            const removed = new Set([selection]);
            let changed = true;
            while (changed) {
              changed = false;
              c.views = c.views.filter((w) => {
                if (w.parent && removed.has(w.parent)) {
                  for (const i of w.instances) removed.add(i.id);
                  changed = true;
                  return false;
                }
                return true;
              });
            }
          });
          selection = null;
          $("#dialog").close();
          render();
        },
      );
      break;
    case "validate":
      validationDialog();
      break;
    case "review":
      reviewDialog().catch(error => toast(error.message));
      break;
    case "evidence":
      evidenceDialog();
      break;
    case "catalog":
      catalogDialog();
      break;
    case "compare":
      compareDialog();
      break;
    case "history":
      historyDialog();
      break;
    case "export":
      exportDialog();
      break;
    case "help":
      modal(
        "Working with constellations",
        `<div class="help-content"><h3>Build an architecture</h3><p>Drag an available star into the active area, or focus it and press Enter. Reusing a star creates an independent appearance.</p><h3>Keyboard</h3><p>Tab to a component; Enter selects it. Arrow keys move it by 10 units; Shift + arrow moves by 1. Inspector coordinates offer another way to position it.</p><p>Use Connect to choose endpoints without dragging. Double-click a group or choose Open nested view. Explain follows your saved walkthrough.</p><h3>Local storage</h3><p>Changes save in this browser. Export an editable file for a durable backup. Revision history retains prior edits on this device. Exported SVG and text files do not execute systems.</p><p>External draw.io Desktop compatibility has not been certified. Its supported profile workflow is documented in the project README.</p></div><div class="modal-actions"><button class="button" value="cancel">Close</button></div>`,
      );
      break;
  }
}
function connectDialog() {
  const v = currentView();
  modal(
    "Create relationship",
    `<label class="field">Source<select name="source">${v.instances
      .filter((i) => i.active)
      .map(
        (i) =>
          `<option value="${i.id}">${esc(label(i))} · ${esc(i.id.slice(-6))}</option>`,
      )
      .join(
        "",
      )}</select></label><label class="field">Destination<select name="target">${v.instances
      .filter((i) => i.active)
      .map(
        (i) =>
          `<option value="${i.id}">${esc(label(i))} · ${esc(i.id.slice(-6))}</option>`,
      )
      .join(
        "",
      )}</select></label>${select("kind", "data_flow", ["data_flow", "control_flow", "dependency", "observation"], "Relationship")}${field("condition", "", "Condition")}<div class="modal-actions"><button class="button primary">Create relationship</button></div>`,
    (data) => {
      if (!data.get("source") || data.get("source") === data.get("target"))
        throw Error("Choose two different active components.");
      const f = flow(
        data.get("source"),
        data.get("target"),
        data.get("condition"),
      );
      f.kind = data.get("kind");
      selection = f.id;
      mutation("Created relationship", (c) =>
        c.views.find((v) => v.id === viewId).flows.push(f),
      );
      $("#dialog").close();
    },
  );
}
function validationDialog() {
  const r = validate(doc);
  modal(
    "Structural validation",
    `<div class="validation-summary ${r.errors.length ? "error-text" : ""}">${r.errors.length ? "⚠ " + r.errors.length + " blocking issues" : "✓ No blocking structural issues"}</div><p class="subtle">Structural validity does not establish implementation or evidence.</p>${[...r.errors, ...r.warnings].map((e) => `<div class="issue"><b>${esc(e.message)}</b><code>${esc(e.id)}</code></div>`).join("") || "<p>All references resolve.</p>"}<div class="modal-actions"><button class="button" value="cancel">Close</button></div>`,
  );
}
async function reviewDialog() {
  const c = current(), target = { revisionId: c.revisionId, digest: await revisionDigest(doc, c) };
  const previous = doc.history.find(h => h.case.revisionId === c.parentRevisionId)?.case;
  const changes = previous ? semanticDiff(previous, c) : ["Initial or imported revision; no local parent snapshot available."];
  modal("Review & release", `
    <p><b>${esc(versionLabel(c))}</b> · Origin: ${esc(c.author.kind)} (unverified attribution)</p>
    <p class="subtle">Revision <code>${esc(c.revisionId)}</code><br>Parent <code>${esc(c.parentRevisionId || "None")}</code></p>
    <details><summary>Content SHA-256 (includes pinned catalog)</summary><code>${target.digest}</code></details>
    <details><summary>Changes from parent (${changes.length})</summary><pre>${esc(changes.join("\n"))}</pre></details>
    <h3>Review records</h3><p class="subtle">Names and decisions below are local claims, not verified human approval. Authorship and implementation evidence remain separate.</p>
    ${c.reviews.filter(r => r.revisionId === c.revisionId).map(r => `<div class="issue"><b>${esc(r.decision)} · ${esc(r.reviewer)}</b><small>${esc(r.at)} · unverified</small><p>${esc(r.notes)}</p></div>`).join("") || "<p>No decisions for this revision.</p>"}
    ${field("reviewer", "", "Reviewer name (unverified)")}${select("decision", "request_review", ["request_review", "approve", "return_changes", "reject", "withdraw"], "Decision")}
    <label class="field">Review notes<textarea name="notes" rows="3"></textarea></label>
    <h3>Finalization: blocked</h3><p class="subtle">${esc(finalizationEligibility().reason)}</p>
    <div class="modal-actions"><button type="button" id="finalize-revision" class="button">Check finalization</button><button class="button primary">Record local decision</button></div>`,
    async data => {
      const before = clone(doc);
      await recordLocalReview(doc, c.id, target, data.get("reviewer"), data.get("decision"), data.get("notes"));
      if (!persist()) { doc = before; throw Error("Review was not saved. Prior review state preserved."); }
      $("#dialog").close(); render();
    });
  $("#finalize-revision").onclick = () => { try { finalizeRevision(); } catch (error) { toast(error.message); } };
}
function evidenceDialog() {
  const records = doc.evidence.filter((e) => e.subject === selection);
  modal(
    "Evidence for this claim",
    `<p class="subtle">Evidence is assessed against the current subject and revision. URLs remain inert references.</p>${records.map((e) => `<div class="issue"><b>${esc(e.title)}</b><small>Revision ${e.revision} · ${esc(e.assessment)} · due ${esc(e.due || "unknown")}</small><button type="button" class="text-button danger" data-remove-evidence="${e.id}">Remove evidence</button></div>`).join("")}${field("title", "", "Source title")}${field("source", "", "Source reference")}${field("reviewer", "", "Assessed by")}${field("reviewed", new Date().toISOString().slice(0, 10), "Assessment date", "date")}${field("due", "", "Review due (optional)", "date")}${select("assessment", "unverified", ["unverified", "supported"], "Assessment")}<div class="modal-actions"><button class="button primary">Record evidence</button></div>`,
    (data) => {
      if (!data.get("title") || !data.get("source") || !data.get("reviewer"))
        throw Error("Title, source, and assessor are required.");
      const source = data.get("source");
      if (/^(javascript|data|file|vbscript):/i.test(source))
        throw Error("Unsafe source reference.");
      mutation("Evidence assessed", (c) =>
        doc.evidence.push({
          id: uid("E"),
          subject: selection,
          caseId,
          revision: c.revision + 1,
          ...Object.fromEntries(data.entries()),
        }),
      );
      $("#dialog").close();
      render();
    },
  );
  document.querySelectorAll("[data-remove-evidence]").forEach(
    (b) =>
      (b.onclick = () => {
        mutation("Evidence removed", () => {
          const removed = doc.evidence.find(
            (e) => e.id === b.dataset.removeEvidence,
          );
          doc.audit.push({
            action: "Evidence withdrawn",
            record: clone(removed),
            at: new Date().toISOString(),
          });
          doc.evidence = doc.evidence.filter(
            (e) => e.id !== b.dataset.removeEvidence,
          );
        });
        $("#dialog").close();
        render();
      }),
  );
}
function catalogDialog() {
  modal(
    "Core star catalog",
    `<p class="subtle">Revision ${doc.catalog.revision}. Renaming preserves identity and creates a new catalog revision. Existing use cases stay pinned.</p><label class="field">Star<select name="star">${doc.catalog.stars.map((s) => `<option value="${s.id}">${esc(s.label)} · ${esc(s.id)}</option>`).join("")}</select></label>${field("label", "", "New catalog label")}<div class="modal-actions"><button class="button" type="button" id="catalog-edit">Edit / add definitions</button><button class="button" type="button" id="rebase">Reconcile current use case</button><button class="button primary">Rename star</button></div>`,
    (data) => {
      if (!data.get("label").trim()) throw Error("Enter a new label.");
      renameCatalog(doc, data.get("star"), data.get("label"));
      persist();
      $("#dialog").close();
      render();
    },
  );
  $("#catalog-edit").onclick = () => {
    $("#dialog").close();
    catalogEditor();
  };
  $("#rebase").onclick = () => {
    const before = current().catalogRevision;
    mutation(
      "Reconciled catalog revision " + before + " → " + doc.catalog.revision,
      (c) => {
        c.catalogRevision = doc.catalog.revision;
      },
    );
    $("#dialog").close();
    toast("Catalog revision reconciled; review the draft.");
  };
}
function catalogEditor(id = "new") {
  const s = doc.catalog.stars.find((s) => s.id === id) || {
    label: "",
    type: "conventional_service",
    members: [],
  };
  modal(
    "Edit catalog definition",
    `<label class="field">Definition<select id="definition-picker"><option value="new">＋ New star</option>${doc.catalog.stars.map((x) => `<option value="${x.id}" ${x.id === id ? "selected" : ""}>${esc(x.label)}</option>`).join("")}</select></label>${field("label", s.label, "Label")}${select("type", s.type, Object.keys(TYPES), "Component type")}${field("description", s.description, "Description")}${field("owner", s.owner, "Owner")}${field("source_reference", s.source_reference, "Source / context reference")}${select("classification", s.classification || "public", ["public", "restricted"], "Sharing classification")}<p class="subtle">Group members (used only for Group type). A component may belong to multiple groups.</p><div class="catalog-editor-members">${doc.catalog.stars
      .filter((x) => x.id !== id)
      .map(
        (x) =>
          `<label class="checkbox"><input name="member" type="checkbox" value="${x.id}" ${(s.members || []).includes(x.id) ? "checked" : ""}>${esc(x.label)}</label>`,
      )
      .join(
        "",
      )}</div><p class="subtle">Saving creates a catalog revision. Existing use cases remain pinned until explicitly reconciled.</p><div class="modal-actions"><button class="button" value="cancel">Cancel</button><button class="button primary">Save definition</button></div>`,
    (data) => {
      if (!data.get("label").trim()) throw Error("Enter a label.");
      const candidate = clone(doc);
      candidate.catalogHistory.push(clone(candidate.catalog));
      candidate.catalog.revision++;
      const record = {
        ...s,
        id: id === "new" ? uid("S") : id,
        label: data.get("label"),
        type: data.get("type"),
        description: data.get("description"),
        owner: data.get("owner"),
        source_reference: data.get("source_reference"),
        classification: data.get("classification"),
        members: data.get("type") === "group" ? data.getAll("member") : [],
      };
      if (id === "new") candidate.catalog.stars.push(record);
      else
        candidate.catalog.stars[
          candidate.catalog.stars.findIndex((x) => x.id === id)
        ] = record;
      const errors = validate(candidate).errors;
      if (errors.length) throw Error(errors[0].message);
      undo.push(clone(doc));
      redo = [];
      doc = candidate;
      doc.audit.push({
        action: "Catalog definition saved",
        subject: record.id,
        revision: doc.catalog.revision,
        at: new Date().toISOString(),
      });
      persist();
      $("#dialog").close();
      render();
      toast("Catalog updated. Reconcile use cases explicitly to adopt it.");
    },
  );
  $("#definition-picker").onchange = (e) => {
    $("#dialog").close();
    catalogEditor(e.target.value);
  };
}
function compareDialog() {
  const cases = doc.cases;
  modal(
    "Compare constellations",
    `<p class="subtle">Shared catalog definitions indicate shared vocabulary, not shared deployments.</p><div class="comparison"><table><thead><tr><th>Catalog star</th>${cases.map((c) => `<th>${esc(c.title)}</th>`).join("")}</tr></thead><tbody>${doc.catalog.stars.map((s) => `<tr><td>${esc(s.label)}</td>${cases.map((c) => `<td>${c.views.flatMap((v) => v.instances).filter((i) => i.active && i.star === s.id).length || "—"}</td>`).join("")}</tr>`).join("")}<tr><td>Local relationships</td>${cases.map((c) => `<td>${c.views.flatMap((v) => v.flows).length}</td>`).join("")}</tr><tr><td>Catalog revision</td>${cases.map((c) => `<td>v${c.catalogRevision}</td>`).join("")}</tr></tbody></table></div><p class="subtle">Counts include nested views. Each appearance and connector remains local.</p><div class="modal-actions"><button class="button" value="cancel">Close</button></div>`,
  );
}
function walkthroughDialog() {
  const c = current();
  modal(
    "Author the walkthrough",
    `<p class="subtle">Select any component or connector and choose Add walkthrough step to extend this route. Repeated targets are allowed.</p>${c.steps.map((s, n) => `<div class="walk-row"><b>${n + 1}</b><textarea data-step-text="${s.id}" aria-label="Step ${n + 1} explanation">${esc(s.text)}</textarea><button class="icon-button" type="button" data-up="${s.id}" aria-label="Move step ${n + 1} up">↑</button><button class="icon-button danger" type="button" data-remove-step="${s.id}" aria-label="Remove step ${n + 1}">×</button></div>`).join("")}<div class="modal-actions"><button class="button" value="cancel">Close</button><button class="button primary">Save explanations</button></div>`,
    () => {
      const values = [...document.querySelectorAll("[data-step-text]")].map(
        (t) => [t.dataset.stepText, t.value],
      );
      mutation("Edited walkthrough", (c) =>
        values.forEach(
          ([id, text]) => (c.steps.find((s) => s.id === id).text = text),
        ),
      );
      $("#dialog").close();
    },
  );
  document.querySelectorAll("[data-up]").forEach(
    (b) =>
      (b.onclick = () => {
        mutation("Reordered walkthrough", (c) => {
          const n = c.steps.findIndex((s) => s.id === b.dataset.up);
          if (n > 0)
            [c.steps[n - 1], c.steps[n]] = [c.steps[n], c.steps[n - 1]];
        });
        $("#dialog").close();
        walkthroughDialog();
      }),
  );
  document.querySelectorAll("[data-remove-step]").forEach(
    (b) =>
      (b.onclick = () => {
        mutation(
          "Removed walkthrough step",
          (c) =>
            (c.steps = c.steps.filter((s) => s.id !== b.dataset.removeStep)),
        );
        $("#dialog").close();
        walkthroughDialog();
      }),
  );
}
function historyDialog() {
  const history = doc.history.filter((h) => h.case.id === caseId).toReversed();
  modal(
    "Revision history",
    `<p class="subtle">Recover a prior revision as a new draft. Local records are editable, not a tamper-proof audit trail.</p>${history.map((h) => `<div class="history-row"><div><b>${esc(versionLabel(h.case))} · ${esc(h.case.status)}</b><small>${esc(h.case.revisionId || "Legacy revision")} · ${esc(h.description)} · ${new Date(h.at).toLocaleString()}</small></div><button type="button" class="button" data-restore="${h.id}">Restore</button></div>`).join("") || "<p>No earlier edits in this constellation.</p>"}<div class="modal-actions"><button type="button" id="recover" class="button">Recover previous browser save</button><button class="button" value="cancel">Close</button></div>`,
  );
  document.querySelectorAll("[data-restore]").forEach(
    (b) =>
      (b.onclick = () => {
        const old = doc.history.find((h) => h.id === b.dataset.restore).case;
        mutation("Restored revision " + old.revision, (c) => {
          const revision = c.revision;
          Object.assign(c, clone(old));
          c.revision = revision;
        });
        viewId = current().root;
        selection = null;
        $("#dialog").close();
        render();
      }),
  );
  $("#recover").onclick = () => {
    try {
      doc = recoverDocument(workspaceStorage);
      caseId = doc.cases[0].id;
      viewId = current().root;
      selection = null;
      dirty = true;
      saveStatus = "Recovered · save to accept";
      $("#dialog").close();
      render();
      toast("Previous save recovered in memory. Save to accept.");
    } catch (e) {
      toast(e.message);
    }
  };
}
function exportDialog() {
  modal(
    "Export constellation",
    `<p class="subtle">Editable files include all use cases for a private export. Visio VSDX includes editable pages and Shape Data; VSSX exports the current catalog as a stencil. SVG shows the current view; text describes the current use case. Visio import back into this app is not supported.</p>${select("format", "drawio", ["drawio", "visio_vsdx", "visio_stencil_vssx", "svg", "text", "manifest"], "Format")}${select("audience", "private", ["private", "public"], "Audience")}<div class="export-preview"><b>Public export policy</b><p>Only this use case. Restricted components and their connectors are removed. Free-text descriptions, local labels, conditions, walkthroughs, evidence, and history are omitted to prevent indirect disclosure. No editable source is embedded in SVG.</p></div><div class="modal-actions"><button class="button" value="cancel">Cancel</button><button class="button primary">Download export ↗</button></div>`,
    (data) => {
      const publicView = data.get("audience") === "public",
        out = publicView ? redact(doc, caseId) : clone(doc),
        c = out.cases.find((c) => c.id === caseId),
        v = c.views.find((v) => v.id === viewId);
      if (!v)
        throw Error(
          "This view is excluded from the public export. Return to the root view.",
        );
      const format = data.get("format");
      let content, type, extension;
      const basename = publicView
        ? "shared-constellation"
        : c.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      if (format === "drawio") {
        content = toDrawio(out);
        type = "application/xml";
        extension = "drawio";
      } else if (format === "visio_vsdx" || format === "visio_stencil_vssx") {
        content = format === "visio_vsdx" ? toVisio(out) : toVisioStencil(out);
        type = "application/vnd.ms-visio.drawing";
        extension = format === "visio_vsdx" ? "vsdx" : "vssx";
      } else if (format === "svg") {
        content = toSVG(out, c, v);
        type = "image/svg+xml";
        extension = "svg";
      } else if (format === "text") {
        content = routeText(out, c);
        type = "text/plain";
        extension = "txt";
      } else {
        content = JSON.stringify(
          {
            profile: out.profile,
            catalogRevision: c.catalogRevision,
            useCase: c.id,
            revision: c.revision,
            revisionId: c.revisionId,
            versionLabel: versionLabel(c),
            authorship: c.author,
            approval: "Unverified local claims only",
            finalization: "Not verified; no release authority",
            views: c.views.map((v) => v.id),
            audience: data.get("audience"),
            redaction: publicView
              ? "Restricted records and all descriptive free text excluded"
              : "None",
            exportedAt: new Date().toISOString(),
            compatibility: "External draw.io Desktop round trip not certified",
          },
          null,
          2,
        );
        type = "application/json";
        extension = "json";
      }
      download(content, basename + "." + extension, type);
      doc.audit.push({
        action: "Export download requested",
        format,
        audience: data.get("audience"),
        revision: current().revision,
        caseId,
        at: new Date().toISOString(),
      });
      persist();
      $("#dialog").close();
      toast("Download requested. Check your browser downloads for completion.");
      render();
    },
  );
}
window.addEventListener("beforeunload", (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "s") {
    e.preventDefault();
    action("save");
  }
  if (e.key === "Escape") {
    connectFrom = null;
  }
});
render();
if (loadError) toast(loadError);
