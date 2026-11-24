# Verification receipt

This receipt distinguishes automated behavior checks from external certification.

## Automated

- `npm run check`: application module syntax passes.
- `npm test`: 11 model tests pass, including quota-failure preservation and redaction checks against editable XML, SVG, text, and retained semantic data.
- `/tests/browser.html`: 15 browser-native checks pass, including full three-case export/import, nested views, pinned historical catalogs, unknown safe metadata, redacted round trip, entity/script/active-link/prototype/compressed/oversized input rejection endpoint conflict rejection, and responsive layouts at 1440 px and 390 px.

## UI exercised

- Application loads with three synthetic examples and no structural errors.
- Keyboard Enter creates a repeated record-store appearance with a distinct identity.
- Inspector edits update its local label while preserving the shared catalog definition.
- Switching use cases restores their independent diagrams.
- A grouped appearance opens its nested view; Parent returns to the parent architecture.
- Explain mode advances to a nested-view step and disables inspector editing.

- Arrow-key movement updates the selected appearance and persists after reload.
- Connector operation metadata is inspectable and editable without losing endpoints.
- A synthetic QA review changes documentation status while leaving implementation unverified; restoring a prior revision returns a draft.
- Actual file-picker import displays structural counts, semantic comparison, and a SHA-256 source hash; accepting the synthetic file persists it as a draft.
- Browser console inspection found no errors or warnings in the verified app session.
- Responsive checks confirm rendered diagrams, appropriate navigation placement, and no page-level horizontal overflow at 1440 px and 390 px.

## Limits

- draw.io Desktop is not installed and external-editor preservation has not been certified.
- No comparative human usability study or numerical usefulness claim.
- No third-party security certification or multi-user authorization assessment.
- Local storage and recovery are editable browser data, not a tamper-proof audit system.
- Native metadata occupies a hidden CC metadata layer; private exports are not redacted merely because that layer is hidden.


## 2026-11-10 governance update

- Syntax checks passed; 16/16 Node model tests passed, including exact-revision review binding, AI origin preservation, content/dependency hashing, fresh child lineage, legacy migration, and rejection of forged local finalization claims.
- Browser-native codec/security/responsive suite: 15/15 passed in the in-app browser.
- Isolated preview: opened Review & release, recorded a test approval claim, reopened review and confirmed the record, unchanged `1.1.AI` label, and blocked finalization. User browser workspace was not modified.
- Playwright CLI could not fetch its package because registry DNS was unavailable; verification used the built-in browser instead.
- Successful authenticated human finalization and an authoritative service remain outside this local implementation. No external editor certification or independent security audit was performed.

## 2026-11-10 reference master version

- 17 model tests and 16 browser-native checks pass, including 17-star XML round trip, expanded bounds, observation connectors and isolated case edits.
- In-app browser verified the candidate master at `/?master=1`: 17 active components, 31 proposed relationships, source/provenance inspector and ACDS metadata. Original browser save uses a separate namespace.
- Editable, SVG and text snapshots are in `output/master17/`. Relationship geometry is a plausible authoring layout, not a pixel-exact tracing. Group members remain unspecified pending a concrete use case.

## 2026-11-13 standalone desktop release 0.2.0

- Built portable Windows x64 ZIP, Linux x64 tar.gz, macOS arm64 ZIP and macOS x64 ZIP with Electron 45.3.2 / electron-builder 26.18.0. All start at the 17-star workspace.
- Syntax checks and all 17 model tests passed.
- Development Electron smoke test and final packaged arm64 and x64 Mac smoke tests passed. Intel package ran through the host's compatibility runtime. Tests verify rendered 17 stars, three cases, XML round trip, local storage after reload, secure context and no renderer Node exposure.
- Final Mac bundles pass `codesign --verify --deep --strict` with ad-hoc signatures. No publisher signature or notarization is claimed.
- Windows and Linux bundled executables have the expected PE x64 / ELF x64 architecture. Every platform's ASAR contains the master seed and the 17-star startup URL. Windows and Linux have not been launch-tested on their target systems.
- Archive integrity checks and SHA-256 manifest accompany artifacts in `dist/`. Browser edits are migrated explicitly through editable export/import; this app uses its own profile. Original browser storage is unchanged.


## Visio export, 0.3.0

- 22 Node tests pass, including native page/connector structure, 17 stencil masters, redaction, text escaping and rejection of dangling endpoints.
- Independent ZIP CRC, XML and relationship-target checks pass.
- libvisio 0.1.11 parses and renders four drawing pages and 17 stencil masters; rendered drawing inspected visually.
- Microsoft Visio is unavailable on this host; native Microsoft opening/editing is not certified.
- Browser export-menu interaction could not be completed because the preview browser refused the localhost connection. Export generation is covered by Node and packaged runtime checks.
