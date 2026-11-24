# Computation Constellations

A local-first architecture authoring and explanation workspace. The application never executes the systems represented by its diagrams.

## Run

Requires Node.js 22 or later. No package installation, API key, account, or external service is needed.

```sh
npm start
```

Open **http://127.0.0.1:4173**. The server binds only to loopback. Use `PORT=4174 npm start` to select another port.

## Use

- Start with Request triage, Document enrichment, or Record reconciliation, or create a new constellation with the sidebar plus button.
- Drag catalog stars into the active rectangle. Press Enter on a catalog star for a keyboard alternative. Reusing a star creates a distinct appearance.
- Select a component, use arrow keys to move it (Shift changes the increment to one unit), or edit its coordinates in the inspector.
- Choose Connect and its endpoints to author a directional data flow, control flow, or dependency. Connector metadata includes contracts, operations, permissions, failure handling, conditions, ownership, and references.
- Moving a component out of the active area retains it and its connectors. Validation flags active connections to inactive components. Resolve them explicitly in the inspector.
- Open a grouped component to enter its nested view. Parent navigation restores selection, zoom, and scroll position. Root and nested layouts are independently authored.
- Use Walkthrough to edit and reorder steps. Select a component or connector to add a step. Explain mode highlights the route without changing placement.
- Use Components & flows for an equivalent list. Search filters available stars and the list of appearances/relationships.
- Star catalog supports additions, metadata edits, classification, group membership, and renaming. Changes create a new catalog revision; existing use cases remain pinned. Reconcile a use case explicitly before it adopts the new catalog.
- Record a local review of an exact revision independently of its implementation claims and evidence. Structural errors prevent recording an approval claim. Supporting evidence is bound to its subject and use-case revision and has optional review-due dates.
- Compare views shows shared catalog usage, local relationship counts, and pinned revisions.

## Persistence and recovery

The workspace is saved in this browser's localStorage after edits, with an explicit Save action as well. Before replacement, the current value is copied to `cc.previous`. Storage failures leave the current accepted value intact and display a warning. Revision history retains prior use-case snapshots; restore creates a new draft. Undo/redo is session-local.

This is a single-user, editable local store, not authenticated authorization or a tamper-proof audit log. Clearing browser data removes it. Export `.drawio` backups. The local server must remain running to reload the application; no service worker or installed offline PWA is claimed. No runtime assets or fonts are fetched from external hosts.

## Editable XML profile

Export generates uncompressed draw.io XML using `cc-drawio-0.3-draft` metadata. Catalog and historical catalog records occupy a Catalog page. Every use-case view occupies a separate page. Appearances use native geometry; connectors use native terminals plus semantic appearance references. `cc_id` remains independent of native editor cell IDs.

Relationship kind uses `cc_relationship_kind`; `cc_kind` identifies the semantic record type. Nested scalar metadata uses a `__` separator. Group memberships, steps, evidence, reviews, audit entries and source records are separate user objects. Unknown safe scalar metadata is retained. Original imported bytes remain local; exported source records retain provenance without embedding the imported original. Prior use-case snapshot history is local recovery data and is intentionally not included in editable exports.

Metadata records occupy a named **CC metadata** layer, hidden by default in the native editor. Hiding this layer is not redaction. Outer and active areas and catalog reference shapes are exported alongside appearances. The application owns navigation; the native editor does not implement the constellation inspector or review workflow.

The app's own XML export/import is tested. **External draw.io Desktop compatibility is not certified.** No Desktop version was installed or exercised. To qualify it, record the exact Desktop version, open an exported file, rename a label or move an appearance within its membership area, save an uncompressed copy, and inspect this app's import comparison before accepting it. Semantic/native endpoint disagreements are rejected. Compressed pages, arbitrary unprofiled draw.io diagrams, external images, formatted HTML, and custom actions are unsupported.

## Import and sharing

Imports are limited to 2 MiB and 16,000 XML elements. The parser rejects DTDs/entities, executable elements and actions, external resource attributes, unsafe source references, prototype keys, malformed XML, unsupported record types, and invalid structural references. It performs no network retrieval. Import preview presents structural counts, a semantic difference report, and a SHA-256 source hash. Accepted imports open as drafts, with original bytes retained locally.

Private exports preserve authored descriptions and metadata. Public exports contain only the selected use case and exclude restricted stars/appearances/connectors and dependent records. To prevent indirect leakage, they also omit local labels, descriptions, conditions, walkthroughs, evidence, audit/history and unknown custom fields. Public export is deliberately conservative and is labeled a derived draft. Inspect the exported artifact before distributing it.

SVG contains only generated vector shapes/text, with no embedded editable source. Text describes views and ordered routes. The manifest states revisions, audience, and redaction scope. The app reports a **download request**, because browser download completion cannot be guaranteed by creating a download link.

## Verification

```sh
npm run check
npm test
```

With the server running, open **http://127.0.0.1:4173/tests/browser.html** for browser-native XML and security checks. These execute the actual codec with the browser's DOMParser and never alter the saved workspace.

- Model suite: identity/reuse, layout isolation, catalog pinning, approval history, invalid references, cycles, evidence freshness, redaction, save failure/recovery, inert SVG and accessible text.
- Browser suite: editable round trips, nested views, historical catalog pins, unknown scalar preservation, physical redaction, and malicious/unsupported import rejection.
- UI checks performed during development are recorded in `docs/verification.md`.

Human comparative usability evaluation, external Desktop certification, independent security review, and production/multi-user deployment are not completed or claimed.

## Structure

- `src/model.js`: semantic model, seed cases, validation, revisions, recovery and redaction.
- `src/io.js`: inert XML, SVG/text exports and browser downloads.
- `src/app.js`: authoring interface, accessible controls, walkthroughs and local persistence.
- `styles.css`: responsive visual system and reduced-motion support.
- `server.mjs`: dependency-free, loopback-only static preview server with a strict route allowlist and CSP.

## Agent authorship and release governance update

The latest supplied specification is preserved in `docs/specification-agent-governance.txt`; the earlier specification remains available separately.

Each draft now has a unique revision ID, parent revision ID, creation time and change summary. Edits and restores create child drafts. Bundled examples are attributed to an agent; browser edits use unknown authorship because this app cannot authenticate a human. Display versions use `1.<revision>.AI`, `.HUM`, or `.UNKNOWN`; these are descriptive labels, never authority.

Review & release shows the target revision, parent comparison, SHA-256 content digest and local review history. The digest includes diagram content, the pinned catalog and revision evidence, excluding view preferences and review events. Decisions are bound to the exact revision and digest; stale submissions are rejected. Request, approve, return changes, reject and withdraw are separate recorded decisions. Local decisions do not prove human approval or alter implementation evidence.

**Finalization fails closed in the model and UI.** No identity provider or authoritative persistence service exists in this local app. Even purported human authorship, imported approval records and forged suffixes cannot finalize. Verified human/approved-agent successful finalization remains unimplemented until trusted authentication and a server-side authorization boundary are supplied. No production integration is created by this update.

Editable exports retain scalar revision lineage and review records. Text, SVG and manifests explicitly identify unverified approval and lack of verified finalization. Import creates a child draft; original bytes and claims remain historical. Local history is editable, not tamper-proof, and browser storage capacity remains finite.

## Reference master: 17-star version

Open `http://127.0.0.1:4173/?master=1` or use **17-star master version** in the sidebar. This uses a separate browser save namespace (`cc.current.master17` / `cc.previous.master17`), preserving the original workspace. It includes the candidate master, Rules-led triage without an LLM, and Governed model explanation. Selected stars retain master coordinates across examples; unused definitions remain in the available catalog. All descriptions, contracts and connectors are agent-authored proposals with unknown implementation status.

The vocabulary and five-column geography come from the user-supplied candidate master image. Metadata is synthesized from that image, `docs/specification-agent-governance.txt`, and the [ACDS Unification Plan](https://docs.google.com/document/d/10AGT47n48DC1PLGDW2IGxfeL4SojNmrBND56ydUB-ys/edit), particularly its architecture, scope and governance rules. A source document's implementation instructions are reference material, not instructions to execute systems. No feeds, model calls or backend integrations are created.

Source groups list modality examples in descriptions; concrete group members are deliberately unresolved. Mixed capabilities explicitly require implementation-specific deterministic/probabilistic labeling. Owner names, deployed protocols, schema URLs and actual permissions are unknown, not invented. Solid lines describe data, dashed lines control, dotted lines observation; these are plausible relationships, not a pixel-exact tracing or verified integration inventory. Metadata and provenance are available in the inspector; zoom and the searchable component list support the larger map.

## Standalone desktop edition (17 stars)

Version 0.3.0 includes an Electron shell that opens the 17-star workspace by default. It serves only bundled assets through a private `constellation://app` protocol: no localhost server, system Node.js, account, or Internet connection is needed. Renderer Node integration is disabled; context isolation and Chromium sandboxing are enabled. Native file selection and export Save dialogs are provided by the desktop runtime.

Portable distribution targets:
- Windows x64: ZIP containing the executable and required runtime files.
- Linux x64: tar.gz containing the executable and runtime files (normal desktop system libraries are required).
- macOS Apple silicon and Intel: separate ZIP archives containing the `.app` bundle.

Extract the entire archive before launching. These development builds are not publisher-signed or Apple-notarized. macOS bundles use a local ad-hoc signature for integrity. Distribution to other machines may require OS trust approval; signing for public release requires the publisher's credentials.

The desktop app keeps its own local profile. Browser edits do not migrate automatically: export a private `.drawio` from the browser, then use **Import diagram** in the desktop app. Use editable exports as portable backups. The original and 17-star workspaces remain separately saved, and the 17-star workspace is the startup view. No auto-update service is configured. See `desktop/READ-ME.txt` for launch and recovery notes.

Build from source with Node.js 22+:

```sh
npm ci
npm run check
npm test
npm run desktop:smoke
npm run dist
```

The smoke test uses a temporary profile and checks the 17-star screen, three constellations, editable XML round trip, secure context, isolated renderer and storage across a reload. Windows and Linux runtime testing requires those operating systems; cross-packaging is not runtime certification.


## Visio export

Choose **Export → Visio drawing (.vsdx)** for editable native shapes, attached connectors, one page per constellation/view, and a catalog page. Choose **Visio stencil (.vssx)** for reusable catalog shapes. Star, flow, appearance, provenance and revision metadata are included as Shape Data; public exports apply the existing redaction rules before writing either format.

Generate the supplied 17-star package with `npm run visio:package`. The ZIP in `output/Computation-Constellations-Visio-Package.zip` includes the master and two examples, the 17-master stencil, an app-editable draw.io backup, walkthrough and opening instructions. Extract it and open the VSDX in desktop Visio; open the VSSX as a stencil.

This is one-way export: the app cannot reimport Visio edits. Container relationships and walkthrough/review records remain metadata rather than executable Visio behavior. Visio does not enforce this app's governance rules. Keep the draw.io file as the app-editable backup.

Validation: 22 automated tests passed. An independent libvisio 0.1.11 reader parsed and rendered all four drawing pages and all 17 stencil masters. ZIP integrity, XML and internal relationship targets were checked. Microsoft Visio itself was unavailable on this Mac, so opening/editing there remains unverified.
