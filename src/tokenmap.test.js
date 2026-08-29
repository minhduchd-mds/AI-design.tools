import assert from 'node:assert/strict';
import test from 'node:test';

import {
  mapDesignTokens,
  normalizeTokenType,
  scoreTokenMatch,
  tokenizeTokenName,
  valueSimilarity,
} from './tokenmap.js';

test('normalizes common Figma token type aliases', () => {
  assert.equal(normalizeTokenType('fill'), 'color');
  assert.equal(normalizeTokenType('spacing'), 'dimension');
});

test('splits camelCase and slash-separated token names', () => {
  assert.deepEqual(tokenizeTokenName('Button/PrimaryBackground'), [
    'button',
    'primary',
    'background',
  ]);
});

test('recognizes identical colors independent of hex shorthand', () => {
  assert.ok(valueSimilarity('color', '#fff', '#ffffff') > 0.99);
});

test('prefers semantic and value agreement over name-only coincidence', () => {
  const candidate = {
    id: 'source-1',
    name: 'Button / Primary / Background',
    type: 'color',
    value: '#e31b23',
    usageCount: 18,
  };

  const strong = scoreTokenMatch(candidate, {
    path: 'component.button.primary.background',
    type: 'color',
    value: '#e31b23',
  });
  const weak = scoreTokenMatch(candidate, {
    path: 'component.button.primary.background',
    type: 'color',
    value: '#222222',
  });

  assert.ok(strong.score > weak.score);
});

test('marks close top candidates as ambiguous instead of inventing certainty', () => {
  const result = mapDesignTokens(
    [
      {
        id: 'source-1',
        name: 'brand primary',
        type: 'color',
        value: '#ff0000',
        usageCount: 4,
      },
    ],
    [
      { path: 'brand.primary', type: 'color', value: '#ff0000' },
      { path: 'brand.primary.alt', type: 'color', value: '#ff0000' },
    ],
    { ambiguityGap: 0.2 },
  )[0];

  assert.equal(result.accepted, false);
  assert.equal(result.status, 'ambiguous');
});
