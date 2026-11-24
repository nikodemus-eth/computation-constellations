import { masterSeed, seed, validate, redact, renameCatalog } from "../src/model.js";
import { toDrawio, fromDrawio } from "../src/io.js";
const lines = [];
const assert = (value, message) => {
  if (!value) throw Error(message);
};
function check(name, fn) {
  try {
    fn();
    lines.push("PASS " + name);
  } catch (e) {
    lines.push("FAIL " + name + " — " + e.message);
  }
}
check("17-star master round trip preserves metadata and observation connectors", () => {
 const a=masterSeed(), b=fromDrawio(toDrawio(a));
 assert(b.catalog.stars.length===17, "17 stars");
 assert(b.catalog.stars.find(s=>s.id==='CC-ACD').behavior===a.catalog.stars.find(s=>s.id==='CC-ACD').behavior, "behavior provenance");
 assert(b.cases[0].views[0].flows.filter(f=>f.kind==='observation').length===4, "observation paths");
 assert(b.cases[0].views[0].area.width===1515, "expanded area");
 assert(validate(b).errors.length===0, "valid imported master");
});
check("Full seed XML round trip", () => {
  const a = seed(),
    b = fromDrawio(toDrawio(a));
  assert(b.cases.length === 3, "case count");
  assert(b.cases[2].views.length === 2, "nested views");
  assert(validate(b).errors.length === 0, "validation");
  for (let n = 0; n < a.cases.length; n++) {
    const x = a.cases[n],
      y = b.cases[n];
    assert(x.id === y.id, "case identity");
    assert(x.steps.length === y.steps.length, "steps");
    for (let j = 0; j < x.views.length; j++) {
      const p = x.views[j],
        q = y.views[j];
      assert(p.instances.length === q.instances.length, "appearances");
      assert(p.flows.length === q.flows.length, "connectors");
      for (let k = 0; k < p.instances.length; k++)
        assert(
          p.instances[k].id === q.instances[k].id &&
            p.instances[k].x === q.instances[k].x,
          "identity and position",
        );
    }
  }
});
check("Pinned historical catalogs round trip", () => {
  const a = seed();
  renameCatalog(a, "S-INPUT", "Renamed input");
  const b = fromDrawio(toDrawio(a));
  assert(b.catalogHistory.length === 1, "history");
  assert(b.cases[0].catalogRevision === 1, "pin");
  assert(validate(b).errors.length === 0, "valid");
});
check("Unknown safe scalar metadata survives", () => {
  const a = seed();
  a.cases[0].views[0].instances[0].custom_note = "retained";
  const b = fromDrawio(toDrawio(a));
  assert(
    b.cases[0].views[0].instances[0].custom_note === "retained",
    "unknown metadata",
  );
});
check("Public redacted file round trips without excluded content", () => {
  const a = seed(),
    c = a.cases[0];
  c.views[0].instances[0].classification = "restricted";
  c.views[0].instances[0].label = "SENSITIVE";
  c.views[0].flows[1].description = "SENSITIVE";
  const b = redact(a, c.id),
    xml = toDrawio(b);
  assert(!xml.includes("SENSITIVE"), "redaction");
  assert(validate(fromDrawio(xml)).errors.length === 0, "redacted validity");
});
const malicious = [
  [
    "unprofiled shape",
    () =>
      toDrawio(seed()).replace(
        '<mxCell id="1" parent="0"/>',
        '<mxCell id="1" parent="0"/><mxCell id="rogue" vertex="1" value="untracked" parent="1"/>',
      ),
  ],
  [
    "unsafe semantic identity",
    () => toDrawio(seed()).replace(/cc_id="I-[^"]+"/, 'cc_id="&lt;img&gt;"'),
  ],
  [
    "external entity",
    '<!DOCTYPE mxfile [<!ENTITY x SYSTEM "file:///etc/passwd">]><mxfile/>',
  ],
  ["script", "<mxfile><script>alert(1)</script></mxfile>"],
  [
    "active link",
    () =>
      toDrawio(seed()).replace(
        'cc_kind="star"',
        'cc_kind="star" link="https://example.org"',
      ),
  ],
  [
    "prototype metadata",
    () =>
      toDrawio(seed()).replace(
        'cc_kind="star"',
        'cc_kind="star" cc___proto____polluted="yes"',
      ),
  ],
  ["compressed page", "<mxfile><diagram>compressed</diagram></mxfile>"],
  ["oversized file", "x".repeat(2097153)],
  [
    "endpoint mismatch",
    () =>
      toDrawio(seed()).replace(
        /cc_source_instance_id="[^"]+"/,
        'cc_source_instance_id="missing"',
      ),
  ],
];
for (const [name, input] of malicious)
  check("Reject " + name, () => {
    let rejected = false;
    try {
      fromDrawio(typeof input === "function" ? input() : input);
    } catch {
      rejected = true;
    }
    assert(rejected, "malicious input accepted");
  });
for (const width of [1440, 390]) {
  const frame = document.createElement("iframe");
  frame.title = `Responsive preview ${width}px`;
  frame.style.cssText = `width:${width}px;height:1000px;border:1px solid #ddd;display:block`;
  const container = document.createElement("div");
  container.style.cssText = "max-width:100%;overflow:auto;margin-top:20px";
  container.append(frame);
  document.body.append(container);
  const loaded = new Promise((resolve) =>
    frame.addEventListener("load", resolve, { once: true }),
  );
  frame.src = "/tests/preview";
  await loaded;
  check(`Responsive layout at ${width}px`, () => {
    const win = frame.contentWindow,
      page = frame.contentDocument;
    assert(page.querySelector("h1")?.textContent, "Application rendered");
    assert(win.innerWidth === width, "Requested viewport width");
    assert(
      page.documentElement.scrollWidth <= width,
      "No page-level horizontal overflow",
    );
    assert(
      page.querySelectorAll("[data-node]").length >= 4,
      "Diagram components rendered",
    );
    assert(
      win.getComputedStyle(page.querySelector(".sidebar")).position ===
        (width === 390 ? "static" : "fixed"),
      "Responsive navigation placement",
    );
  });
  const scale = Math.min(1, (document.body.clientWidth - 4) / width);
  frame.style.transformOrigin = "top left";
  frame.style.transform = `scale(${scale})`;
  container.style.height = `${1000 * scale}px`;
  container.style.overflow = "hidden";
}
document.querySelector("#results").textContent =
  lines.join("\n") +
  "\n\n" +
  lines.filter((x) => x.startsWith("PASS")).length +
  "/" +
  lines.length +
  " passed";
document.title = lines.some((x) => x.startsWith("FAIL"))
  ? "FAIL: browser checks"
  : "PASS: browser checks";
