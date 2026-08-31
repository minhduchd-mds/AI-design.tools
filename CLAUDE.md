# AI-design.tools Agent Operating Contract

## Product role
AI-design.tools is the design transformation/tool plane: parse and normalize design inputs into a format-neutral Design IR, extract/compare tokens, analyze geometry/typography/assets, validate transformations, and expose reusable capabilities to other products/agents.

## Workflow
1. Define/extend Design IR before adding format-specific branches.
2. Keep parsers/exporters as adapters around deterministic core transforms.
3. Token matching must expose evidence, score, alternatives, and ambiguity.
4. Mathematical/color standards are credited; repository-owned logic is the composition/ranking around them.
5. Prefer pinned package dependencies over unverified vendored minified binaries.
6. Add invariant tests for transformations before wiring UI.
7. Keep product orchestration and conversational agent logic outside this repo.

## Product direction
source parser -> Design IR -> normalization/intelligence -> validation -> exporter/MCP tool.

## Provenance
Never remove upstream license notices. Record exact source/version/license for vendored or adapted code. Prefer clean-room implementations for hierarchy inference, responsive inference, geometry grouping, and token matching.
