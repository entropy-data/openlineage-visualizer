import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hiddenNeighbours, expandSelection } from './expand.js';

const products = [
  { externalId: 'orders', downstream: ['profitability', 'cohorts'] },
  { externalId: 'profitability', upstream: ['orders', 'prices'], downstream: ['secret'] },
  { externalId: 'prices', downstream: ['profitability'] },
  { externalId: 'cohorts', upstream: ['orders'] },
];

test('offers only the neighbours of shown products that are not shown yet', () => {
  const m = hiddenNeighbours(products, new Set(['orders', 'profitability']));
  assert.deepEqual(m.get('orders'), { upstream: [], downstream: ['cohorts'] });
  assert.deepEqual(m.get('profitability').upstream, ['prices']);
  assert.equal(m.has('prices'), false);
});

test('leaves out neighbours the list of data products does not hold', () => {
  const m = hiddenNeighbours(products, new Set(['profitability']));
  assert.deepEqual(m.get('profitability').downstream, []);
});

test('adds the neighbours up to the maximum and keeps the set when none fits', () => {
  const selected = new Set(['orders']);
  assert.deepEqual([...expandSelection(selected, ['profitability', 'cohorts'], 2)], ['orders', 'profitability']);
  const full = new Set(['a', 'b']);
  assert.equal(expandSelection(full, ['c'], 2), full);
});
