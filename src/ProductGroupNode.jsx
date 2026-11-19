import React from 'react';
import { useTranslation } from 'react-i18next';
import IntegrationIcon from './IntegrationIcon';

function formatArchetype(archetype) {
  if (!archetype) return 'DATA PRODUCT';
  const cleaned = archetype.replace(/[-_]/g, ' ').toUpperCase();
  return `DATA PRODUCT (${cleaned})`;
}

function formatItemType(assetGroup) {
  const type = assetGroup.jobType || assetGroup.integration || '';
  return type.replace(/[-_]/g, ' ').toUpperCase();
}

// The frame of an item no data product holds: drawn like a data product's, but neutral and dashed, and named
// after the item's asset, which it links to.
function AssetGroupNode({ assetGroup }) {
  const { t } = useTranslation();
  const type = formatItemType(assetGroup);
  return (
    <div className="ol-product-group ol-product-group--asset">
      <div className="ol-product-group-band">
        {type ? `${type} · ${t('group.notAssigned')}` : t('group.notAssigned')}
      </div>
      <div className="ol-product-group-header">
        <div className="ol-product-group-titles">
          {assetGroup.href ? (
            <a className="ol-product-group-name ol-product-group-link nodrag" href={assetGroup.href} target="_top" title={t('job.unassignedHint')}>
              {assetGroup.name}
            </a>
          ) : (
            <div className="ol-product-group-name">{assetGroup.name}</div>
          )}
          <div className="ol-product-group-team">{t('group.notAssignedHint')}</div>
        </div>
      </div>
    </div>
  );
}

export default function ProductGroupNode({ data }) {
  if (data.assetGroup) return <AssetGroupNode assetGroup={data.assetGroup} />;
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
