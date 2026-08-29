/**
 * Design-token mapping engine.
 *
 * Repository-owned implementation. It does not copy a token matcher from a
 * design-system library. The algorithm is deterministic and explainable:
 * name semantics + type compatibility + value similarity + usage confidence.
 */

const GENERIC_NAME_PARTS = new Set([
  'token',
  'style',
  'styles',
  'variable',
  'variables',
  'value',
]);

function clamp01(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function normalizeTokenType(type) {
  const normalized = String(type ?? '').trim().toLowerCase();
  if (['paint', 'fill', 'stroke', 'colour'].includes(normalized)) return 'color';
  if (['number', 'size', 'spacing', 'radius', 'dimension'].includes(normalized)) return 'dimension';
  if (['font', 'font-size', 'font-weight', 'line-height', 'typography'].includes(normalized)) {
    return 'typography';
  }
  if (['shadow', 'effect'].includes(normalized)) return 'effect';
  if (['bool', 'boolean'].includes(normalized)) return 'boolean';
  if (['string', 'text'].includes(normalized)) return 'string';
  return normalized || 'unknown';
}

/**
 * Normalize human/Figma names into semantic path parts while preserving order.
 * Examples:
 *   "Button/Primary_BG" -> ["button", "primary", "bg"]
 *   "colorBrandPrimary" -> ["color", "brand", "primary"]
 */
export function tokenizeTokenName(name) {
  const expanded = String(name ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();

  if (!expanded) return [];

  return expanded
    .split(/\s+/)
    .filter(Boolean)
    .filter((part) => !GENERIC_NAME_PARTS.has(part));
}

function weightedNameSimilarity(leftName, rightName) {
  const left = tokenizeTokenName(leftName);
  const right = tokenizeTokenName(rightName);
  if (left.length === 0 || right.length === 0) return 0;

  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const intersection = [...leftSet].filter((part) => rightSet.has(part)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  const jaccard = union === 0 ? 0 : intersection / union;

  // Suffixes tend to carry the most specific design-token meaning:
  // e.g. `button.primary.background` and `component/button/primary/bg`.
  let suffixMatches = 0;
  const maxSuffix = Math.min(left.length, right.length);
  while (
    suffixMatches < maxSuffix &&
    left[left.length - 1 - suffixMatches] === right[right.length - 1 - suffixMatches]
  ) {
    suffixMatches += 1;
  }
  const suffixScore = suffixMatches / maxSuffix;

  // Prefix similarity helps preserve taxonomy families without dominating aliases.
  let prefixMatches = 0;
  while (
    prefixMatches < maxSuffix &&
    left[prefixMatches] === right[prefixMatches]
  ) {
    prefixMatches += 1;
  }
  const prefixScore = prefixMatches / maxSuffix;

  return clamp01(0.58 * jaccard + 0.29 * suffixScore + 0.13 * prefixScore);
}

function parseHexColor(value) {
  if (typeof value !== 'string') return null;
  const raw = value.trim().toLowerCase();
  const short = /^#([0-9a-f]{3,4})$/i.exec(raw);
  const long = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(raw);

  if (short) {
    const digits = short[1];
    return {
      r: parseInt(digits[0] + digits[0], 16) / 255,
      g: parseInt(digits[1] + digits[1], 16) / 255,
      b: parseInt(digits[2] + digits[2], 16) / 255,
      a: digits[3] ? parseInt(digits[3] + digits[3], 16) / 255 : 1,
    };
  }

  if (long) {
    return {
      r: parseInt(long[1].slice(0, 2), 16) / 255,
      g: parseInt(long[1].slice(2, 4), 16) / 255,
      b: parseInt(long[1].slice(4, 6), 16) / 255,
      a: long[2] ? parseInt(long[2], 16) / 255 : 1,
    };
  }

  return null;
}

function srgbToLinear(channel) {
  return channel <= 0.04045
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);
}

/** Convert sRGB to OKLab for a perceptually saner color distance. */
function toOklab(color) {
  const r = srgbToLinear(color.r);
  const g = srgbToLinear(color.g);
  const b = srgbToLinear(color.b);

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);

  return {
    l: 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    a: 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    b: 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
    alpha: color.a,
  };
}

function colorValueSimilarity(left, right) {
  const a = parseHexColor(left);
  const b = parseHexColor(right);
  if (!a || !b) return null;

  const labA = toOklab(a);
  const labB = toOklab(b);
  const delta = Math.sqrt(
    Math.pow(labA.l - labB.l, 2) +
      Math.pow(labA.a - labB.a, 2) +
      Math.pow(labA.b - labB.b, 2),
  );
  const alphaDelta = Math.abs(labA.alpha - labB.alpha);

  // Exponential decay avoids a brittle hard threshold while sharply rewarding
  // near-identical colors. Alpha is treated separately because opacity often
  // carries semantic meaning in disabled/overlay tokens.
  return clamp01(Math.exp(-5.2 * delta) * Math.exp(-2.2 * alphaDelta));
}

function numericValueSimilarity(left, right) {
  const a = Number(left);
  const b = Number(right);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a === b) return 1;

  // Symmetric relative distance behaves well for spacing/radius scales.
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return clamp01(1 - Math.abs(a - b) / scale);
}

function primitiveValueSimilarity(left, right) {
  if (left === right) return 1;
  if (typeof left === 'boolean' && typeof right === 'boolean') return 0;
  if (typeof left === 'string' && typeof right === 'string') {
    const a = left.trim().toLowerCase();
    const b = right.trim().toLowerCase();
    if (!a || !b) return 0;
    return a === b ? 1 : 0;
  }
  return null;
}

export function valueSimilarity(type, left, right) {
  const normalizedType = normalizeTokenType(type);
  if (normalizedType === 'color') {
    return colorValueSimilarity(left, right) ?? primitiveValueSimilarity(left, right) ?? 0;
  }
  if (normalizedType === 'dimension' || normalizedType === 'typography') {
    return numericValueSimilarity(left, right) ?? primitiveValueSimilarity(left, right) ?? 0;
  }
  return primitiveValueSimilarity(left, right) ?? 0;
}

function typeCompatibility(candidateType, tokenType) {
  const left = normalizeTokenType(candidateType);
  const right = normalizeTokenType(tokenType);
  if (left === right) return 1;
  if (left === 'unknown' || right === 'unknown') return 0.45;
  return 0;
}

function usageConfidence(usageCount) {
  const count = Math.max(0, Number(usageCount) || 0);
  // Saturates quickly: usage is supporting evidence, never the primary reason.
  return 1 - Math.exp(-count / 8);
}

/**
 * Score one candidate against one design token.
 * Returns a full breakdown so UI can explain the match instead of showing an
 * opaque confidence percentage.
 */
export function scoreTokenMatch(candidate, token) {
  const typeScore = typeCompatibility(candidate.type, token.type);
  if (typeScore === 0) {
    return {
      score: 0,
      nameScore: 0,
      valueScore: 0,
      typeScore: 0,
      usageScore: usageConfidence(candidate.usageCount),
      reasons: ['incompatible token types'],
    };
  }

  const nameScore = weightedNameSimilarity(candidate.name, token.path ?? token.name);
  const valueScore = valueSimilarity(candidate.type, candidate.value, token.value);
  const usageScore = usageConfidence(candidate.usageCount);

  const score = clamp01(
    (0.5 * nameScore + 0.34 * valueScore + 0.11 * typeScore + 0.05 * usageScore) *
      (0.72 + 0.28 * typeScore),
  );

  const reasons = [];
  if (nameScore >= 0.7) reasons.push('strong semantic-name match');
  else if (nameScore >= 0.4) reasons.push('partial semantic-name match');
  if (valueScore >= 0.94) reasons.push('near-identical value');
  else if (valueScore >= 0.7) reasons.push('similar value');
  if (typeScore === 1) reasons.push('same token type');
  if (usageScore >= 0.75) reasons.push('frequently used source style');

  return {
    score: Number(score.toFixed(6)),
    nameScore: Number(nameScore.toFixed(6)),
    valueScore: Number(valueScore.toFixed(6)),
    typeScore: Number(typeScore.toFixed(6)),
    usageScore: Number(usageScore.toFixed(6)),
    reasons,
  };
}

/**
 * Map extracted design styles/variables to the best token candidates.
 * Multiple source styles may intentionally map to one semantic token.
 */
export function mapDesignTokens(candidates, tokens, options = {}) {
  const minimumScore = clamp01(options.minimumScore ?? 0.56);
  const ambiguityGap = clamp01(options.ambiguityGap ?? 0.08);

  return candidates.map((candidate) => {
    const ranked = tokens
      .map((token) => ({ token, ...scoreTokenMatch(candidate, token) }))
      .sort((a, b) => b.score - a.score || String(a.token.path ?? a.token.name).localeCompare(String(b.token.path ?? b.token.name)));

    const best = ranked[0];
    const second = ranked[1];
    const gap = best ? best.score - (second?.score ?? 0) : 0;
    const accepted = Boolean(best && best.score >= minimumScore && gap >= ambiguityGap);

    return {
      candidateId: candidate.id,
      candidateName: candidate.name,
      accepted,
      match: accepted ? best : null,
      alternatives: ranked.slice(0, 3),
      confidence: best?.score ?? 0,
      ambiguityGap: Number(gap.toFixed(6)),
      status: !best
        ? 'no-candidate'
        : best.score < minimumScore
          ? 'low-confidence'
          : gap < ambiguityGap
            ? 'ambiguous'
            : 'matched',
    };
  });
}
