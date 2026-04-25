import React from 'react';
import IntegrationIcon from './IntegrationIcon';

export default function ProductChip({ entry, secondaryCount = 0, secondaryTooltip = '' }) {
  if (!entry) return null;
  const { color, info, externalId } = entry;
  const label = info?.name || externalId || 'unknown';
  const style = color
    ? { backgroundColor: color.chipBg, color: color.chipText }
    : { backgroundColor: '#f3f4f6', color: '#374151' };
  return (
    <span className="ol-product-chip" style={style} title={label}>
      {info?.icon && (
        <IntegrationIcon name={info.icon} size={12} color={color?.chipText || '#475569'} />
      )}
      <span className="ol-product-chip-label">{label}</span>
      {secondaryCount > 0 && (
        <span className="ol-product-chip-extra" title={secondaryTooltip}>
          +{secondaryCount}
        </span>
      )}
    </span>
  );
}

export function ProductChipRow({ scoping }) {
  if (!scoping) return null;
  const primary = scoping.primary;
  if (!primary) return null;
  const consumers = scoping.consumers || [];
  const tooltip = consumers.map((c) => c.info?.name || c.externalId).join(', ');
  return (
    <div className="ol-product-chip-row">
      <ProductChip
        entry={primary}
        secondaryCount={consumers.length}
        secondaryTooltip={tooltip ? `Also referenced by: ${tooltip}` : ''}
      />
    </div>
  );
}
