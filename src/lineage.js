// 10-color palette using Tailwind's named scale (default config).
// Slot 0 is reserved for the pinned/current product.
export const PRODUCT_PALETTE = [
  { name: 'blue',     stripe: '#3b82f6', chipBg: '#dbeafe', chipText: '#1e40af' },
  { name: 'emerald',  stripe: '#10b981', chipBg: '#d1fae5', chipText: '#065f46' },
  { name: 'amber',    stripe: '#f59e0b', chipBg: '#fef3c7', chipText: '#92400e' },
  { name: 'violet',   stripe: '#8b5cf6', chipBg: '#ede9fe', chipText: '#5b21b6' },
  { name: 'rose',     stripe: '#f43f5e', chipBg: '#ffe4e6', chipText: '#9f1239' },
  { name: 'cyan',     stripe: '#06b6d4', chipBg: '#cffafe', chipText: '#155e75' },
  { name: 'orange',   stripe: '#f97316', chipBg: '#ffedd5', chipText: '#9a3412' },
  { name: 'fuchsia',  stripe: '#d946ef', chipBg: '#fae8ff', chipText: '#86198f' },
  { name: 'teal',     stripe: '#14b8a6', chipBg: '#ccfbf1', chipText: '#115e59' },
  { name: 'indigo',   stripe: '#6366f1', chipBg: '#e0e7ff', chipText: '#3730a3' },
];

export const NEUTRAL_COLOR = { stripe: '#9ca3af', chipBg: '#f3f4f6', chipText: '#374151' };

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Stable color slot assigned per externalId. The current product always gets slot 0.
export function buildProductColorMap(productExternalIds, currentProductExternalId) {
  const map = new Map();
  if (currentProductExternalId) map.set(currentProductExternalId, PRODUCT_PALETTE[0]);
  for (const id of productExternalIds) {
    if (map.has(id)) continue;
    const slot = (hashString(id) % (PRODUCT_PALETTE.length - 1)) + 1;
    map.set(id, PRODUCT_PALETTE[slot]);
  }
  return map;
}

// Dedupe re-runs while keeping each distinct job. For every jobId we pick the
// runId with the most recent event and emit only that run's events. This way a
// pipeline of N independent jobs (no parent facet linking them) still surfaces
// all N nodes, while repeated runs of the same job collapse to one.
function latestRun(events) {
  const latestByJob = new Map();
  for (const e of events) {
    const jobId = `${e.job.namespace}:${e.job.name}`;
    const cur = latestByJob.get(jobId);
    if (!cur || e.eventTime > cur.eventTime) {
      latestByJob.set(jobId, { runId: e.run.runId, eventTime: e.eventTime });
    }
  }
  return events.filter((e) => {
    const jobId = `${e.job.namespace}:${e.job.name}`;
    return latestByJob.get(jobId).runId === e.run.runId;
  });
}

// Convert OpenLineage events into the visualizer's internal graph representation.
// `contextProductExternalId` (optional) tags every job/output as produced by that
// product, and every input as consumed by that product, so the multi-product
// merger can attribute scoping later.
export function openLineageToGraph(allEvents, contextProductExternalId = null) {
  const events = latestRun(allEvents);
  const jobs = new Map();
  const datasets = new Map();

  const tag = (entry, role) => {
    if (!contextProductExternalId) return;
    if (role === 'producer') entry.producerProductExternalIds.add(contextProductExternalId);
    else entry.consumerProductExternalIds.add(contextProductExternalId);
  };

  for (const event of events) {
    const job = event.job;
    const jobId = `${job.namespace}:${job.name}`;
    const jobFacets = job.facets || {};
    const jt = jobFacets.jobType || {};
    const sql = jobFacets.sql?.query || '';
    const status = event.eventType === 'COMPLETE' ? 'COMPLETE'
      : event.eventType === 'FAIL' ? 'FAIL'
      : event.eventType === 'ABORT' ? 'ABORT' : null;
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
        producerProductExternalIds: new Set(),
        consumerProductExternalIds: new Set(),
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
    tag(jobs.get(jobId), 'producer');

    for (const input of event.inputs || []) {
      const dsId = `${input.namespace}:${input.name}`;
      const fields = input.facets?.schema?.fields || [];
      const dsEntropyData = input.facets?.entropy_data;
      if (!datasets.has(dsId)) {
        datasets.set(dsId, {
          id: dsId,
          type: 'DATASET',
          data: { name: input.name, namespace: input.namespace, fields, entropyData: dsEntropyData || undefined },
          producerProductExternalIds: new Set(),
          consumerProductExternalIds: new Set(),
          outEdges: [],
        });
      } else {
        const d = datasets.get(dsId).data;
        if (fields.length > 0) d.fields = fields;
        if (dsEntropyData) d.entropyData = dsEntropyData;
      }
      tag(datasets.get(dsId), 'consumer');
      // The dataset's entropy_data facet may declare its owning product even
      // when no event in this fetch produced it (e.g. a source dataset whose
      // own product wasn't selected in the picker).
      const inputOwner = dsEntropyData?.dataProductId;
      if (inputOwner) datasets.get(dsId).producerProductExternalIds.add(inputOwner);
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
          producerProductExternalIds: new Set(),
          consumerProductExternalIds: new Set(),
          outEdges: [],
        });
      } else {
        const d = datasets.get(dsId).data;
        if (fields.length > 0) d.fields = fields;
        if (Object.keys(colLineage).length > 0) Object.assign(d.columnLineage ||= {}, colLineage);
        if (dsEntropyData) d.entropyData = dsEntropyData;
      }
      tag(datasets.get(dsId), 'producer');
      const outputOwner = dsEntropyData?.dataProductId;
      if (outputOwner) datasets.get(dsId).producerProductExternalIds.add(outputOwner);
      jobs.get(jobId).outEdges.push({ origin: jobId, destination: dsId });
    }
  }

  return { graph: [...jobs.values(), ...datasets.values()] };
}

// Merge multiple per-product graphs into a single graph, deduping nodes by id
// (namespace+name) and aggregating producer/consumer product attributions.
export function mergeGraphs(perProductGraphs) {
  const byId = new Map();
  for (const { graph } of perProductGraphs) {
    for (const entry of graph) {
      const existing = byId.get(entry.id);
      if (!existing) {
        byId.set(entry.id, {
          ...entry,
          producerProductExternalIds: new Set(entry.producerProductExternalIds),
          consumerProductExternalIds: new Set(entry.consumerProductExternalIds),
          outEdges: [...entry.outEdges],
        });
      } else {
        for (const id of entry.producerProductExternalIds) existing.producerProductExternalIds.add(id);
        for (const id of entry.consumerProductExternalIds) existing.consumerProductExternalIds.add(id);
        // Merge data shallow-favouring richer fields (fields/columnLineage/entropyData).
        const ed = entry.data || {};
        const xd = existing.data;
        if ((ed.fields?.length || 0) > (xd.fields?.length || 0)) xd.fields = ed.fields;
        if (ed.columnLineage) Object.assign(xd.columnLineage ||= {}, ed.columnLineage);
        if (ed.entropyData && !xd.entropyData) xd.entropyData = ed.entropyData;
        if (ed.sql && !xd.sql) xd.sql = ed.sql;
        if (ed.status && !xd.status) xd.status = ed.status;
        if (ed.integration && !xd.integration) xd.integration = ed.integration;
        if (ed.jobType && !xd.jobType) xd.jobType = ed.jobType;
        existing.outEdges.push(...entry.outEdges);
      }
    }
  }
  return { graph: [...byId.values()] };
}

export function parseResponse(text) {
  try {
    const data = JSON.parse(text);
    if (data.graph) return data;
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
