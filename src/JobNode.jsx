import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { ProductChipRow } from './ProductChip';
import { PlatformIcon } from './IntegrationIcon';
import { jobDisplayOf } from './naming';

const JOB_GLYPH = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2L2 7l10 5 10-5-10-5z" />
    <path d="M2 17l10 5 10-5" />
    <path d="M2 12l10 5 10-5" />
  </svg>
);

const STATUS_COLORS = {
  COMPLETE: { bg: '#dcfce7', text: '#15803d' },
  FAIL: { bg: '#fee2e2', text: '#b91c1c' },
  ABORT: { bg: '#fef9c3', text: '#a16207' },
  RUNNING: { bg: '#dbeafe', text: '#1d4ed8' },
};

export default function JobNode({ data }) {
  const statusColor = STATUS_COLORS[data.status] || STATUS_COLORS.RUNNING;
  const { label, platform, fullName } = jobDisplayOf(data);
  const scoping = data.productScoping;
  const stripeColor = scoping?.primary?.color?.stripe;

  return (
    <div
      className={`ol-node ol-job-node${data.unassigned ? ' ol-job-node--unassigned' : ''}${data.dimmed ? ' ol-node--dimmed' : ''}${stripeColor ? ' ol-node--has-stripe' : ''}`}
      style={stripeColor ? { borderLeftColor: stripeColor } : undefined}
    >
      <Handle type="target" position={Position.Left} />
      <div className="ol-node-header">
        <div className="ol-node-icon ol-job-icon">
          <PlatformIcon platform={platform} fallback={JOB_GLYPH} />
        </div>
        <span className="ol-node-title" title={fullName}>{label}</span>
      </div>
      <ProductChipRow scoping={scoping} />
      <div className="ol-job-meta">
        {data.status && (
          <span
            className="ol-badge"
            style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
          >
            {data.status}
          </span>
        )}
        {platform && <span className="ol-badge ol-badge-gray" title={data.integration}>{platform.label}</span>}
        {data.jobType && <span className="ol-badge ol-badge-gray">{data.jobType}</span>}
        {data.processingType && <span className="ol-badge ol-badge-gray">{data.processingType}</span>}
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  );
}
