// Expanding a data product's frame in the lineage view: which neighbours are not shown yet, and the selection that
// adding them makes.

// Per shown product, its upstream and downstream neighbours that are not shown yet. Only those `dataProducts` lists:
// the host leaves out the data products the user may not see.
export function hiddenNeighbours(dataProducts, selected) {
  const known = new Set(dataProducts.map((p) => p.externalId));
  const hidden = (ids) => (ids || []).filter((id) => known.has(id) && !selected.has(id));
  const m = new Map();
  for (const p of dataProducts) {
    if (!selected.has(p.externalId)) continue;
    m.set(p.externalId, { upstream: hidden(p.upstream), downstream: hidden(p.downstream) });
  }
  return m;
}

// The selection with `externalIds` added, as many as fit under `max`; the same set when none was added.
export function expandSelection(selected, externalIds, max) {
  const next = new Set(selected);
  for (const id of externalIds) {
    if (next.size >= max) break;
    next.add(id);
  }
  return next.size === selected.size ? selected : next;
}
