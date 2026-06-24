import React from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import App from './App';
import MultiApp from './MultiApp';
import i18n from './i18n';
import { parseResponse } from './lineage';
import './index.css';

// Apply a host-supplied locale (it wins); when absent the detector configured in
// ./i18n resolves the language (?lang / localStorage / navigator). See src/i18n.
function applyLocale(locale) {
  if (locale) i18n.changeLanguage(locale);
}

// ---- Single-mode (auto-mount) ----------------------------------------------
// Backwards-compatible: the embedded preview on the data product details page
// renders a single product's lineage by setting data-json-url on the container.

function mountSingle(container) {
  const jsonUrl = container.dataset.jsonUrl;
  const height = container.dataset.height || '400px';
  if (!jsonUrl) return;

  fetch(jsonUrl, { credentials: 'same-origin' })
    .then((res) => res.text())
    .then((text) => {
      const data = parseResponse(text);
      if (!data.graph || data.graph.length === 0) return;
      container.style.height = height;
      applyLocale(container.dataset.locale);
      createRoot(container).render(
        <I18nextProvider i18n={i18n}>
          <App graphData={data} />
        </I18nextProvider>,
      );
    })
    .catch((err) => console.error('OpenLineage visualizer fetch error:', err));
}

function autoMount() {
  const container = document.getElementById('openlineage-visualizer');
  if (!container) return;
  // Multi-mode is initialised explicitly via `init(config)`; auto-mount only
  // handles the single-mode embed via data-json-url.
  if (!container.dataset.jsonUrl) return;
  mountSingle(container);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoMount);
} else {
  autoMount();
}

document.addEventListener('htmx:load', autoMount);

// ---- init(config) ----------------------------------------------------------
// Explicit initialiser used by the multi-product expanded page. Mirrors the
// datacontract-editor embed pattern: lookup data is passed in as `dataProducts`
// and per-product events are fetched through the `loadEvents` function or
// `eventsEndpoint` URL template.

const DEFAULTS = {
  container: '#openlineage-visualizer',
  mode: 'multi',
  dataProducts: [],
  currentProductExternalId: null,
  initialProducts: [],
  loadEvents: null,
  eventsEndpoint: null,
  height: 'calc(100vh - 44px)',
  locale: null,
};

function resolveContainer(target) {
  if (typeof target === 'string') {
    const el = document.querySelector(target);
    if (!el) throw new Error(`OpenLineage visualizer: container not found: ${target}`);
    return el;
  }
  if (target instanceof HTMLElement) return target;
  throw new Error('OpenLineage visualizer: container must be a selector string or HTMLElement');
}

function defaultLoadEvents(eventsEndpoint) {
  return (externalId, { signal } = {}) => {
    const url = eventsEndpoint.includes('{externalId}')
      ? eventsEndpoint.replace('{externalId}', encodeURIComponent(externalId))
      : `${eventsEndpoint}?productExternalId=${encodeURIComponent(externalId)}`;
    return fetch(url, { credentials: 'same-origin', signal })
      .then((res) => res.json());
  };
}

export function init(userConfig = {}) {
  const config = { ...DEFAULTS, ...userConfig };
  const container = resolveContainer(config.container);

  if (config.mode !== 'multi') {
    throw new Error(`OpenLineage visualizer: unsupported mode "${config.mode}"`);
  }
  const loadEvents = config.loadEvents || (config.eventsEndpoint ? defaultLoadEvents(config.eventsEndpoint) : null);
  if (!loadEvents) {
    throw new Error('OpenLineage visualizer: init() requires either loadEvents or eventsEndpoint');
  }

  container.style.height = config.height;
  applyLocale(config.locale);
  const root = createRoot(container);
  root.render(
    <I18nextProvider i18n={i18n}>
      <MultiApp
        dataProducts={config.dataProducts}
        currentProductExternalId={config.currentProductExternalId}
        initialProducts={config.initialProducts}
        loadEvents={loadEvents}
      />
    </I18nextProvider>,
  );

  return {
    destroy() {
      root.unmount();
    },
  };
}
