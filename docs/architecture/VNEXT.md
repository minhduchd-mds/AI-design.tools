# AI Design Tools vNext architecture

## Product role

AI Design Tools is a **design conversion and normalization engine**. It should solve bounded transformations such as PDF/image/HTML/design assets → normalized design representation → Figma/design-system output, rather than becoming a generic AI chat surface.

## Target pipeline

```text
Input adapter
  PDF / image / HTML / exported design data
          ↓
Parser / extractor
          ↓
Normalized Design IR
          ↓
Analysis passes
  geometry / typography / color / token inference / hierarchy
          ↓
Validation
          ↓
Output adapters
  Figma / JSON / Design.md / report
```

The **Normalized Design IR** is the architectural center. Input and output formats must not leak through the analysis algorithms.

## Package boundaries

```text
apps/
  plugin/                  Figma UI + controller
  web/                     upload/preview workspace
packages/
  design-ir/               format-neutral nodes, styles, assets
  parsers/                 PDF/image/HTML adapters
  geometry/                grouping and spatial analysis
  token-intelligence/      token extraction/matching
  validation/              invariants, accessibility, limits
  exporters/               Figma/JSON/Design.md adapters
  ui/                      shared interaction primitives
```

Dependency direction:

```text
apps / parsers / exporters
           ↓
       use-cases
           ↓
       design-ir
```

`design-ir` must have no Figma, PDF.js, Express, or renderer dependency.

## Design IR principles

Each node should have a stable schema containing:

- stable source ID;
- geometry in normalized coordinates;
- parent/child relationship;
- semantic role hypothesis;
- text/style references;
- asset references by content hash;
- provenance to source page/object;
- confidence for inferred properties.

Never overwrite observed source facts with an AI guess. Inferred data must live in a separate field with confidence/evidence.

## Original algorithm roadmap

### Token matcher — implemented
`src/tokenmap.js` maps discovered styles/variables to semantic design tokens using explainable multi-signal scoring.

### Geometry grouper
Build a repository-owned spatial grouping algorithm using:

```text
groupScore = overlapAffinity
           + alignmentAffinity
           + spacingRegularity
           + containmentEvidence
           + styleContinuity
           - crossingPenalty
```

Candidate groups are merged only when score gain exceeds a threshold and no hard containment invariant is violated.

### Hierarchy inference
Construct a tree from containment first, then alignment/spacing evidence. Keep source order as a deterministic tie breaker. The algorithm should expose why a node was grouped rather than returning an opaque AI hierarchy.

### Responsive inference
Compare the same normalized layout at multiple widths and classify each property as:

- fixed;
- proportional;
- anchored;
- content-driven;
- wrap/reflow;
- breakpoint-switched.

Fit the simplest model whose residual error stays under tolerance; do not infer a breakpoint when a continuous model explains the observations.

## Backend

The current Express endpoint can remain during migration, but vNext should isolate:

- upload validation;
- job orchestration;
- parser workers;
- artifact storage;
- output/export generation.

Large PDF/image work should leave the request thread and run as bounded jobs. Every job records input hash, parser version, transform version, result hash, duration, warnings, and terminal state.

## Frontend / UX

Use a conversion workspace rather than a landing-page-first flow:

```text
┌ Source/pages ┐ ┌ Preview / overlays ┐ ┌ Structure / tokens / warnings ┐
│ page list    │ │ source + generated │ │ hierarchy                    │
│ assets       │ │ compare             │ │ token matches                │
└──────────────┘ └─────────────────────┘ └──────────────────────────────┘
```

Required UX:

- provenance visible for every inferred object;
- confidence shown as evidence, not decorative percentages;
- ambiguous token mappings require user choice;
- bulk accept only above an explicit confidence policy;
- destructive replacement supports undo;
- page processing is incremental and cancellable;
- large documents display real stage progress.

## Dependency modernization

Do dependency upgrades only after baseline tests exist.

1. Inventory/remove vendored jsPDF/PDF.js bundles in favor of pinned packages.
2. Run current tests/build on the existing Vite line.
3. Upgrade Vite with its official migration guide and verify plugin/runtime behavior.
4. Keep parser libraries behind adapters so future replacements do not change the IR or UI.

## Release gates

- no untracked vendor bundle without license/version provenance;
- unit tests for every repository-owned analysis algorithm;
- fixture-based parser regression tests;
- max-file-size and decompression limits;
- no arbitrary filesystem paths from uploaded content;
- deterministic design-IR snapshots for fixed fixtures;
- keyboard/a11y checks for the plugin and web workspace.
