# Source provenance and copyright policy

AI Design Tools separates **third-party/vendor code** from **repository-owned algorithms**.

## Clean implementation rules

1. Learn architecture and API behavior from standards, official docs, papers, and permissively licensed projects; do not paste implementation code into product logic.
2. Any vendored/adapted source must record upstream project, version/revision, license, required notices, and modifications.
3. Core algorithms start from a written specification and tests, then are implemented independently.
4. Prefer package-managed dependencies over checked-in minified bundles so version/license inventory is auditable.
5. AI-generated code is reviewed under the same rules.

## Existing third-party/vendor inventory

| Repository file | Upstream | Observed version | License | Status |
| --- | --- | --- | --- | --- |
| `src/jspdf.min.js` | jsPDF / parallax/jsPDF | 2.5.1 | MIT | Existing vendored bundle. The file contains its upstream `@license` copyright header. Keep that notice intact until migrated to an npm dependency. |
| `src/pdf.worker.min.js` | Expected PDF.js worker; exact embedded version must be confirmed before release | unknown | PDF.js upstream is Apache-2.0 | Treat as unverified vendor artifact. Do not claim repository authorship. Migrate to a pinned `pdfjs-dist` package before production release. |

Official upstream references:

- jsPDF: https://github.com/parallax/jsPDF — MIT.
- Mozilla PDF.js: https://github.com/mozilla/pdf.js — Apache-2.0.

## Mathematical reference used by token matching

`src/tokenmap.js` converts sRGB values to Oklab for perceptual color distance. The Oklab transform and matrices are from Björn Ottosson's public specification:

- https://bottosson.github.io/posts/oklab/

The author explicitly publishes the conversion code as public domain, with MIT also available. The repository uses the published mathematical transform as a color-space primitive; **the token matching/ranking algorithm, weights, ambiguity handling, name scoring, usage saturation, and explainability model are original repository logic**.

## Repository-owned algorithm

`src/tokenmap.js` implements a semantic design-token matcher with:

- normalized token-type compatibility;
- Unicode/camel/path-aware semantic name tokenization;
- Jaccard + ordered prefix/suffix name evidence;
- Oklab color-value similarity or symmetric numeric similarity;
- bounded usage-frequency evidence;
- deterministic ranking;
- explicit low-confidence and ambiguity states rather than forced matches.

No token-matching implementation was copied from Style Dictionary, Tokens Studio, Figma, Specify, Supernova, or another design-system product.
