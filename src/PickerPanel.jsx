import React, { useMemo, useState } from 'react';

const MAX_SELECTED = 10;

export default function PickerPanel({
  items,
  selected,
  onToggle,
  pinnedExternalId,
  productColorMap,
  productStatuses,
  onHoverProduct,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? items.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.externalId.toLowerCase().includes(q),
        )
      : items;
    return [...list].sort((a, b) => {
      // Pinned current product is always first.
      if (a.externalId === pinnedExternalId) return -1;
      if (b.externalId === pinnedExternalId) return 1;
      // Lineage-bearing products next.
      const aHas = (a.eventCount || 0) > 0;
      const bHas = (b.eventCount || 0) > 0;
      if (aHas !== bHas) return aHas ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [items, search, pinnedExternalId]);

  const atCap = selected.size >= MAX_SELECTED;

  if (collapsed) {
    return (
      <div className="ol-picker ol-picker--collapsed">
        <button
          className="ol-picker-toggle"
          onClick={() => setCollapsed(false)}
          title="Show data products"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="ol-picker">
      <div className="ol-picker-header">
        <span className="ol-picker-title">Data Products</span>
        <button
          className="ol-picker-toggle"
          onClick={() => setCollapsed(true)}
          title="Collapse"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>
      <div className="ol-picker-search">
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {atCap && (
        <div className="ol-picker-cap">
          Maximum {MAX_SELECTED} products selected
        </div>
      )}
      <div className="ol-picker-list">
        {filtered.map((p) => {
          const isPinned = p.externalId === pinnedExternalId;
          const isSelected = selected.has(p.externalId);
          const hasLineage = (p.eventCount || 0) > 0;
          const accessible = p.accessible !== false;
          const status = productStatuses?.get(p.externalId);
          const color = productColorMap?.get(p.externalId);
          const disabled = !isSelected && atCap;

          const onClick = () => {
            if (isPinned) return;
            if (disabled) return;
            onToggle(p.externalId);
          };

          const cls = [
            'ol-picker-row',
            isSelected ? 'ol-picker-row--selected' : '',
            isPinned ? 'ol-picker-row--pinned' : '',
            !hasLineage ? 'ol-picker-row--dimmed' : '',
            disabled ? 'ol-picker-row--disabled' : '',
          ].filter(Boolean).join(' ');

          return (
            <label
              key={p.externalId}
              className={cls}
              onMouseEnter={() => onHoverProduct?.(p.externalId)}
              onMouseLeave={() => onHoverProduct?.(null)}
            >
              <input
                type="checkbox"
                className="ol-picker-checkbox"
                checked={isSelected}
                disabled={isPinned || disabled}
                onChange={onClick}
              />
              <span
                className="ol-picker-swatch"
                style={color ? { backgroundColor: color.stripe } : undefined}
                aria-hidden
              />
              <span className="ol-picker-name" title={p.externalId}>
                {p.name || p.externalId}
              </span>
              <span className="ol-picker-meta">
                {!accessible && <span className="ol-picker-badge ol-picker-badge--locked" title="Restricted">lock</span>}
                {hasLineage && <span className="ol-picker-badge ol-picker-badge--lineage">lineage</span>}
                {status === 'loading' && <span className="ol-picker-spinner" aria-hidden />}
              </span>
            </label>
          );
        })}
        {filtered.length === 0 && (
          <div className="ol-picker-cap" style={{ background: '#f8fafc', color: '#64748b', borderColor: '#e2e8f0' }}>
            No data products
          </div>
        )}
      </div>
    </div>
  );
}
