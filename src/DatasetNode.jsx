import React from 'react';
import { Handle, Position } from '@xyflow/react';

export default function DatasetNode({ data }) {
  const fields = data.fields || [];
  const displayName = data.name.includes('.') ? data.name.split('.').pop() : data.name;
  const fullName = data.namespace ? `${data.namespace} / ${data.name}` : data.name;
  const collapsed = data.collapsed;
  const highlightedFields = data.highlightedFields;
  const dimmed = data.dimmed;

  const onChevronClick = (e) => {
    e.stopPropagation();
    data.onToggleCollapse?.();
  };

  return (
    <div className={`ol-node ol-dataset-node${dimmed ? ' ol-node--dimmed' : ''}${highlightedFields ? ' ol-node--in-lineage' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="ol-node-header">
        <div className="ol-node-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
            <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
          </svg>
        </div>
        <span className="ol-node-title" title={fullName}>{displayName}</span>
        {fields.length > 0 && (
          <span className="ol-badge ol-badge-gray">{fields.length}</span>
        )}
        {fields.length > 0 && !highlightedFields && (
          <button className="ol-collapse-btn" onClick={onChevronClick}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.15s' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        )}
      </div>
      {!collapsed && fields.length > 0 && (
        <div className="ol-field-list">
          {fields.map((f, i) => {
            const hl = highlightedFields?.has(f.name);
            const fieldDimmed = highlightedFields && !hl;
            return (
              <div key={i} className={`ol-field-row${hl ? ' ol-field-row--hl' : ''}${fieldDimmed ? ' ol-field-row--dimmed' : ''}`}>
                <span className="ol-field-name">{f.name}</span>
                {f.type && <span className="ol-field-type">{f.type}</span>}
              </div>
            );
          })}
        </div>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
