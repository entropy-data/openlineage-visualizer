import React from 'react';
import IntegrationIcon from './IntegrationIcon';

function formatArchetype(archetype) {
  if (!archetype) return 'DATA PRODUCT';
  const cleaned = archetype.replace(/[-_]/g, ' ').toUpperCase();
  return `DATA PRODUCT (${cleaned})`;
}

export default function ProductGroupNode({ data }) {
  const stripe = data.color?.stripe || '#94a3b8';
  const tint = data.color?.chipBg || '#f1f5f9';
  const labelText = data.color?.chipText || '#475569';
  const info = data.info || {};
  const name = info.name || data.externalId;
  return (
    <div
      className="ol-product-group"
      style={{
        borderColor: stripe,
      }}
    >
      <div
        className="ol-product-group-band"
        style={{ backgroundColor: tint, color: labelText, borderBottomColor: stripe }}
      >
        {formatArchetype(info.archetype)}
      </div>
      <div className="ol-product-group-header">
        {info.icon && (
          <IntegrationIcon name={info.icon} size={20} color={stripe} />
        )}
        <div className="ol-product-group-titles">
          <div className="ol-product-group-name">{name}</div>
          {info.teamName && (
            <div className="ol-product-group-team">{info.teamName}</div>
          )}
        </div>
      </div>
    </div>
  );
}
