import test from "node:test";
import assert from "node:assert/strict";
import {
  semanticDiff,
  seed,
  clone,
  instance,
  flow,
  validate,
  editCase,
  renameCatalog,
  redact,
  evidenceState,
  saveDocument,
  recoverDocument,
} from "../src/model.js";

test("semantic comparison reports catalog, walkthrough and evidence changes", () => {
  const before = seed(),
    after = clone(before);
  after.catalog.stars[0].label = "Different label";
  after.cases[0].steps.reverse();
  after.evidence.push({
    id: "E-NEW",
    subject: after.cases[0].views[0].instances[0].id,
  });
  const diff = semanticDiff(before, after).join("\n");
  assert.match(diff, /catalog.*label/);
  assert.match(diff, /Order changed.*steps/);
  assert.match(diff, /Added.*evidence/);
});
import { toDrawio, toSVG, routeText } from "../src/io.js";
test("three synthetic cases and nested example have valid structural references", () =>
  assert.deepEqual(validate(seed()).errors, []));
test("repeat appearances retain shared catalog identity but distinct placement and endpoints", () => {
  const d = seed(),
    v = d.cases[0].views[0],
    old = clone(v.instances[0]),
    n = instance(old.star, 300, 360);
  v.instances.push(n);
  assert.notEqual(old.id, n.id);
  assert.equal(old.star, n.star);
  assert.equal(v.instances[0].x, old.x);
  assert.deepEqual(validate(d).errors, []);
});
test("edits are isolated and preserve approved historical revision", () => {
  const d = seed(),
    other = clone(d.cases[1]);
  d.cases[0].status = "approved";
  const original = clone(d.cases[0]);
  editCase(d, original.id, "move", (c) => (c.views[0].instances[0].x += 10));
  assert.deepEqual(d.cases[1], other);
  assert.equal(d.cases[0].status, "draft");
  assert.deepEqual(d.history[0].case, original);
});
test("catalog rename preserves identity and pins previous catalog", () => {
  const d = seed(),
    id = d.catalog.stars[0].id;
  renameCatalog(d, id, "Renamed");
  assert.equal(d.catalog.stars[0].id, id);
  assert.equal(d.cases[0].catalogRevision, 1);
  assert.equal(d.catalog.revision, 2);
  assert.deepEqual(validate(d).errors, []);
  assert.ok(
    validate(d).warnings.some((w) => w.message.includes("newer catalog")),
  );
});
test("moving outside keeps connectors and blocks approval until resolution", () => {
  const d = seed(),
    v = d.cases[0].views[0],
    count = v.flows.length;
  v.instances[0].x = 25;
  v.instances[0].active = false;
  assert.equal(v.flows.length, count);
  assert.ok(
    validate(d).errors.some((e) => e.message.includes("inactive endpoint")),
  );
  v.flows[0].active = false;
  assert.deepEqual(validate(d).errors, []);
});
test("duplicate IDs, missing endpoints and group cycles are rejected", () => {
  const d = seed(),
    v = d.cases[0].views[0];
  v.instances[1].id = v.instances[0].id;
  v.flows[0].target = "missing";
  d.catalog.stars.at(-1).members.push("S-GROUP");
  const r = validate(d);
  for (const term of ["Duplicate identity", "endpoint", "Cyclic group"])
    assert.ok(
      r.errors.some((e) => e.message.includes(term)),
      term,
    );
});
test("evidence freshness and approval are independent and revision-specific", () => {
  const d = seed(),
    c = d.cases[0],
    subject = c.views[0].flows[0].id;
  c.status = "approved";
  assert.equal(evidenceState(d, c, subject).assessment, "unverified");
  d.evidence.push({
    id: "E",
    subject,
    caseId: c.id,
    revision: c.revision,
    assessment: "supported",
    source: "https://example.org/evidence",
    reviewed: "2026-01-01",
    due: "2026-02-01",
  });
  assert.equal(
    evidenceState(d, c, subject, new Date("2026-03-01")).freshness,
    "stale",
  );
  c.revision++;
  assert.equal(evidenceState(d, c, subject).assessment, "unverified");
});
test("public redaction removes restricted entities and copied free text from all formats", () => {
  const d = seed(),
    c = d.cases[0],
    v = c.views[0];
  v.instances[0].classification = "restricted";
  v.instances[0].label = "SECRET-ALPHA";
  v.instances[1].description = "SECRET-ALPHA";
  v.instances[1].unexpected_private_note = "SECRET-ALPHA";
  c.title = "SECRET-ALPHA";
  c.steps[0].text = "SECRET-ALPHA";
  d.audit.push({ message: "SECRET-ALPHA" });
  const out = redact(d, c.id);
  assert.deepEqual(validate(out).errors, []);
  for (const text of [
    JSON.stringify(out),
    toDrawio(out),
    toSVG(out, out.cases[0], out.cases[0].views[0]),
    routeText(out, out.cases[0]),
  ])
    assert.ok(!text.includes("SECRET-ALPHA"));
  assert.equal(d.cases[0].title, "SECRET-ALPHA");
});
test("failed save preserves previous accepted content", () => {
  const memory = new Map(),
    storage = {
      getItem: (k) => memory.get(k) || null,
      setItem: (k, v) => memory.set(k, v),
    },
    d = seed();
  saveDocument(storage, d);
  const prior = storage.getItem("cc.current");
  const failing = {
    ...storage,
    setItem: (k, v) => {
      if (k === "cc.current") throw Error("quota");
      storage.setItem(k, v);
    },
  };
  d.cases[0].title = "Changed";
  assert.throws(() => saveDocument(failing, d));
  assert.equal(storage.getItem("cc.current"), prior);
  assert.equal(JSON.stringify(recoverDocument(storage)), prior);
});
test("SVG escapes markup, contains no executable source, and text retains route conditions", () => {
  const d = seed(),
    c = d.cases[0];
  c.views[0].instances[0].label = "<script>alert(1)</script>";
  const svg = toSVG(d, c, c.views[0]);
  assert.ok(!svg.includes("<script>"));
  assert.ok(!svg.includes("<mxfile"));
  assert.ok(routeText(d, c).includes("Rules permit action"));
});

import { initializeGovernance, versionLabel, revisionDigest, recordLocalReview, finalizeRevision } from '../src/model.js';
test('lineage is independent of numbering and restored content', () => {
  const d = seed(), c = d.cases[0], original = clone(c);
  editCase(d, c.id, 'Rename', x => x.title = 'Updated');
  assert.equal(c.parentRevisionId, original.revisionId);
  assert.notEqual(c.revisionId, original.revisionId);
  assert.deepEqual(d.history[0].case, original);
  const parent = c.revisionId;
  editCase(d, c.id, 'Restore', x => Object.assign(x, original));
  assert.equal(c.parentRevisionId, parent);
  assert.notEqual(c.revisionId, original.revisionId);
});
test('review binds exact content and approval never relabels AI authorship', async () => {
  const d = seed(), c = d.cases[0];
  c.author = {kind:'agent', principal:'example-agent'};
  const target = {revisionId:c.revisionId, digest:await revisionDigest(d,c)};
  await recordLocalReview(d,c.id,target,'Reviewer','approve');
  assert.match(versionLabel(c), /\.AI$/);
  assert.equal(c.reviews[0].contentDigest,target.digest);
  assert.equal(c.reviews[0].verification,'unverified-local-claim');
  assert.equal(await revisionDigest(d,c),target.digest);
  c.views[0].instances[0].x++;
  await assert.rejects(recordLocalReview(d,c.id,target,'Reviewer','approve'), /Revision changed/);
  assert.equal(c.reviews.length,1);
});
test('digest includes pinned dependencies and evidence, excludes view preferences', async () => {
  const d = seed(), c = d.cases[0], digest = await revisionDigest(d,c);
  c.views[0].viewport.zoom = 2;
  assert.equal(await revisionDigest(d,c), digest);
  d.catalog.stars[0].label = 'Changed dependency';
  assert.notEqual(await revisionDigest(d,c), digest);
});
test('all local finalization attempts fail closed regardless of forged claims', () => {
  for (const kind of ['agent','human','unknown']) {
    const d = seed(), c = d.cases[0];
    c.author = {kind, verified:true}; c.status='approved'; c.versionLabel='1.11.HUM';
    c.reviews.push({decision:'approve',verified:true});
    const before = clone(d);
    assert.throws(() => finalizeRevision(d,c.id,{kind:'human',authorized:true}), /trusted identity/);
    assert.deepEqual(d,before);
  }
});
test('legacy migration retains identity, edits do not inherit release claims', () => {
  const d = seed(), c = d.cases[0]; delete c.revisionId; delete c.author;
  initializeGovernance(d); const id = c.revisionId;
  initializeGovernance(d); assert.equal(c.revisionId,id);
  c.finalization = {actor:'forged'}; c.contentDigest = 'stale';
  editCase(d,c.id,'Edit',x => x.description = 'New content');
  assert.equal(c.status,'draft'); assert.equal(c.finalization,undefined);
  assert.equal(c.contentDigest,undefined); assert.equal(c.author.kind,'unknown');
});

import { masterSeed, boardSize } from '../src/model.js';
test('reference master retains all 17 distinct stars and proposed metadata', () => {
 const d=masterSeed(), c=d.cases[0], v=c.views[0];
 assert.equal(d.catalog.stars.length,17);
 assert.equal(v.instances.length,17);
 assert.deepEqual(validate(d).errors,[]);
 for(const s of d.catalog.stars) { assert.ok(s.description && s.behavior && s.source_reference && s.provenance); }
 assert.ok(v.flows.some(f=>f.kind==='observation'));
 assert.ok(v.flows.every(f=>f.claim.intent==='proposed' && f.claim.implementation==='unknown'));
 const size=boardSize(d,c,v);
 assert.ok(v.instances.every(i=>i.x+i.width<size.width && i.y+i.height<size.height));
 assert.ok(!d.cases[1].views[0].instances.some(i=>i.star==='CC-LLM'));
 const other=clone(d.cases[0]); editCase(d,d.cases[1].id,'Move',x=>x.views[0].instances[0].x++);
 assert.deepEqual(d.cases[0],other);
 const svg=toSVG(d,c,v); assert.ok(svg.includes(`viewBox="0 0 ${size.width} ${size.height}"`));
});
