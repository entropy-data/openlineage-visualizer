import React from 'react';
import { Handle, Position } from '@xyflow/react';

const STATUS_COLORS = {
  COMPLETE: { bg: '#dcfce7', text: '#15803d' },
  FAIL: { bg: '#fee2e2', text: '#b91c1c' },
  ABORT: { bg: '#fef9c3', text: '#a16207' },
  RUNNING: { bg: '#dbeafe', text: '#1d4ed8' },
};

export default function JobNode({ data }) {
  const statusColor = STATUS_COLORS[data.status] || STATUS_COLORS.RUNNING;
  const displayName = data.name.includes('.') ? data.name.split('.').pop() : data.name;

  return (
    <div className={`ol-node ol-job-node${data.dimmed ? ' ol-node--dimmed' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="ol-node-header">
        <div className="ol-node-icon ol-job-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <span className="ol-node-title" title={`${data.namespace}/${data.name}`}>{displayName}</span>
      </div>
      <div className="ol-job-meta">
        {data.status && (
          <span
            className="ol-badge"
            style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
          >
            {data.status}
          </span>
        )}
        {data.integration && <span className="ol-badge ol-badge-gray">{data.integration}</span>}
        {data.jobType && <span className="ol-badge ol-badge-gray">{data.jobType}</span>}
        {data.processingType && <span className="ol-badge ol-badge-gray">{data.processingType}</span>}
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  );
}
