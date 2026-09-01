# AI Design Tools

## About

**AI Design Tools** is a design-transformation and design-token intelligence workspace for Figma-oriented workflows. The repository focuses on turning heterogeneous design inputs into a normalized, explainable representation that can be inspected, matched, transformed and exported without coupling core logic to one UI or one vendor format.

The current vNext direction is to become a reusable **Tool Plane** for design agents: deterministic conversion and analysis capabilities exposed through stable internal APIs and, later, MCP-compatible tools.

## What it does

- Design asset / document conversion workflows.
- Figma-oriented parsing and export support.
- Semantic design-token matching with explainable scores.
- Name, type, value and usage-based token evidence.
- Perceptual color comparison using documented Oklab math.
- Ambiguity reporting instead of silently choosing weak matches.
- Progressive migration away from vendored/minified PDF dependencies.

## Architecture direction

```text
Input sources
  ↓
Parsers / adapters
  ↓
Normalized Design IR
  ↓
Geometry + token intelligence + validation
  ↓
Transform / export adapters
  ↓
Figma / HTML / assets / agent tools
```

Target package boundaries are documented in [`docs/architecture/VNEXT.md`](docs/architecture/VNEXT.md).

## Token intelligence

The first repository-owned vNext algorithm lives in `src/tokenmap.js`.

It combines:

- normalized token names;
- semantic type compatibility;
- perceptual value similarity;
- usage evidence;
- deterministic ranking;
- confidence / ambiguity states.

The matcher is intentionally explainable and does not copy implementation code from commercial design-token products.

## Tech stack

- Node.js 20.19+
- Vite
- Express
- Figma Plugin typings
- Node built-in test runner

## Quick start

```bash
npm install
npm test
npm run build
npm run dev
```

Run the full verification gate:

```bash
npm run check
```

## Repository structure

```text
src/                    application and transformation code
src/tokenmap.js         semantic token matcher
src/*.test.js           invariant tests
docs/architecture/      architecture direction
docs/SOURCE_PROVENANCE.md
.claude/                repo-specific planner/reviewer commands
```

## Documentation

- [vNext architecture](docs/architecture/VNEXT.md)
- [Source provenance](docs/SOURCE_PROVENANCE.md)
- [`CLAUDE.md`](CLAUDE.md) — repository operating contract for agent-assisted work

## Roadmap

1. Stabilize a format-neutral Design IR.
2. Move PDF tooling from vendored artifacts to pinned package-managed dependencies.
3. Add geometry grouping and hierarchy inference behind pure APIs.
4. Add responsive-layout inference with confidence/evidence output.
5. Expose safe transformation capabilities through MCP-compatible tools.
6. Keep exporters isolated so vendor changes do not leak into domain logic.

## Provenance and license

New algorithms and agent instructions are written specifically for this repository. Mathematical primitives and third-party libraries are credited in [`docs/SOURCE_PROVENANCE.md`](docs/SOURCE_PROVENANCE.md).

Package metadata currently declares the project license as **ISC**. Vendored or third-party artifacts retain their own upstream license obligations.
