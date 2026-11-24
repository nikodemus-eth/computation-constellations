export const PROFILE = "cc-drawio-0.3-draft";
export const AREA = { x: 215, y: 120, width: 805, height: 550 };
export const TYPES = {
  input: ["↳", "Input"],
  deterministic_rules: ["◇", "Deterministic rules"],
  conventional_service: ["⚙", "Conventional service"],
  record_store: ["▤", "Record store"],
  probabilistic_model: ["✧", "Probabilistic model"],
  human_role: ["◎", "Human review"],
  event_source: ["ϟ", "Event source"],
  mixed_capability: ["◈", "Mixed / specify behavior"],
  group: ["⊞", "Group"],
};
export const META = [
  "description",
  "owner",
  "protocol",
  "operation",
  "input_contract",
  "output_contract",
  "transformation",
  "condition",
  "access",
  "permission",
  "policy",
  "enforcement",
  "failure",
  "timeout",
  "retry",
  "interface_version",
  "source_reference",
];
export const uid = (prefix) => `${prefix}-${crypto.randomUUID()}`;
export const clone = (x) => structuredClone(x);
export function semanticDiff(before, after) {
  const changes = [];
  const visit = (a, b, path) => {
    if (Object.is(a, b)) return;
    if (a === undefined) {
      changes.push(`Added ${path}`);
      return;
    }
    if (b === undefined) {
      changes.push(`Removed ${path}`);
      return;
    }
    if (a && b && typeof a === "object" && typeof b === "object") {
      if (
        Array.isArray(a) &&
        Array.isArray(b) &&
        [...a, ...b].every((x) => x && typeof x === "object" && x.id)
      ) {
        const aa = new Map(a.map((x) => [x.id, x])),
          bb = new Map(b.map((x) => [x.id, x]));
        for (const id of new Set([...aa.keys(), ...bb.keys()]))
          visit(aa.get(id), bb.get(id), `${path}[${id}]`);
        if (
          a.length === b.length &&
          a.map((x) => x.id).join("|") !== b.map((x) => x.id).join("|")
        )
          changes.push(`Order changed ${path}`);
      } else {
        for (const key of new Set([...Object.keys(a), ...Object.keys(b)]))
          visit(a[key], b[key], `${path}.${key}`);
      }
    } else
      changes.push(
        `Changed ${path}: ${String(a).slice(0, 100)} → ${String(b).slice(0, 100)}`,
      );
  };
  visit(before, after, "document");
  return changes;
}
export const claim = () => ({ intent: "proposed", implementation: "unknown" });
export function instance(star, x, y, label) {
  return {
    id: uid("I"),
    star,
    x,
    y,
    width: 164,
    height: 84,
    active: true,
    label: label || "",
    classification: "public",
    description: "",
    owner: "",
    claim: claim(),
  };
}
export function flow(source, target, condition = "") {
  return {
    id: uid("F"),
    source,
    target,
    kind: "data_flow",
    active: true,
    condition,
    classification: "public",
    claim: claim(),
  };
}
export function view(title, parent = null) {
  return {
    id: uid("V"),
    title,
    parent,
    area: { ...AREA },
    instances: [],
    flows: [],
    viewport: { zoom: 1 },
  };
}
export function createCase(
  catalog,
  title = "Untitled constellation",
  description = "Describe a system, one relationship at a time.",
) {
  const v = view("Architecture");
  return {
    id: uid("UC"),
    title,
    description,
    revision: 1,
    revisionId: uid("REV"),
    parentRevisionId: "",
    author: { kind: "unknown", principal: "unverified-local-author" },
    createdAt: new Date().toISOString(),
    changeSummary: "Created draft",
    catalogRevision: catalog.revision,
    root: v.id,
    views: [v],
    steps: [],
    status: "draft",
    reviews: [],
  };
}
export function seed() {
  const catalog = {
    id: "CC-CATALOG-001",
    revision: 1,
    stars: [
      {
        id: "S-INPUT",
        label: "Request input",
        type: "input",
        description: "A request or document entering a described system.",
      },
      {
        id: "S-RULES",
        label: "Decision rules",
        type: "deterministic_rules",
        description: "Explicit conditions and deterministic outcomes.",
      },
      {
        id: "S-ACTION",
        label: "Action service",
        type: "conventional_service",
        description: "Conventional software performing a documented operation.",
      },
      {
        id: "S-STORE",
        label: "Record store",
        type: "record_store",
        description: "A persistent information-storage role.",
      },
      {
        id: "S-HUMAN",
        label: "Human review",
        type: "human_role",
        description: "A person reviews, corrects, or approves.",
      },
      {
        id: "S-MODEL",
        label: "Probabilistic model",
        type: "probabilistic_model",
        description: "Model-generated suggestions require interpretation.",
      },
      {
        id: "S-EVENT",
        label: "Change event",
        type: "event_source",
        description: "A documented event or trigger.",
      },
      {
        id: "S-GROUP",
        label: "Decision & action",
        type: "group",
        members: ["S-RULES", "S-ACTION"],
        description:
          "A reusable group with deterministic rules and an action service.",
      },
    ].map((s) => ({
      ...s,
      classification: "public",
      owner: "",
      members: s.members || [],
    })),
  };
  const a = createCase(
    catalog,
    "Request triage",
    "From an incoming request to a documented decision.",
  );
  let v = a.views[0];
  v.instances = [
    instance("S-INPUT", 270, 235),
    instance("S-RULES", 530, 235),
    instance("S-ACTION", 790, 235),
    instance("S-HUMAN", 530, 470),
    instance("S-STORE", 790, 470),
  ];
  const [i, r, s, h, d] = v.instances;
  v.flows = [
    flow(i.id, r.id, "Request received"),
    flow(r.id, s.id, "Rules permit action"),
    flow(s.id, d.id, "Action completed"),
    flow(r.id, h.id, "Needs judgment"),
    flow(h.id, d.id, "Review complete"),
  ];
  v.flows[1].kind = "control_flow";
  v.flows[3].kind = "control_flow";
  v.flows[3].path = "exception";
  v.flows[2].operation = "Insert record";
  v.flows[2].failure = "Preserve the request and route to human review.";
  a.steps = [
    ...v.flows.slice(0, 3).map((f, n) => ({
      id: uid("STEP"),
      view: v.id,
      target: f.id,
      text: [
        "A request enters the documented system.",
        "Deterministic rules select the permitted action.",
        "The action result is recorded.",
      ][n],
    })),
    {
      id: uid("STEP"),
      view: v.id,
      target: v.flows[3].id,
      text: "When the rules cannot resolve a case, ask a human to review it.",
    },
  ];
  const b = createCase(
    catalog,
    "Document enrichment",
    "Conventional extraction, model suggestions, and human judgment.",
  );
  v = b.views[0];
  v.instances = [
    instance("S-INPUT", 265, 240, "Document input"),
    instance("S-ACTION", 525, 240, "Extract content"),
    instance("S-MODEL", 785, 240, "Suggest enrichment"),
    instance("S-HUMAN", 525, 460),
    instance("S-STORE", 785, 460, "Accepted record"),
  ];
  for (const [x, y] of [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
  ])
    v.flows.push(flow(v.instances[x].id, v.instances[y].id));
  b.steps = v.flows.map((f) => ({
    id: uid("STEP"),
    view: v.id,
    target: f.id,
    text: "This proposed relationship describes information moving between the selected roles.",
  }));
  const c = createCase(
    catalog,
    "Record reconciliation",
    "An event-driven path with no model required.",
  );
  v = c.views[0];
  v.instances = [
    instance("S-EVENT", 265, 240),
    instance("S-GROUP", 525, 240),
    instance("S-STORE", 785, 240, "Destination record"),
    instance("S-STORE", 785, 460, "Exception record"),
  ];
  v.flows = [
    flow(v.instances[0].id, v.instances[1].id, "Record changed"),
    flow(v.instances[1].id, v.instances[2].id, "Reconciled"),
    flow(v.instances[1].id, v.instances[3].id, "Unresolved"),
  ];
  v.flows[2].path = "exception";
  const detail = view("Decision & action", v.instances[1].id);
  detail.instances = [
    instance("S-RULES", 320, 300),
    instance("S-ACTION", 700, 300),
  ];
  detail.flows = [
    flow(detail.instances[0].id, detail.instances[1].id, "Match accepted"),
  ];
  c.views.push(detail);
  c.steps = [
    {
      id: uid("STEP"),
      view: v.id,
      target: v.instances[1].id,
      text: "Open the group to inspect its decision and action.",
    },
    {
      id: uid("STEP"),
      view: detail.id,
      target: detail.flows[0].id,
      text: "The deterministic decision permits an update.",
    },
    {
      id: uid("STEP"),
      view: v.id,
      target: v.flows[1].id,
      text: "Return to the parent architecture and follow the successful update.",
    },
  ];
  for (const example of [a, b, c]) example.author = { kind: "agent", principal: "bundled-example-unverified" };
  return {
    profile: PROFILE,
    catalog,
    catalogHistory: [],
    cases: [a, b, c],
    evidence: [],
    history: [],
    audit: [],
    imports: [],
  };
}
export function inside(i, a) {
  return (
    i.x >= a.x &&
    i.y >= a.y &&
    i.x + i.width <= a.x + a.width &&
    i.y + i.height <= a.y + a.height
  );
}
export function catalogFor(doc, c) {
  return c.catalogRevision === doc.catalog.revision
    ? doc.catalog
    : doc.catalogHistory.find((x) => x.revision === c.catalogRevision);
}
export function evidenceState(doc, c, subject, now = new Date()) {
  const records = doc.evidence.filter(
    (e) =>
      e.subject === subject &&
      e.caseId === c.id &&
      e.revision === c.revision &&
      e.assessment === "supported" &&
      e.source &&
      e.reviewed,
  );
  if (!records.length)
    return { assessment: "unverified", freshness: "unknown" };
  const due = records.filter((e) => e.due);
  return {
    assessment: "supported",
    freshness: !due.length
      ? "unknown"
      : due.some((e) => new Date(e.due + "T23:59:59") >= now)
        ? "within review period"
        : "stale",
  };
}
export function validate(doc, caseId) {
  const errors = [],
    warnings = [],
    ids = new Set();
  const add = (message, id) => errors.push({ message, id });
  const check = (id) => {
    if (typeof id !== "string" || !/^[A-Za-z][A-Za-z0-9._-]{0,127}$/.test(id))
      add("Missing or unsafe identity", id);
    else if (ids.has(id)) add("Duplicate identity", id);
    else ids.add(id);
  };
  if (doc.profile !== PROFILE) add("Unsupported profile", "document");
  for (const cat of [doc.catalog, ...(doc.catalogHistory || [])]) {
    const stars = new Map(cat.stars.map((s) => [s.id, s]));
    const local = new Set();
    for (const s of cat.stars) {
      if (
        typeof s.id !== "string" ||
        !/^[A-Za-z][A-Za-z0-9._-]{0,127}$/.test(s.id) ||
        local.has(s.id)
      )
        add("Duplicate, missing, or unsafe catalog identity", s.id);
      local.add(s.id);
      if (!TYPES[s.type]) add("Unknown component type", s.id);
      const walk = (id, path) => {
        if (path.length > 32) {
          add("Group depth exceeds 32 levels", s.id);
          return;
        }
        if (path.includes(id)) {
          add("Cyclic group membership", id);
          return;
        }
        const t = stars.get(id);
        if (!t) {
          add("Missing group member", id);
          return;
        }
        for (const m of t.members || []) walk(m, [...path, id]);
      };
      walk(s.id, []);
    }
  }
  for (const s of doc.catalog.stars) check(s.id);
  check(doc.catalog.id);
  for (const c of doc.cases) {
    check(c.id);
    const cat = catalogFor(doc, c);
    if (!cat) add("Pinned catalog revision is unavailable", c.id);
    if (c.catalogRevision !== doc.catalog.revision)
      warnings.push({
        message: "A newer catalog revision is available. Reconcile explicitly.",
        id: c.id,
      });
    const allInstances = c.views.flatMap((v) => v.instances);
    if (!c.views.some((v) => v.id === c.root && !v.parent))
      add("Missing root view", c.id);
    for (const v of c.views) {
      check(v.id);
      if (
        !v.area ||
        ![v.area.x, v.area.y, v.area.width, v.area.height].every(
          Number.isFinite,
        ) ||
        v.area.width <= 0 ||
        v.area.height <= 0
      ) {
        add("Invalid active-area bounds", v.id);
        continue;
      }
      if (v.parent) {
        const p = allInstances.find((i) => i.id === v.parent);
        const group = cat?.stars.find((s) => s.id === p?.star);
        if (!p || group?.type !== "group") add("Invalid parent group", v.id);
        for (const i of v.instances)
          if (!group?.members.includes(i.star))
            add("Appearance is not a declared group member", i.id);
        let current = v;
        const visited = new Set();
        while (current?.parent) {
          if (visited.has(current.id)) {
            add("Cyclic view ancestry", v.id);
            break;
          }
          visited.add(current.id);
          current = c.views.find((w) =>
            w.instances.some((i) => i.id === current.parent),
          );
        }
      }
      if (c.views.filter((w) => w.parent === v.parent && v.parent).length > 1)
        add("Multiple nested views for one appearance", v.id);
      for (const i of v.instances) {
        check(i.id);
        if ("source" in i || "target" in i)
          add("Appearance contains reserved connector fields", i.id);
        if (!cat?.stars.some((s) => s.id === i.star))
          add("Missing catalog star", i.id);
        if (
          ![i.x, i.y, i.width, i.height].every(Number.isFinite) ||
          i.width <= 0 ||
          i.height <= 0
        )
          add("Invalid appearance geometry", i.id);
        else if (i.active !== inside(i, v.area))
          add("Membership does not match active-area bounds", i.id);
      }
      for (const f of v.flows) {
        check(f.id);
        const source = v.instances.find((i) => i.id === f.source),
          target = v.instances.find((i) => i.id === f.target);
        if (!source || !target)
          add("Connector endpoint is missing from its view", f.id);
        else if (f.active && (!source.active || !target.active))
          add(
            "Active connector has an inactive endpoint; resolve explicitly",
            f.id,
          );
        if (!["data_flow", "control_flow", "dependency", "observation"].includes(f.kind))
          add("Unknown connector relationship", f.id);
        if (!f.owner)
          warnings.push({ message: "Connector owner is unknown", id: f.id });
      }
    }
    for (const st of c.steps) {
      check(st.id);
      const v = c.views.find((v) => v.id === st.view);
      if (!v || ![...v.instances, ...v.flows].some((x) => x.id === st.target))
        add("Walkthrough target is missing", st.id);
    }
  }
  for (const e of doc.evidence) check(e.id);
  if (caseId) {
    const c = doc.cases.find((c) => c.id === caseId);
    const own = new Set([
      c?.id,
      ...(c?.views || []).flatMap((v) => [
        v.id,
        ...v.instances.map((x) => x.id),
        ...v.flows.map((x) => x.id),
      ]),
      ...(c?.steps || []).map((s) => s.id),
      ...doc.catalog.stars.map((s) => s.id),
      doc.catalog.id,
      "document",
    ]);
    return {
      errors: errors.filter((e) => own.has(e.id) || !e.id),
      warnings: warnings.filter((e) => own.has(e.id)),
    };
  }
  return { errors, warnings };
}
export function editCase(doc, id, description, fn) {
  const c = doc.cases.find((c) => c.id === id);
  doc.history.push({
    id: uid("H"),
    at: new Date().toISOString(),
    description,
    case: clone(c),
  });
  const parentRevisionId = c.revisionId || "";
  fn(c);
  c.revisionId = uid("REV");
  c.parentRevisionId = parentRevisionId;
  c.author = { kind: "unknown", principal: "unverified-local-author" };
  c.createdAt = new Date().toISOString();
  c.changeSummary = description;
  delete c.contentDigest;
  delete c.finalization;
  c.revision++;
  c.status = "draft";
  doc.audit.push({
    at: new Date().toISOString(),
    action: description,
    caseId: id,
    revision: c.revision,
  });
  return c;
}
export function renameCatalog(doc, id, label) {
  doc.catalogHistory.push(clone(doc.catalog));
  doc.catalog.revision++;
  doc.catalog.stars.find((s) => s.id === id).label = label;
  doc.audit.push({
    at: new Date().toISOString(),
    action: "Catalog renamed",
    revision: doc.catalog.revision,
  });
}
export function redact(doc, caseId) {
  const out = clone(doc);
  out.cases = out.cases.filter((c) => c.id === caseId);
  out.history = [];
  out.audit = [];
  out.imports = [];
  out.evidence = [];
  const c = out.cases[0];
  const cat = clone(catalogFor(doc, c));
  if (!cat) throw Error("Catalog revision unavailable");
  out.catalog = cat;
  out.catalogHistory = [];
  const allowed = new Set(
    cat.stars.filter((s) => s.classification !== "restricted").map((s) => s.id),
  );
  let removed = true;
  while (removed) {
    removed = false;
    for (const s of cat.stars)
      if (
        allowed.has(s.id) &&
        (s.members || []).some((id) => !allowed.has(id))
      ) {
        allowed.delete(s.id);
        removed = true;
      }
  }
  cat.stars = cat.stars.filter((s) => allowed.has(s.id));
  for (const v of c.views) {
    v.instances = v.instances.filter(
      (i) => i.classification !== "restricted" && allowed.has(i.star),
    );
    const ids = new Set(v.instances.map((i) => i.id));
    v.flows = v.flows.filter(
      (f) =>
        f.classification !== "restricted" &&
        ids.has(f.source) &&
        ids.has(f.target),
    );
  }
  let viewsChanged = true;
  while (viewsChanged) {
    const before = c.views.length;
    const instances = new Set(
      c.views.flatMap((v) => v.instances.map((i) => i.id)),
    );
    c.views = c.views.filter((v) => !v.parent || instances.has(v.parent));
    viewsChanged = before !== c.views.length;
  }
  // Shared free text may quote excluded content: public exports intentionally omit it.
  const retain = (obj, keys) => {
    for (const key of Object.keys(obj))
      if (!keys.includes(key)) delete obj[key];
  };
  for (const s of cat.stars)
    retain(s, ["id", "label", "type", "members", "classification"]);
  for (const v of c.views) {
    delete v.extra;
    v.title = "Architecture";
    for (const x of v.instances) {
      retain(x, [
        "id",
        "star",
        "active",
        "x",
        "y",
        "width",
        "height",
        "classification",
      ]);
      x.claim = claim();
    }
    for (const x of v.flows) {
      retain(x, ["id", "source", "target", "kind", "active", "classification"]);
      x.claim = claim();
    }
    retain(v, [
      "id",
      "title",
      "parent",
      "instances",
      "flows",
      "area",
      "viewport",
    ]);
  }
  c.steps = [];
  c.reviews = [];
  c.title = "Shared constellation";
  c.description =
    "Public structural view. Descriptions, evidence, and walkthroughs omitted.";
  c.status = "draft";
  retain(c, [
    "id",
    "title",
    "description",
    "revision",
    "catalogRevision",
    "root",
    "views",
    "steps",
    "reviews",
    "status",
  ]);
  return out;
}
export function saveDocument(storage, doc) {
  const serialized = JSON.stringify(doc);
  const previous = storage.getItem("cc.current");
  if (previous) storage.setItem("cc.previous", previous);
  storage.setItem("cc.current", serialized);
}
export function recoverDocument(storage) {
  const previous = storage.getItem("cc.previous");
  if (!previous) throw Error("No previous save is available.");
  const value = JSON.parse(previous);
  if (value.profile !== PROFILE)
    throw Error("Previous save has an unsupported profile.");
  return value;
}

// Local claims never supply authenticated identity or release authority.
export function versionLabel(c) {
  const suffix = c.author?.kind === "agent" ? "AI" : c.author?.kind === "human" ? "HUM" : "UNKNOWN";
  return `1.${c.revision}.${suffix}`;
}
export function initializeGovernance(doc) {
  for (const c of doc.cases) {
    c.revisionId ||= uid("REV");
    c.parentRevisionId ||= "";
    c.author ||= { kind: "unknown", principal: "legacy-unverified" };
    if (["approved", "final", "finalized"].includes(c.status)) c.status = "review_recorded";
  }
  return doc;
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.keys(value).sort().map(k => [k, canonical(value[k])])
  );
  return value;
}
export async function revisionDigest(doc, c) {
  const content = clone(c);
  for (const key of ["reviews", "status", "contentDigest", "finalization"]) delete content[key];
  for (const v of content.views) delete v.viewport;
  const bytes = new TextEncoder().encode(JSON.stringify(canonical({
    content, catalog: catalogFor(doc, c),
    evidence: doc.evidence.filter(e => e.caseId === c.id && e.revision === c.revision),
  })));
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2, "0")).join("");
}
export function finalizationEligibility() {
  return { eligible: false, reason: "Finalization blocked: this local workspace has no trusted identity provider or authoritative approval service. Local names, imported claims, and AI/HUM suffixes cannot verify human authority." };
}
export function finalizeRevision() {
  throw Error(finalizationEligibility().reason);
}
export async function recordLocalReview(doc, id, target, reviewer, decision, notes = "") {
  const c = doc.cases.find(c => c.id === id);
  const digest = await revisionDigest(doc, c);
  if (c.revisionId !== target.revisionId || digest !== target.digest) throw Error("Revision changed. Reopen review for the current revision.");
  if (!reviewer.trim()) throw Error("Enter a reviewer name (unverified local claim).");
  if (!["approve", "reject", "return_changes", "withdraw", "request_review"].includes(decision)) throw Error("Unsupported review decision.");
  if (decision === "approve" && validate(doc).errors.length) throw Error("Resolve blocking validation issues before recording approval.");
  const event = { id: uid("REVIEW"), caseId: id, revision: c.revision,
    revisionId: c.revisionId, contentDigest: digest, reviewer, decision, notes,
    verification: "unverified-local-claim", at: new Date().toISOString() };
  c.reviews.push(event);
  c.status = decision === "request_review" ? "review_requested" : "review_recorded";
  doc.audit.push({ ...event, action: "Local review recorded" });
  return event;
}

export function boardSize(doc, c, v) {
  return { width: Math.max(1100, v.area.x + v.area.width + 40),
    height: Math.max(760, v.area.y + v.area.height + 70, (catalogFor(doc,c)?.stars.length || 0) * 68 + 150) };
}

const plan = 'https://docs.google.com/document/d/10AGT47n48DC1PLGDW2IGxfeL4SojNmrBND56ydUB-ys/edit';
const source = 'User-supplied candidate master image v0.1; Work Specification (agent governance), sections 1–9';
// Descriptions are an agent synthesis, not implementation evidence.
const definitions = [
 ['HUM','Human','human_role','Goals • review • approval','Sets intent, inspects evidence, approves a specific diagram revision and grants operational authority through the real executing system.','Human judgment; authorship, approval and finalization are separate facts.','Review proposal and return an attributable decision','Goal / review package','Decision / limitations','Do not infer consent from silence; return unresolved decisions to the person.'],
 ['GOV','Governance','conventional_service','Policies • rights • constraints','Describes applicable policies, rights, constraints and authority boundaries. A policy reference is a requirement or claim, not enforcement.','Conventional policy evaluation; actual enforcement belongs to the named backend.','Evaluate documented constraints','Policy references / requested capability','Permit, deny or review requirement','Unknown authority blocks the proposed action pending clarification.'],
 ['ACD','ACDS','conventional_service','Policy-governed model dispatch','Shared cognition utility mediating explicitly designed model inference. Consumer runtimes retain business rules and canonical truth; local adapters must not redefine the shared contract.','Deterministic dispatch/control around probabilistic inference; not itself a language model.','Select an allowed model route and return dispatch provenance','Scoped inference request / policy / context references','Model response / route and audit metadata','Document provider failure, incompatible contracts and bounded fallback; never silently bypass policy.'],
 ['ORC','Workflow / orchestration','conventional_service','State • sequence • retries','Coordinates explicit state transitions, sequence and recovery. Orchestration does not own another runtime’s canonical truth or grant execution authority.','Conventional state machine; model calls, if any, are separate components.','Advance a documented workflow state','Event / prior state / transition conditions','Next state / task / failure outcome','Bound retries; document timeout, compensation and an inspectable exception route.'],
 ['VER','Verification','conventional_service','Checks • tests • validation','Checks structural references, contracts and claims against explicit evidence. Documentation review and structural validity do not prove observed execution.','Deterministic checks where defined; human assessment where required.','Validate a revision or result against declared criteria','Artifact / criteria / evidence references','Findings / pass-fail / limitations','Preserve failure details; do not promote unsupported claims to verified status.'],
 ['INP','Inputs / devices','group','Text • camera • audio • events','Groups permitted intake modalities. A diagram reference to a device does not collect a feed or grant access. Preserve original input and provenance.','Mixed sources: text, camera, audio and event inputs; concrete members remain use-case-specific.','Capture an explicitly supplied artifact or event','Authorized source / media / intake context','Preserved input / source hash / timestamp','Reject unsupported or unsafe input without executing embedded content.'],
 ['PER','Perception / extraction','mixed_capability','Vision • speech • OCR • classify','Extracts structured observations from supplied media. Distinguish deterministic parsing from probabilistic OCR, speech, vision or classification.','Implementation-dependent; disclose deterministic and probabilistic constituent steps.','Extract observations with source anchors','Input artifact / extraction profile','Extracted text, features or labels / uncertainty','Retain source; route low-confidence or failed extraction for review.'],
 ['LLM','Language models','probabilistic_model','Interpret • generate • explain','Produces interpretations, drafts and explanations from bounded context. Output is a proposal requiring interpretation, never permission or authoritative evidence by itself.','Probabilistic generation; route through ACDS where the designed architecture calls for it.','Generate a bounded response','Prompt / scoped context / output contract','Candidate response / model and run references','Handle unsupported claims, malformed output and unavailable models explicitly.'],
 ['DEC','Decision models / rules','mixed_capability','Evaluate conditions • select action','Evaluates conditions and proposes an action. Label whether the chosen implementation is explicit deterministic rules, a statistical decision model or a human-reviewed combination.','Unresolved at master level; a decision tree is not automatically a rules engine.','Evaluate documented decision criteria','Facts / rule or model version / decision context','Decision / rationale / escalation condition','Unresolved conditions route to human review; no automatic authority from a score.'],
 ['ACT','Action / execution','conventional_service','Tools • APIs • permitted writes','Represents external services that execute authorized work. The constellation only documents the operation; it never invokes tools or writes records.','Conventional software with backend permission enforcement.','Perform the explicitly authorized operation','Validated command / contract / permission reference','Result / receipt / failure record','Document idempotency, timeout, retry and compensation before enabling real execution.'],
 ['SRC','Source systems','group','Documents • databases • sensors','Groups authoritative source systems and supplied documents. Ownership and canonical truth stay with each source; a URL is not permission to retrieve it.','Mixed sources; databases and sensors are not implicitly AI.','Expose an authorized document, record or event','Source identifier / authorized query or submission','Source artifact / version / provenance','Retain unavailable references as unchecked; do not invent missing contents.'],
 ['RET','Retrieval / matching','mixed_capability','Search • rank • resolve entities','Finds candidate evidence or entity matches within an explicitly allowed scope. Preserve source, version and ambiguity; retrieval does not establish truth.','Deterministic lookup or probabilistic ranking/matching; specify implementation per use case.','Find and rank candidate matches','Query / allowed corpus / matching criteria','Candidates / source anchors / scores','Return no-match and ambiguous-match states for explicit resolution.'],
 ['DBM','DBMS / storage','record_store','Persist • query • version records','Stores and queries records under the owning system’s authority. Preserve revisions and recovery; shared staging must not silently become canonical storage.','Conventional deterministic persistence; not a model.','Read, insert or version an identified record','Schema reference / query or write / access reference','Record / version / transaction outcome','Preserve last accepted state on failure; document transaction and recovery semantics.'],
 ['ANA','Analysis / planning','mixed_capability','Trends • anomalies • predict • optimize','Builds analyses and candidate plans from bounded evidence. Separate descriptive statistics, deterministic optimization and probabilistic prediction.','Mixed or implementation-dependent; a plan does not authorize its own execution.','Analyze evidence and propose a plan','Evidence set / objective / constraints','Findings / candidate plan / assumptions','Expose uncertainty, unsupported assumptions and infeasible constraints.'],
 ['OUT','Output / delivery','conventional_service','Reports • screens • speech • alerts','Presents results for the intended audience. Preserve provenance and limitations; physically remove excluded metadata in shared exports.','Conventional delivery; generated content remains attributable to its source.','Render or deliver an approved representation','Result artifact / audience / disclosure rules','Report / screen / audio or notification artifact','Report delivery failure honestly; a download request is not proof of completion.'],
 ['CTX','Context management','conventional_service','Stage • provenance • retention','Assembles scoped context with source provenance, version and retention. Staging and exchange remain distinct from canonical records and execution authority.','Conventional state and artifact management; no implicit global memory authority.','Stage and select a bounded context package','Source artifacts / scope / retention constraints','Versioned context package / provenance manifest','Quarantine incompatible artifacts; preserve provenance and expire stale context explicitly.'],
 ['AUD','Audit / observation','conventional_service','Trace • cost • quality • outcomes','Records attributable events and evidence of outcomes. Separate intended behavior, implementation claims and observed execution; editable local logs are not tamper-proof.','Conventional observation; metric collection requires a real explicit integration.','Record an event with subject, revision and evidence reference','Trace / result / actor and timestamp / measurement scope','Observation record / quality and cost findings','Flag missing or stale evidence; never infer success from an absent event.'],
];
export function masterSeed() {
 const d = seed(); d.catalog.stars = definitions.map(([code,label,type,summary,description,behavior,operation,input_contract,output_contract,failure]) => ({
 id:`CC-${code}`,code,label,type,summary,description,behavior,operation,input_contract,output_contract,failure,
 category: code==='HUM' ? 'actor' : ['INP','SRC'].includes(code) ? 'group' : ['ACD','DBM'].includes(code) ? 'system' : ['VER','PER','LLM','DEC','RET','ANA'].includes(code) ? 'capability' : 'service',
 owner:'Unknown — assign accountable owner for the use case', classification:'public',members:[],
 protocol:'Unknown — documentation only', permission:'Unknown — explicit backend authorization required',
 enforcement:'External executing service; specific enforcement point not yet identified',
 policy:'Work Specification: governance invariants and human review gate',
 source_reference:source + (['ACD','ORC','DBM','CTX'].includes(code) ? '; ACDS Unification Plan: '+plan : ''),
 provenance:'Agent-extrapolated from user image and supplied specification; not verified implementation evidence.',
 }));
 d.cases=[]; d.history=[]; d.audit=[]; d.evidence=[];
 const c=createCase(d.catalog,'Candidate master · 17 stars','Your computational vocabulary: intentional geography, plausible paths, and explicit authority boundaries. Agent-extrapolated metadata; all relationships proposed.');
 c.id='CC-MASTER-17'; c.author={kind:'agent',principal:'codex-draft'};
 const v=c.views[0]; v.title='Candidate master'; v.area={x:235,y:120,width:1515,height:1200};
 const positions=[[0,0],[1,0],[2,0],[3,0],[4,0],[0,1],[1,1],[2,1],[3,1],[4,1],[0,2],[1,2],[2,2],[3,2],[4,2],[2,3],[4,3]];
 v.instances=d.catalog.stars.map((s,n)=>({...instance(s.id,270+positions[n][0]*295,220+positions[n][1]*305),...Object.fromEntries(['description','owner','operation','input_contract','output_contract','failure','policy','permission','enforcement','protocol','source_reference','provenance','behavior'].map(k=>[k,s[k]])),width:255}));
 const links=[['HUM','GOV','control_flow','Goals and authority'],['GOV','ACD','control_flow','Policy-constrained dispatch'],['ACD','ORC','control_flow','Dispatch coordination'],['ORC','VER','control_flow','Validation gate'],['VER','ACT','control_flow','Checks pass; authority still required'],['ORC','DEC','control_flow','Evaluate transition'],['ACD','PER','control_flow','Optional extraction route'],['ACD','LLM','control_flow','Allowed inference route'],['HUM','INP','data_flow','Submit input'],['SRC','INP','data_flow','Authorized intake'],['INP','PER','data_flow','Extract observations'],['PER','LLM','data_flow','Interpret extracted content'],['PER','DEC','data_flow','Deterministic bypass'],['LLM','DEC','data_flow','Candidate interpretation'],['DEC','ACT','control_flow','Decision permits action'],['SRC','RET','data_flow','Bounded source query'],['RET','LLM','data_flow','Retrieved context'],['RET','DBM','data_flow','Matched records'],['ACT','DBM','data_flow','Persist authorized result'],['DBM','ANA','data_flow','Read analysis inputs'],['ANA','DEC','data_flow','Proposed plan'],['ACT','OUT','data_flow','Result for delivery'],['ANA','OUT','data_flow','Findings'],['DBM','CTX','data_flow','Versioned context'],['CTX','DBM','data_flow','Context provenance'],['CTX','LLM','data_flow','Scoped context package'],['OUT','HUM','data_flow','Review delivered result'],['ACD','AUD','observation','Dispatch trace'],['DBM','AUD','observation','Persistence observation'],['ACT','AUD','observation','Execution outcome'],['OUT','AUD','observation','Delivery observation']];
 const byCode=code=>v.instances.find(i=>i.star===`CC-${code}`);
 v.flows=links.map(([a,b,kind,condition])=>({...flow(byCode(a).id,byCode(b).id,condition),kind,description:`Proposed ${a} → ${b} relationship, extrapolated from the candidate master. ${condition}. No integration is executed.`, operation:condition,input_contract:`${a} output contract — schema reference unknown`,output_contract:`${b} input contract — schema reference unknown`,owner:'Unknown',protocol:'Unknown',permission:'Unknown — independently enforced by the executing service',enforcement:'Target service; specific implementation unknown',failure:'Proposed: preserve input and failure details; return unresolved outcomes to human review.',retry:'Unknown — bounded retry and idempotency must be specified',source_reference:source,provenance:'Agent-extrapolated connector; proposed and unverified.'}));
 c.steps=['INP','PER','LLM','DEC','ACT','DBM','OUT','HUM'].map(code=>({id:`STEP-MASTER-${code}`,view:v.id,target:byCode(code).id,text:d.catalog.stars.find(s=>s.code===code).description}));
 d.cases.push(c);
 for(const [id,title,codes,route] of [
 ['RULES','Rules-led triage',['HUM','GOV','INP','PER','DEC','ACT','DBM','OUT','AUD'],['INP','PER','DEC','ACT','DBM','OUT','HUM']],
 ['CONTEXT','Governed model explanation',['HUM','GOV','ACD','SRC','RET','CTX','LLM','VER','OUT','AUD'],['SRC','RET','CTX','ACD','LLM','VER','OUT','HUM']]
 ]) {
 const x=createCase(d.catalog,title,'A proposed walkthrough using the master vocabulary. Selected components retain their master positions; other stars remain available in the catalog.');
 x.id=`CC-EXAMPLE-${id}`; x.author={kind:'agent',principal:'codex-draft'};
 const w=x.views[0]; w.area=clone(v.area); w.title=title;
 w.instances=v.instances.map(i=>({...clone(i),id:`${id}-${i.star}`,active:codes.includes(i.star.slice(3))}));
 w.flows=v.flows.map((f,n)=>{const a=v.instances.find(i=>i.id===f.source).star,b=v.instances.find(i=>i.id===f.target).star;return {...clone(f),id:`F-${id}-${n}`,source:`${id}-${a}`,target:`${id}-${b}`,active:codes.includes(a.slice(3))&&codes.includes(b.slice(3))};});
 w.instances=w.instances.filter(i=>i.active);
 w.flows=w.flows.filter(f=>f.active);
 x.steps=route.map((code,n)=>({id:`STEP-${id}-${n}`,view:w.id,target:`${id}-CC-${code}`,text:code==='DEC'&&id==='RULES'?'This example specifies explicit deterministic rules. Unresolved cases require human review.':d.catalog.stars.find(s=>s.code===code).description}));
 if(id==='RULES') w.instances.find(i=>i.star==='CC-DEC').behavior='Deterministic rules for this example; no LLM required.';
 d.cases.push(x);
 }
 return d;
}
