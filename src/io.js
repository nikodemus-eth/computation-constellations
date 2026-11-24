import { PROFILE, boardSize, versionLabel, validate, catalogFor, TYPES } from "./model.js";
export const escapeXML = (s) =>
  String(s ?? "").replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
const aliases = {
  kind: "relationship_kind",
  id: "id",
  star: "star_id",
  source: "source_instance_id",
  target: "target_instance_id",
  catalogRevision: "catalog_revision",
  parent: "parent_instance_id",
};
const reverse = Object.fromEntries(
  Object.entries(aliases).map(([k, v]) => [v, k]),
);
const numbers = new Set([
  "revision",
  "catalogRevision",
  "x",
  "y",
  "width",
  "height",
  "zoom",
  "order",
]);
function attrs(record) {
  const result = {};
  function flat(o, p = "") {
    for (const [k, v] of Object.entries(o)) {
      if (v === undefined || v === null || Array.isArray(v)) continue;
      const key = p + (aliases[k] || k);
      if (typeof v === "object") flat(v, key + "__");
      else result["cc_" + key] = String(v);
    }
  }
  flat(record);
  return result;
}
function decode(el) {
  const o = {};
  for (const a of el.attributes) {
    if (!a.name.startsWith("cc_") || a.name === "cc_kind") continue;
    if (/__proto__|constructor|prototype/.test(a.name))
      throw Error("Unsafe metadata key.");
    const parts = a.name
      .slice(3)
      .split("__")
      .map((k) => reverse[k] || k);
    if (
      parts.some((p) => ["__proto__", "prototype", "constructor"].includes(p))
    )
      throw Error("Unsafe metadata key.");
    let target = o;
    for (const k of parts.slice(0, -1)) target = target[k] ??= {};
    const k = parts.at(-1);
    target[k] = numbers.has(k)
      ? Number(a.value)
      : ["active"].includes(k)
        ? a.value === "true"
        : a.value;
  }
  return o;
}
export function toDrawio(doc) {
  let seq = 2;
  const pages = [];
  function page(name, records) {
    const metadataLayer = "metadata-" + seq++;
    let cells = `<mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="${metadataLayer}" value="CC metadata" parent="0" visible="0"/>`;
    const editor = new Map(
      records
        .filter((r) => r.kind === "appearance")
        .map((r) => [r.data.id, "cell-" + seq++]),
    );
    for (const r of records) {
      const a = attrs(r.data),
        id = r.kind === "appearance" ? editor.get(r.data.id) : "cell-" + seq++;
      let body = "";
      if (
        [
          "appearance",
          "active_area",
          "outer_area",
          "catalog_reference",
        ].includes(r.kind)
      ) {
        body = `<mxCell vertex="1" parent="1" style="rounded=1;html=0;whiteSpace=wrap;fillColor=#f6f3ff;strokeColor=#8475bd;"><mxGeometry x="${r.data.x}" y="${r.data.y}" width="${r.data.width}" height="${r.data.height}" as="geometry"/></mxCell>`;
      } else if (r.kind === "connector") {
        body = `<mxCell edge="1" parent="1" source="${editor.get(r.data.source) || ""}" target="${editor.get(r.data.target) || ""}" style="endArrow=block;html=0;"><mxGeometry relative="1" as="geometry"/></mxCell>`;
      } else {
        body = `<mxCell vertex="1" parent="${metadataLayer}"><mxGeometry x="20" y="${(seq % 100) * 50}" width="260" height="40" as="geometry"/></mxCell>`;
      }
      cells += `<UserObject id="${id}" label="${escapeXML(r.label || r.data.label || r.data.title || r.kind)}" cc_kind="${r.kind}" ${Object.entries(
        a,
      )
        .map(([k, v]) => `${k}="${escapeXML(v)}"`)
        .join(" ")}>${body}</UserObject>`;
    }
    pages.push(
      `<diagram id="page-${seq++}" name="${escapeXML(name)}"><mxGraphModel><root>${cells}</root></mxGraphModel></diagram>`,
    );
  }
  const catRecords = [];
  for (const cat of [doc.catalog, ...doc.catalogHistory]) {
    catRecords.push({
      kind: "catalog",
      data: {
        id: cat.id,
        revision: cat.revision,
        current: cat === doc.catalog ? "yes" : "no",
        profile: PROFILE,
      },
    });
    for (const s of cat.stars) {
      catRecords.push({
        kind: "star",
        data: { ...s, catalogRevision: cat.revision },
      });
      for (const member of s.members || [])
        catRecords.push({
          kind: "membership",
          data: { group: s.id, member, catalogRevision: cat.revision },
        });
    }
  }
  for (const e of doc.evidence) catRecords.push({ kind: "evidence", data: e });
  for (const e of doc.audit) catRecords.push({ kind: "audit", data: e });
  for (const e of doc.imports) {
    const { original, ...metadata } = e;
    catRecords.push({ kind: "source_record", data: metadata });
  }
  page("Catalog", catRecords);
  for (const c of doc.cases)
    for (const v of c.views) {
      const records = [
        {
          kind: "outer_area",
          data: { x: 18, y: 22, width: boardSize(doc,c,v).width - 38, height: boardSize(doc,c,v).height - 50 },
          label: "Available stars",
        },
        {
          kind: "view",
          data: {
            id: v.id,
            title: v.title,
            parent: v.parent || "",
            caseId: c.id,
            viewport: v.viewport,
          },
        },
        { kind: "active_area", data: v.area },
      ];
      if (v.id === c.root) {
        records.push({ kind: "use_case", data: c });
        for (const st of c.steps) records.push({ kind: "step", data: st });
        for (const review of c.reviews)
          records.push({ kind: "review", data: review });
      }
      const cat = catalogFor(doc, c);
      const parent = v.parent
        ? c.views.flatMap((w) => w.instances).find((i) => i.id === v.parent)
        : null;
      const members = parent
        ? cat?.stars.find((s) => s.id === parent.star)?.members
        : null;
      for (const [n, s] of (cat?.stars || [])
        .filter((s) => !members || members.includes(s.id))
        .entries())
        records.push({
          kind: "catalog_reference",
          data: { star: s.id, x: 36, y: 112 + n * 68, width: 160, height: 54 },
          label: s.label,
        });
      for (const i of v.instances)
        records.push({
          kind: "appearance",
          data: i,
          label:
            i.label ||
            cat?.stars.find((s) => s.id === i.star)?.label ||
            "Unknown",
        });
      for (const f of v.flows)
        records.push({
          kind: "connector",
          data: f,
          label: f.condition || f.kind.replaceAll("_", " "),
        });
      page(c.title + " · " + v.title, records);
    }
  return `<?xml version="1.0" encoding="UTF-8"?><mxfile compressed="false">${pages.join("")}</mxfile>`;
}
export function fromDrawio(text) {
  if (new TextEncoder().encode(text).length > 2 * 1024 * 1024)
    throw Error("File exceeds the 2 MiB import limit.");
  if (
    /<!DOCTYPE|<!ENTITY|<\s*(?:script|svg|iframe|object|embed)\b|\b(?:javascript|vbscript)\s*:/i.test(
      text,
    )
  )
    throw Error("Unsafe XML constructs or active content rejected.");
  const xml = new DOMParser().parseFromString(text, "application/xml");
  if (
    xml.querySelector("parsererror") ||
    xml.documentElement.tagName !== "mxfile"
  )
    throw Error("Expected a valid uncompressed draw.io XML file.");
  const elements = [...xml.querySelectorAll("*")];
  if (elements.length > 16000) throw Error("Too many XML elements.");
  const allowed = new Set([
    "mxfile",
    "diagram",
    "mxGraphModel",
    "root",
    "mxCell",
    "UserObject",
    "object",
    "mxGeometry",
    "mxPoint",
    "Array",
  ]);
  for (const el of elements) {
    if (
      el.tagName === "mxCell" &&
      (el.hasAttribute("vertex") || el.hasAttribute("edge")) &&
      !["UserObject", "object"].includes(el.parentElement?.tagName)
    )
      throw Error(
        "Unprofiled shape cannot be imported without explicit metadata.",
      );
    if (!allowed.has(el.tagName))
      throw Error(`Unsupported XML element: ${el.tagName}`);
    for (const a of el.attributes) {
      if (
        /^on/i.test(a.name) ||
        ["link", "href", "src", "animation"].includes(a.name) ||
        /image=|stencil\(|html=1|data:action/i.test(a.value)
      )
        throw Error(
          "Active content, external resources, or formatted HTML are not supported.",
        );
      if (
        a.name.startsWith("cc_") &&
        /(?:source|contract|permission|access|policy|reference)/i.test(
          a.name,
        ) &&
        /^(?:javascript|data|file|vbscript):|(?:^|[\\/])\.\.(?:[\\/]|$)/i.test(
          a.value,
        )
      )
        throw Error("Unsafe reference rejected.");
    }
  }
  const doc = {
    profile: PROFILE,
    catalog: null,
    catalogHistory: [],
    cases: [],
    evidence: [],
    history: [],
    audit: [],
    imports: [],
  };
  const catalogs = new Map(),
    views = [],
    caseRecords = [],
    stepRecords = [],
    reviewRecords = [],
    members = [];
  let profileFound = false;
  for (const page of xml.querySelectorAll("diagram")) {
    if (!page.querySelector("mxGraphModel"))
      throw Error("Compressed pages are not supported.");
    const records = [...page.querySelectorAll("UserObject, object")];
    const pageView = records.find((e) => e.getAttribute("cc_kind") === "view");
    const v = pageView
      ? {
          ...decode(pageView),
          parent: decode(pageView).parent || null,
          instances: [],
          flows: [],
          area: null,
        }
      : null;
    const native = new Map();
    for (const el of records) {
      const kind = el.getAttribute("cc_kind"),
        r = decode(el);
      switch (kind) {
        case "catalog":
          if (r.profile !== PROFILE)
            throw Error("Unsupported constellation profile.");
          profileFound = true;
          catalogs.set(r.revision, {
            id: r.id,
            revision: r.revision,
            stars: [],
            current: r.current,
          });
          break;
        case "star": {
          const cat = catalogs.get(r.catalogRevision);
          if (!cat) throw Error("Catalog metadata must precede its stars.");
          delete r.catalogRevision;
          r.label = el.getAttribute("label") || r.label;
          cat.stars.push({ ...r, members: [] });
          break;
        }
        case "membership":
          members.push(r);
          break;
        case "evidence":
          doc.evidence.push(r);
          break;
        case "audit":
          doc.audit.push(r);
          break;
        case "source_record":
          doc.imports.push(r);
          break;
        case "use_case":
          caseRecords.push({ ...r, views: [], steps: [], reviews: [] });
          break;
        case "view":
        case "outer_area":
        case "catalog_reference":
          break;
        case "active_area":
          if (!v) throw Error("Area without view.");
          v.area = r;
          {
            const g = el.querySelector("mxGeometry");
            for (const k of ["x", "y", "width", "height"])
              v.area[k] = Number(g?.getAttribute(k));
          }
          break;
        case "appearance":
          if (!v) throw Error("Appearance without view.");
          {
            const g = el.querySelector("mxGeometry");
            for (const k of ["x", "y", "width", "height"])
              r[k] = Number(g?.getAttribute(k));
            r._nativeLabel = el.getAttribute("label") || r.label || "";
            native.set(el.getAttribute("id"), r.id);
            v.instances.push(r);
          }
          break;
        case "connector":
          if (!v) throw Error("Connector without view.");
          r._nativeLabel = el.getAttribute("label") || "";
          v.flows.push({
            ...r,
            _source: el.querySelector("mxCell")?.getAttribute("source"),
            _target: el.querySelector("mxCell")?.getAttribute("target"),
          });
          break;
        case "step":
          stepRecords.push(r);
          break;
        case "review":
          reviewRecords.push({ ...r, _case: caseRecords.at(-1)?.id });
          break;
        default:
          throw Error(
            `Unsupported semantic record: ${kind || "unprofiled object"}`,
          );
      }
    }
    if (v) {
      for (const f of v.flows) {
        if (
          native.get(f._source) !== f.source ||
          native.get(f._target) !== f.target
        )
          throw Error("Native and semantic connector endpoints disagree.");
        delete f._source;
        delete f._target;
        if (f._nativeLabel !== (f.condition || f.kind.replaceAll("_", " ")))
          f.condition = f._nativeLabel;
        delete f._nativeLabel;
      }
      if (!v.area) throw Error("Missing active area.");
      views.push(v);
    }
  }
  if (!profileFound || !catalogs.size || !caseRecords.length)
    throw Error("Not a Computation Constellations profile file.");
  for (const m of members) {
    const star = catalogs
      .get(m.catalogRevision)
      ?.stars.find((s) => s.id === m.group);
    if (!star) throw Error("Missing group for membership.");
    star.members.push(m.member);
  }
  for (const c of catalogs.values()) {
    if (c.current === "yes") {
      if (doc.catalog) throw Error("Multiple current catalogs.");
      doc.catalog = c;
    } else doc.catalogHistory.push(c);
    delete c.current;
  }
  if (!doc.catalog) throw Error("Missing current catalog.");
  doc.cases = caseRecords;
  for (const c of doc.cases) {
    c.views = views
      .filter((v) => v.caseId === c.id)
      .map((v) => {
        delete v.caseId;
        return v;
      });
    c.steps = stepRecords.filter((s) => c.views.some((v) => v.id === s.view));
    c.reviews = reviewRecords
      .filter((r) => r._case === c.id)
      .map((r) => {
        delete r._case;
        return r;
      });
  }
  for (const c of doc.cases) {
    const cat = catalogFor(doc, c);
    for (const v of c.views)
      for (const i of v.instances) {
        const original =
          i.label || cat?.stars.find((s) => s.id === i.star)?.label || "";
        if (i._nativeLabel !== original) i.label = i._nativeLabel;
        delete i._nativeLabel;
      }
  }
  const issues = validate(doc);
  if (issues.errors.length)
    throw Error(issues.errors.map((e) => `${e.message} (${e.id})`).join("\n"));
  return doc;
}
export function routeText(doc, c) {
  const cat = catalogFor(doc, c),
    lines = [
      c.title,
      `Version ${versionLabel(c)} · ${c.status} · origin ${c.author?.kind || "unknown"} (unverified)` ,
      `Revision ID: ${c.revisionId || "unknown"}; parent: ${c.parentRevisionId || "none"}`,
      "Approval: local unverified claims only. Finalization: not verified.",
      c.description,
      "Documentation only; no external execution.",
    ];
  for (const v of c.views) {
    lines.push(`\nVIEW: ${v.title}`);
    for (const i of v.instances) {
      const s = cat?.stars.find((s) => s.id === i.star);
      lines.push(
        `${i.id}: ${i.label || s?.label} — ${TYPES[s?.type]?.[1] || "Unknown"}, ${i.active ? "active" : "inactive"}; ${i.claim?.intent || "proposed"} / ${i.claim?.implementation || "unknown"}.`,
      );
    }
    for (const f of v.flows)
      lines.push(
        `${f.id}: ${f.source} → ${f.target}; ${f.kind}; ${f.active ? "active" : "inactive"}; condition: ${f.condition || "unknown"}; operation: ${f.operation || "unknown"}; failure: ${f.failure || "unknown"}; evidence must be inspected separately.`,
      );
  }
  lines.push("\nWALKTHROUGH");
  c.steps.forEach((s, n) =>
    lines.push(`${n + 1}. [${s.view} / ${s.target}] ${s.text}`),
  );
  return lines.join("\n");
}
export function toSVG(doc, c, v) {
  const cat = catalogFor(doc, c);
  const {width, height} = boardSize(doc,c,v);
  let body = `<rect width="${width}" height="${height}" fill="#f7f6f2"/><rect x="${v.area.x}" y="${v.area.y}" width="${v.area.width}" height="${v.area.height}" fill="white" stroke="#cbc5dc"/><text x="30" y="40" font-family="sans-serif" font-size="20">${escapeXML(c.title)} — ${escapeXML(v.title)}</text><text x="30" y="70" font-family="sans-serif" font-size="12">Documentation only · ${escapeXML(c.status)} · ${escapeXML(versionLabel(c))} · approval unverified · not finalized</text>`;
  for (const f of v.flows) {
    const a = v.instances.find((i) => i.id === f.source),
      b = v.instances.find((i) => i.id === f.target);
    if (a && b)
      body += `<path d="M ${a.x + a.width / 2} ${a.y + a.height / 2} L ${b.x + b.width / 2} ${b.y + b.height / 2}" fill="none" stroke="#8c839e" marker-end="url(#arrow)" ${f.kind === "observation" ? 'stroke-dasharray="2 5"' : f.kind === "control_flow" || !f.active ? 'stroke-dasharray="7 5"' : ""}/>`;
  }
  for (const i of v.instances) {
    const s = cat?.stars.find((s) => s.id === i.star);
    body += `<rect x="${i.x}" y="${i.y}" width="${i.width}" height="${i.height}" rx="10" fill="${i.active ? "#f3effb" : "#eee"}" stroke="#b7a8d1"/><text x="${i.x + 10}" y="${i.y + 30}" font-family="sans-serif" font-size="13">${escapeXML((i.label || s?.label || "Unknown").slice(0, 27))}</text><text x="${i.x + 10}" y="${i.y + 52}" font-family="sans-serif" font-size="10">${escapeXML(s?.type)} · ${i.active ? "active" : "inactive"}</text><text x="${i.x + 10}" y="${i.y + 70}" font-family="sans-serif" font-size="10">${escapeXML(i.claim?.intent || "proposed")} / ${escapeXML(i.claim?.implementation || "unknown")}</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8" fill="#8c839e"/></marker></defs>${body}</svg>`;
}
export function download(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// Native, macro-free Visio Open Packaging Convention export.
const VNS = 'http://schemas.microsoft.com/office/visio/2012/main';
const RNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const VREL = 'http://schemas.microsoft.com/visio/2010/relationships/';
const xml = s => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + s;
const vx = s => escapeXML(String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''));
const cell = (n,v,f) => `<Cell N="${n}" V="${vx(v)}"${f ? ` F="${vx(f)}"` : ''}/>`;
const rels = rows => xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rows.map(([id,type,target])=>`<Relationship Id="${id}" Type="${type}" Target="${vx(target)}"/>`).join('')}</Relationships>`);
function properties(record) {
 const rows=[];
 const walk=(obj,prefix='')=>{for(const [key,value] of Object.entries(obj || {})) {
  if(value===undefined || value===null) continue;
  const name=prefix+key;
  if(typeof value==='object' && !Array.isArray(value)) walk(value,name+'_');
  else rows.push([name,typeof value==='object'?JSON.stringify(value):String(value)]);
 }}; walk(record);
 return `<Section N="Property">${rows.map(([name,value],n)=>`<Row IX="${n}" N="CC_${name.replace(/[^A-Za-z0-9_]/g,'_')}"><Cell N="Label" V="${vx(name)}" U="STR"/>${cell('Type',0)}<Cell N="Value" V="${vx(value)}" U="STR"/></Row>`).join('')}</Section>`;
}
const character = `<Section N="Character"><Row IX="0">${cell('Font','Arial')}${cell('Size',0.166667)}${cell('Color','#203748')}</Row></Section><Section N="Paragraph"><Row IX="0">${cell('HorzAlign',1)}${cell('SpLine',-1.2)}${cell('SpBefore',0)}${cell('SpAfter',0)}</Row></Section>`;
function rectangle(id,name,x,y,w,h,text,data={},fill='#F3EFFB') {
 return `<Shape ID="${id}" NameU="${vx(name)}" Type="Shape">${cell('PinX',x+w/2)}${cell('PinY',y+h/2)}${cell('Width',w)}${cell('Height',h)}${cell('LocPinX',w/2)}${cell('LocPinY',h/2)}${cell('Angle',0)}${cell('LineWeight',0.012)}${cell('LineColor','#9DAFC1')}${cell('LinePattern',1)}${cell('FillForegnd',fill)}${cell('FillPattern',1)}${cell('VerticalAlign',1)}${cell('LeftMargin',0.06)}${cell('RightMargin',0.06)}${cell('TopMargin',0.04)}${cell('BottomMargin',0.04)}${character}${properties(data)}<Section N="Connection">${[[w,h/2],[0,h/2],[w/2,h],[w/2,0]].map(([cx,cy],n)=>`<Row IX="${n}">${cell("X",cx)}${cell("Y",cy)}${cell("DirX",0)}${cell("DirY",0)}${cell("Type",0)}</Row>`).join("")}</Section><Section N="Geometry" IX="0">${cell('NoFill',0)}${cell('NoLine',0)}<Row T="MoveTo" IX="1">${cell('X',0)}${cell('Y',0)}</Row>${[[w,0],[w,h],[0,h],[0,0]].map(([a,b],n)=>`<Row T="LineTo" IX="${n+2}">${cell('X',a)}${cell('Y',b)}</Row>`).join('')}</Section><Text><cp IX="0"/><pp IX="0"/>${vx(text)}</Text></Shape>`;
}
function connector(id,f,a,b,height,shapeIDs) {
 const scale=96, vertical=Math.abs(b.y-a.y)>Math.abs(b.x-a.x);
 const ap=vertical?(b.y>=a.y?3:2):(b.x>=a.x?0:1), bp=vertical?(b.y>=a.y?2:3):(b.x>=a.x?1:0);
 const point=(i,p)=>[[i.x+i.width,i.y+i.height/2],[i.x,i.y+i.height/2],[i.x+i.width/2,i.y],[i.x+i.width/2,i.y+i.height]][p];
 const [apx,apy]=point(a,ap),[bpx,bpy]=point(b,bp), ax=apx/scale,ay=(height-apy)/scale,bx=bpx/scale,by=(height-bpy)/scale;
 const length=Math.hypot(bx-ax,by-ay), angle=Math.atan2(by-ay,bx-ax);
 const pattern=f.kind==='observation'?3:f.kind==='control_flow'?2:1;
 const data={...f,cc_record:'connector',verification:'Unverified claim; not execution evidence'};
 const shape=`<Shape ID="${id}" NameU="${vx(f.id)}" Type="Shape">${cell('PinX',(ax+bx)/2)}${cell('PinY',(ay+by)/2)}${cell('Width',length)}${cell('Height',0)}${cell('LocPinX',length/2)}${cell('LocPinY',0)}${cell('Angle',angle)}${cell('BeginX',ax,`PAR(PNT(Sheet.${shapeIDs.get(a.id)}!Connections.X${ap+1},Sheet.${shapeIDs.get(a.id)}!Connections.Y${ap+1}))`)}${cell('BeginY',ay,`PAR(PNT(Sheet.${shapeIDs.get(a.id)}!Connections.X${ap+1},Sheet.${shapeIDs.get(a.id)}!Connections.Y${ap+1}))`)}${cell('EndX',bx,`PAR(PNT(Sheet.${shapeIDs.get(b.id)}!Connections.X${bp+1},Sheet.${shapeIDs.get(b.id)}!Connections.Y${bp+1}))`)}${cell('EndY',by,`PAR(PNT(Sheet.${shapeIDs.get(b.id)}!Connections.X${bp+1},Sheet.${shapeIDs.get(b.id)}!Connections.Y${bp+1}))`)}${cell('ObjType',2)}${cell('LineWeight',0.012)}${cell('LinePattern',pattern)}${cell('LineColor',f.kind==='observation'?'#937EA8':f.kind==='control_flow'?'#B58A42':'#718D9D')}${cell('EndArrow',4)}${cell('EndArrowSize',2)}${cell('FillPattern',0)}${character}${properties(data)}<Section N="Geometry" IX="0">${cell('NoFill',1)}<Row T="MoveTo" IX="1">${cell('X',0)}${cell('Y',0)}</Row><Row T="LineTo" IX="2">${cell('X',length)}${cell('Y',0)}</Row></Section><Text/></Shape>`;
 const connections=[['BeginX',a.id,9,ap],['EndX',b.id,12,bp]].map(([from,to,part,port])=>`<Connect FromSheet="${id}" FromCell="${from}" FromPart="${part}" ToSheet="${shapeIDs.get(to)}" ToCell="Connections.X${port+1}" ToPart="${100+port}"/>`).join('');
 return {shape,connections};
}
function visioPackage(doc,stencil) {
 const issues=validate(doc).errors;
 if(issues.length) throw Error('Resolve structural errors before Visio export: '+issues[0].message);
 const parts={}, types=[], pages=[], masters=[];
 const add=(name,body,type)=>{parts[name]=body; if(type)types.push([name,type]);};
 const visType=kind=>`application/vnd.ms-visio.${kind}+xml`;
 add('visio/document.xml',xml(`<VisioDocument xmlns="${VNS}" xmlns:r="${RNS}"><DocumentSettings TopPage="0" DefaultTextStyle="0" DefaultLineStyle="0" DefaultFillStyle="0" DefaultGuideStyle="0"/><FaceNames><FaceName ID="0" Name="Arial" UnicodeRanges="-1 -1 -1 -1" CharSets="0 0" Panose="2 11 6 4 2 2 2 2 2 4" Flags="0"/></FaceNames><StyleSheets><StyleSheet ID="0" NameU="No Style">${cell('LinePattern',1)}${cell('LineWeight',0.01)}${cell('LineColor','#203748')}${cell('FillPattern',1)}${cell('FillForegnd','#FFFFFF')}${character}</StyleSheet></StyleSheets></VisioDocument>`),visType(stencil?'stencil.main':'drawing.main'));
 add('_rels/.rels',rels([['rId1',VREL+'document','visio/document.xml']]));
 const page=(name,w,h,shapes,connections='',metadata={})=>{
  const n=pages.length+1;
  pages.push(`<Page ID="${n-1}" Name="${vx(name)}" NameU="CC_Page_${n}"><PageSheet>${cell('PageWidth',w)}${cell('PageHeight',h)}${cell('DrawingScale',1)}${cell('PageScale',1)}${properties(metadata)}</PageSheet><Rel r:id="rId${n}"/></Page>`);
  add(`visio/pages/page${n}.xml`,xml(`<PageContents xmlns="${VNS}" xmlns:r="${RNS}"><Shapes>${shapes}</Shapes>${connections?`<Connects>${connections}</Connects>`:''}</PageContents>`),visType('page'));
 };
 if(stencil) {
  for(const [index,s] of doc.catalog.stars.entries()) {
   const n=index+1;
   masters.push(`<Master ID="${n}" Name="${vx(s.label)}" NameU="${vx(s.id)}" MatchByName="1"><PageSheet>${cell('PageWidth',3)}${cell('PageHeight',1)}</PageSheet><Rel r:id="rId${n}"/></Master>`);
   add(`visio/masters/master${n}.xml`,xml(`<MasterContents xmlns="${VNS}"><Shapes>${rectangle(1,s.id,0,0,3,1,s.label,{...s,cc_record:'catalog_star',catalog_revision:doc.catalog.revision})}</Shapes></MasterContents>`),visType('master'));
  }
  add('visio/masters/masters.xml',xml(`<Masters xmlns="${VNS}" xmlns:r="${RNS}">${masters.join('')}</Masters>`),visType('masters'));
  add('visio/masters/_rels/masters.xml.rels',rels(masters.map((_,n)=>[`rId${n+1}`,VREL+'master',`master${n+1}.xml`])));
  add('visio/_rels/document.xml.rels',rels([['rId1',VREL+'masters','masters/masters.xml']]));
 } else {
  for(const c of doc.cases) for(const v of c.views) {
   const size=boardSize(doc,c,v), scale=96, w=size.width/scale,h=size.height/scale;
   const cat=catalogFor(doc,c), ids=new Map(v.instances.map((i,n)=>[i.id,n+10]));
   let shapes=rectangle(1,'CC_Outer',0.15,0.15,w-0.3,h-0.3,'',{role:'available_catalog_boundary'},'#FAFAFC');
   shapes+=rectangle(2,'CC_Active',v.area.x/scale,(size.height-v.area.y-v.area.height)/scale,v.area.width/scale,v.area.height/scale,'',{role:'active_area',view_id:v.id},'#FFFFFF');
   shapes+=rectangle(3,'CC_Title',0.3,h-0.85,w-0.6,0.55,c.title+' · '+v.title+' · '+versionLabel(c)+' · proposed documentation · approval unverified',{},'#FAFAFC');
   const links=v.flows.map((f,n)=>connector(10000+n,f,v.instances.find(i=>i.id===f.source),v.instances.find(i=>i.id===f.target),size.height,ids));
   shapes+=links.map(x=>x.shape).join('');
   for(const i of v.instances) {
    const s=cat.stars.find(s=>s.id===i.star);
    shapes+=rectangle(ids.get(i.id),i.id,i.x/scale,(size.height-i.y-i.height)/scale,i.width/scale,i.height/scale,(i.label||s.label),{catalog:s,appearance:i,case_id:c.id,revision_id:c.revisionId,catalog_revision:c.catalogRevision,evidence:doc.evidence.filter(e=>e.caseId===c.id&&e.subject===i.id)},i.active?'#EAF1F8':'#EEEEEE');
   }
   const placed=new Set(v.instances.map(i=>i.star));
   cat.stars.filter(s=>!placed.has(s.id)).forEach((s,n)=>{ shapes+=rectangle(20000+n,s.id,0.35,h-1.6-n*0.65,1.65,0.55,s.label.length>20?s.label.slice(0,19)+'…':s.label,{...s,cc_record:'available_catalog_star'},'#F4F1E9'); });
   page((c.title+' — '+v.title).slice(0,100),w,h,shapes,links.map(x=>x.connections).join(''),{case_id:c.id,view_id:v.id,parent_appearance:v.parent||'',catalog_revision:c.catalogRevision,revision_id:c.revisionId,parent_revision_id:c.parentRevisionId||'',version:versionLabel(c),author:c.author,review_claims:c.reviews,finalization:'Unverified; export is documentation only',walkthrough:c.steps.filter(s=>s.view===v.id)});
  }
  const stars=doc.catalog.stars;
  const h=Math.max(5,Math.ceil(stars.length/4)*1.3+1.2);
  let shapes=rectangle(1,'Catalog_Title',0.3,h-0.8,13,0.5,'Star catalog · reusable vocabulary · proposed metadata');
  stars.forEach((s,n)=>{shapes+=rectangle(n+2,s.id,0.4+(n%4)*3.35,h-2-Math.floor(n/4)*1.3,3.1,1,s.label,{...s,cc_record:'catalog_star',catalog_revision:doc.catalog.revision});});
  page('Star catalog',13.8,h,shapes);
  add('visio/pages/pages.xml',xml(`<Pages xmlns="${VNS}" xmlns:r="${RNS}">${pages.join('')}</Pages>`),visType('pages'));
  add('visio/pages/_rels/pages.xml.rels',rels(pages.map((_,n)=>[`rId${n+1}`,VREL+'page',`page${n+1}.xml`])));
  add('visio/_rels/document.xml.rels',rels([['rId1',VREL+'pages','pages/pages.xml']]));
 }
 add('[Content_Types].xml',xml(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${types.map(([name,type])=>`<Override PartName="/${name}" ContentType="${type}"/>`).join('')}</Types>`));
 return parts;
}
// ZIP STORE keeps this exporter synchronous, offline and dependency-free in browsers.
export function zipFiles(files) {
 const encoder=new TextEncoder(), locals=[], directory=[]; let offset=0;
 const crc=bytes=>{let c=0xFFFFFFFF; for(const b of bytes){c^=b;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xEDB88320:0);}return (c^0xFFFFFFFF)>>>0;};
 const header=(length,values)=>{const b=new Uint8Array(length),v=new DataView(b.buffer);for(const [pos,value,size] of values) size===2?v.setUint16(pos,value,true):v.setUint32(pos,value,true);return b;};
 for(const [name,content] of Object.entries(files)) {
  const n=encoder.encode(name),data=typeof content==='string'?encoder.encode(content):content,c=crc(data);
  const local=header(30,[[0,0x04034b50,4],[4,20,2],[6,0x800,2],[12,33,2],[14,c,4],[18,data.length,4],[22,data.length,4],[26,n.length,2]]);
  const central=header(46,[[0,0x02014b50,4],[4,20,2],[6,20,2],[8,0x800,2],[14,33,2],[16,c,4],[20,data.length,4],[24,data.length,4],[28,n.length,2],[42,offset,4]]);
  locals.push(local,n,data);directory.push(central,n);offset+=local.length+n.length+data.length;
 }
 const length=directory.reduce((n,x)=>n+x.length,0),count=Object.keys(files).length;
 const end=header(22,[[0,0x06054b50,4],[8,count,2],[10,count,2],[12,length,4],[16,offset,4]]);
 const out=new Uint8Array(offset+length+22);let pos=0;for(const part of [...locals,...directory,end]){out.set(part,pos);pos+=part.length;}return out;
}
export function toVisio(doc) { return zipFiles(visioPackage(doc,false)); }
export function toVisioStencil(doc) { return zipFiles(visioPackage(doc,true)); }
