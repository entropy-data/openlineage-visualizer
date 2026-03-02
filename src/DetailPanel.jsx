import React from 'react';

const STATUS_COLORS = {
  COMPLETE: { bg: '#dcfce7', text: '#15803d' },
  FAIL: { bg: '#fee2e2', text: '#b91c1c' },
  ABORT: { bg: '#fef9c3', text: '#a16207' },
  RUNNING: { bg: '#dbeafe', text: '#1d4ed8' },
};

function ReferenceLink({ label, name, href }) {
  if (!name && !href) return null;
  return (
    <div className="ol-ref-row">
      <span className="ol-ref-label">{label}</span>
      {href ? (
        <a className="ol-ref-link" href={href} target="_top">{name || href}</a>
      ) : (
        <span className="ol-ref-value">{name}</span>
      )}
    </div>
  );
}

function ReferencesSection({ entropyData }) {
  if (!entropyData) return null;
  const refs = [];
  if (entropyData.dataProductId || entropyData.dataProductName) {
    refs.push({ label: 'Data Product', name: entropyData.dataProductName || entropyData.dataProductId, href: entropyData.dataProductHref });
  }
  if (entropyData.outputPortId || entropyData.outputPortName) {
    refs.push({ label: 'Output Port', name: entropyData.outputPortName || entropyData.outputPortId, href: entropyData.outputPortHref });
  }
  if (entropyData.dataContractId || entropyData.dataContractName) {
    refs.push({ label: 'Data Contract', name: entropyData.dataContractName || entropyData.dataContractId, href: entropyData.dataContractHref });
  }
  if (entropyData.assetId || entropyData.assetName) {
    refs.push({ label: 'Asset', name: entropyData.assetName || entropyData.assetId, href: entropyData.assetHref });
  }
  if (refs.length === 0) return null;
  return (
    <div className="ol-detail-section">
      <div className="ol-detail-section-title">References</div>
      <div className="ol-ref-list">
        {refs.map((r, i) => <ReferenceLink key={i} {...r} />)}
      </div>
    </div>
  );
}

function FieldRow({ field, lineage, isSelected, onFieldClick }) {
  const sources = lineage?.inputFields || [];
  const hasLineage = sources.length > 0;

  return (
    <div className={'ol-detail-field' + (isSelected ? ' ol-detail-field--open' : '')}>
      <div
        className={'ol-detail-field-row' + (hasLineage ? ' ol-detail-field-row--clickable' : '')}
        onClick={hasLineage ? () => onFieldClick(field.name) : undefined}
      >
        <div className="ol-detail-field-top">
          <span className="ol-detail-field-name">{field.name}</span>
          {field.type && <span className="ol-detail-field-type-badge">{field.type}</span>}
        </div>
        {field.description && (
          <div className="ol-detail-field-desc">{field.description}</div>
        )}
      </div>
      {isSelected && sources.length > 0 && (
        <div className="ol-detail-field-lineage">
          {sources.map((s, i) => {
            const dsShort = s.name.includes('.') ? s.name.split('.').pop() : s.name;
            return (
              <div key={i} className="ol-detail-field-source">
                <span className="ol-detail-field-source-arrow">&larr;</span>
                <span className="ol-detail-field-source-ds">{dsShort}</span>
                <span className="ol-detail-field-source-dot">.</span>
                <span className="ol-detail-field-source-col">{s.field}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DetailPanel({ node, onClose, selectedColumn, onFieldClick }) {
  if (!node) return null;
  const { data, type } = node;
  const fullName = data.namespace ? `${data.namespace}.${data.name}` : data.name;
  const fields = data.fields || [];

  const isFieldSelected = (fieldName) =>
    selectedColumn && selectedColumn.nodeId === node.id && selectedColumn.fieldName === fieldName;

  return (
    <div className="ol-detail-panel">
      <div className="ol-detail-header">
        <span className="ol-detail-title">{fullName}</span>
        <button className="ol-detail-close" onClick={onClose}>&times;</button>
      </div>

      {type === 'job' && (
        <>
          <div className="ol-detail-badges">
            {data.status && (() => {
              const c = STATUS_COLORS[data.status] || STATUS_COLORS.RUNNING;
              return <span className="ol-badge" style={{ backgroundColor: c.bg, color: c.text }}>{data.status}</span>;
            })()}
            {data.integration && <span className="ol-badge ol-badge-gray">{data.integration}</span>}
            {data.jobType && <span className="ol-badge ol-badge-gray">{data.jobType}</span>}
            {data.processingType && <span className="ol-badge ol-badge-gray">{data.processingType}</span>}
          </div>
          <ReferencesSection entropyData={data.entropyData} />
          {data.sql && (
            <div className="ol-detail-section">
              <div className="ol-detail-section-title">SQL</div>
              <pre className="ol-detail-sql">{data.sql}</pre>
            </div>
          )}
        </>
      )}

      {type === 'dataset' && (
        <>
          {fields.length > 0 && (
            <div className="ol-detail-meta">
              <span className="ol-detail-meta-label">FIELDS</span>
              <span className="ol-detail-meta-value">{fields.length} columns</span>
            </div>
          )}
          <ReferencesSection entropyData={data.entropyData} />
          {fields.length > 0 && (
            <div className="ol-detail-section">
              <div className="ol-detail-section-title">Schema</div>
              <div className="ol-detail-fields">
                {fields.map((f, i) => (
                  <FieldRow
                    key={i}
                    field={f}
                    lineage={(data.columnLineage || {})[f.name]}
                    isSelected={isFieldSelected(f.name)}
                    onFieldClick={(fieldName) => onFieldClick(node.id, fieldName)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
