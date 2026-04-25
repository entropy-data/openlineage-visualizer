import React from 'react';

// Tiny set of monochrome glyphs for the integration-icon strings the picker
// surfaces. Anything not in this map falls back to a monogram circle, and
// strings that look like URLs render as <img>.
const PATHS = {
  snowflake: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M12 2v20" />
      <path d="M2 12h20" />
      <path d="M4.6 4.6l14.8 14.8" />
      <path d="M19.4 4.6L4.6 19.4" />
      <path d="M9 4l3 2 3-2" />
      <path d="M9 20l3-2 3 2" />
      <path d="M4 9l2 3-2 3" />
      <path d="M20 9l-2 3 2 3" />
    </g>
  ),
  databricks: (
    <g fill="currentColor">
      <path d="M3 17l9 4 9-4-9-4z" fillOpacity="0.85" />
      <path d="M3 13l9 4 9-4-9-4z" fillOpacity="0.55" />
      <path d="M3 9l9 4 9-4-9-4z" fillOpacity="0.3" />
    </g>
  ),
  kafka: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="6" cy="12" r="2" fill="currentColor" />
      <circle cx="18" cy="6" r="2" fill="currentColor" />
      <circle cx="18" cy="18" r="2" fill="currentColor" />
      <path d="M8 11l8-4" />
      <path d="M8 13l8 4" />
    </g>
  ),
  bigquery: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M12 3l9 5v8l-9 5-9-5V8z" />
      <path d="M3 8l9 5 9-5" />
      <path d="M12 13v8" />
    </g>
  ),
  powerbi: (
    <g fill="currentColor">
      <rect x="4" y="13" width="3" height="8" rx="0.5" />
      <rect x="9.5" y="9" width="3" height="12" rx="0.5" />
      <rect x="15" y="5" width="3" height="16" rx="0.5" />
    </g>
  ),
  'google-analytics': (
    <g fill="currentColor">
      <rect x="4" y="14" width="4" height="7" rx="2" fillOpacity="0.5" />
      <rect x="10" y="9" width="4" height="12" rx="2" fillOpacity="0.7" />
      <rect x="16" y="3" width="4" height="18" rx="2" />
    </g>
  ),
  'google-looker': (
    <g fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </g>
  ),
  openapi: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="3.5" />
      <path d="M5 12h2" /><path d="M17 12h2" />
      <path d="M12 5v2" /><path d="M12 17v2" />
      <path d="M7.2 7.2l1.4 1.4" /><path d="M15.4 15.4l1.4 1.4" />
      <path d="M16.8 7.2l-1.4 1.4" /><path d="M8.6 15.4l-1.4 1.4" />
    </g>
  ),
  dbt: (
    <g fill="currentColor">
      <path d="M4 9 L12 4 L20 9 L20 15 L12 20 L4 15 Z" fillOpacity="0.85" />
    </g>
  ),
};

function Monogram({ size, name, color }) {
  const letter = (name || '?').charAt(0).toUpperCase();
  return (
    <span
      className="ol-integration-monogram"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.7),
        color: color || '#475569',
      }}
    >
      {letter}
    </span>
  );
}

export default function IntegrationIcon({ name, size = 14, color }) {
  if (!name) return null;
  // Render as <img> for absolute http(s) URLs and same-origin paths
  // (e.g. "/assets/media/icons/snowflake.svg") so the host app can supply
  // its own icon set rather than the inline glyphs below.
  if (/^https?:\/\//i.test(name) || name.startsWith('/')) {
    return (
      <img
        src={name}
        width={size}
        height={size}
        alt=""
        style={{ display: 'inline-block', objectFit: 'contain', flexShrink: 0 }}
      />
    );
  }
  const path = PATHS[name];
  if (!path) return <Monogram size={size} name={name} color={color} />;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ color: color || 'currentColor', flexShrink: 0, display: 'inline-block' }}
    >
      {path}
    </svg>
  );
}
