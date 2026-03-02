import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

function latestRun(events) {
  // Group by parent run ID (or own run ID for top-level jobs)
  const runs = new Map();
  for (const e of events) {
    const parent = e.run?.facets?.parent;
    const prid = parent ? parent.run.runId : e.run.runId;
    if (!runs.has(prid)) runs.set(prid, { latest: e.eventTime, events: [] });
    const run = runs.get(prid);
    run.events.push(e);
    if (e.eventTime > run.latest) run.latest = e.eventTime;
  }
  // Pick the run with the most recent event time
  let best = null;
  for (const run of runs.values()) {
    if (!best || run.latest > best.latest) best = run;
  }
  return best ? best.events : events;
}

function openLineageToGraph(allEvents) {
  const events = latestRun(allEvents);
  const jobs = new Map();
  const datasets = new Map();
  const edges = [];

  for (const event of events) {
    const job = event.job;
    const jobId = `${job.namespace}:${job.name}`;

    const jobFacets = job.facets || {};
    const jt = jobFacets.jobType || {};
    const sql = jobFacets.sql?.query || '';
    const status = event.eventType === 'COMPLETE' ? 'COMPLETE'
      : event.eventType === 'FAIL' ? 'FAIL'
      : event.eventType === 'ABORT' ? 'ABORT' : null;

    // Extract entropy_data run facet
    const runEntropyData = event.run?.facets?.entropy_data;

    if (!jobs.has(jobId)) {
      jobs.set(jobId, {
        id: jobId,
        type: 'JOB',
        data: {
          name: job.name,
          namespace: job.namespace,
          integration: jt.integration,
          jobType: jt.jobType,
          processingType: jt.processingType,
          sql,
          status,
          entropyData: runEntropyData || undefined,
        },
        outEdges: [],
      });
    } else {
      const d = jobs.get(jobId).data;
      if (sql) d.sql = sql;
      if (status) d.status = status;
      if (jt.integration) d.integration = jt.integration;
      if (jt.jobType) d.jobType = jt.jobType;
      if (runEntropyData) d.entropyData = runEntropyData;
    }

    for (const input of event.inputs || []) {
      const dsId = `${input.namespace}:${input.name}`;
      const fields = input.facets?.schema?.fields || [];
      const dsEntropyData = input.facets?.entropy_data;
      if (!datasets.has(dsId)) {
        datasets.set(dsId, {
          id: dsId,
          type: 'DATASET',
          data: { name: input.name, namespace: input.namespace, fields, entropyData: dsEntropyData || undefined },
          outEdges: [],
        });
      } else {
        if (fields.length > 0) datasets.get(dsId).data.fields = fields;
        if (dsEntropyData) datasets.get(dsId).data.entropyData = dsEntropyData;
      }
      datasets.get(dsId).outEdges.push({ origin: dsId, destination: jobId });
    }

    for (const output of event.outputs || []) {
      const dsId = `${output.namespace}:${output.name}`;
      const fields = output.facets?.schema?.fields || [];
      const colLineage = output.facets?.columnLineage?.fields || {};
      const dsEntropyData = output.facets?.entropy_data;
      if (!datasets.has(dsId)) {
        datasets.set(dsId, {
          id: dsId,
          type: 'DATASET',
          data: { name: output.name, namespace: output.namespace, fields, columnLineage: colLineage, entropyData: dsEntropyData || undefined },
          outEdges: [],
        });
      } else {
        const d = datasets.get(dsId).data;
        if (fields.length > 0) d.fields = fields;
        if (Object.keys(colLineage).length > 0) Object.assign(d.columnLineage ||= {}, colLineage);
        if (dsEntropyData) d.entropyData = dsEntropyData;
      }
      jobs.get(jobId).outEdges.push({ origin: jobId, destination: dsId });
    }
  }

  return { graph: [...jobs.values(), ...datasets.values()] };
}

function parseResponse(text) {
  // Try JSON first
  try {
    const data = JSON.parse(text);
    // Already Marquez format
    if (data.graph) return data;
    // Array of OpenLineage events
    if (Array.isArray(data)) return openLineageToGraph(data);
  } catch {
    // NDJSON
  }

  const events = text
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
  return openLineageToGraph(events);
}

function mount() {
  const container = document.getElementById('openlineage-visualizer');
  if (!container) return;

  const jsonUrl = container.dataset.jsonUrl;
  const height = container.dataset.height || '400px';

  if (!jsonUrl) return;

  fetch(jsonUrl, { credentials: 'same-origin' })
    .then((res) => res.text())
    .then((text) => {
      const data = parseResponse(text);
      if (!data.graph || data.graph.length === 0) return;
      container.style.height = height;
      createRoot(container).render(<App graphData={data} />);
    })
    .catch((err) => console.error('OpenLineage visualizer fetch error:', err));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}

// Support htmx partial loads
document.addEventListener('htmx:load', mount);
