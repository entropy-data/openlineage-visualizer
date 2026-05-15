import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

export const NODE_WIDTHS = { dataset: 240, job: 200 };
const HEADER_HEIGHT = 34;
const CHIP_ROW_HEIGHT = 22;
const FIELD_ROW_HEIGHT = 20;
const FIELD_LIST_PADDING = 5;

export function getNodeHeight(node, collapsed) {
  const hasChip = (node.data?.producerProductExternalIds?.size || 0) > 0
    || (node.data?.consumerProductExternalIds?.size || 0) > 0;
  const chipExtra = hasChip ? CHIP_ROW_HEIGHT : 0;
  if (node.type === 'job') return 80 + chipExtra;
  const fields = node.data?.fields || [];
  if (fields.length === 0) return 40 + chipExtra;
  if (collapsed) return HEADER_HEIGHT + chipExtra;
  return HEADER_HEIGHT + chipExtra + FIELD_LIST_PADDING + fields.length * FIELD_ROW_HEIGHT;
}

export function marquezToReactFlow(graph) {
  const nodes = graph.map((entry) => ({
    id: entry.id,
    type: entry.type === 'JOB' ? 'job' : 'dataset',
    position: { x: 0, y: 0 },
    data: {
      ...entry.data,
      producerProductExternalIds: entry.producerProductExternalIds || new Set(),
      consumerProductExternalIds: entry.consumerProductExternalIds || new Set(),
    },
  }));

  const edgeSet = new Set();
  const edges = [];
  graph.forEach((entry) => {
    (entry.outEdges || []).forEach((e) => {
      const id = `${e.origin}->${e.destination}`;
      if (!edgeSet.has(id)) {
        edgeSet.add(id);
        edges.push({ id, source: e.origin, target: e.destination });
      }
    });
  });

  return { nodes, edges };
}

// Pick the cluster (data product container) a node should live in.
// Prefer the pinned current product when it's a producer; otherwise the first
// selected producer; otherwise null (= float at root, "external" node).
function pickCluster(producers, selectedSet, currentProductExternalId) {
  if (currentProductExternalId && producers.has(currentProductExternalId)) {
    return currentProductExternalId;
  }
  for (const p of producers) {
    if (selectedSet.has(p)) return p;
  }
  return null;
}

export async function getLayoutedElements({
  rawNodes,
  rawEdges,
  collapsedSet,
  toggleCollapse,
  selectedExternalIds,
  currentProductExternalId,
  productInfoMap,
  productColorMap,
}) {
  const selectedSet = new Set(selectedExternalIds || []);

  // 1. Bucket nodes by cluster.
  const childrenByCluster = new Map();
  const externalNodes = [];
  const clusterByNodeId = new Map();
  for (const node of rawNodes) {
    const w = NODE_WIDTHS[node.type] || 200;
    const collapsed = collapsedSet.has(node.id);
    const h = getNodeHeight(node, collapsed);
    const producers = node.data.producerProductExternalIds || new Set();
    const cluster = pickCluster(producers, selectedSet, currentProductExternalId);
    const elkNode = { id: node.id, width: w, height: h };
    if (cluster) {
      clusterByNodeId.set(node.id, cluster);
      if (!childrenByCluster.has(cluster)) childrenByCluster.set(cluster, []);
      childrenByCluster.get(cluster).push(elkNode);
    } else {
      externalNodes.push(elkNode);
    }
  }

  // 2. Build ELK graph. INCLUDE_CHILDREN lets edges cross cluster boundaries.
  const clusterChildren = [];
  for (const [clusterId, kids] of childrenByCluster) {
    clusterChildren.push({
      id: `cluster:${clusterId}`,
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
        'elk.padding': '[top=80,left=14,bottom=14,right=14]',
        'elk.spacing.nodeNode': '24',
        'elk.layered.spacing.nodeNodeBetweenLayers': '50',
      },
      children: kids,
    });
  }

  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '40',
      'elk.layered.spacing.nodeNodeBetweenLayers': '70',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    },
    children: [...clusterChildren, ...externalNodes],
    edges: rawEdges.map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  };

  const result = await elk.layout(elkGraph);

  // 3. Convert ELK output back to React Flow nodes.
  // Group nodes are prepended so they render behind their children. We rely on
  // React Flow's parent/child positioning: child nodes carry a parentId and
  // their position is relative to the group.
  const layoutedNodes = [];
  const rawById = new Map(rawNodes.map((n) => [n.id, n]));

  for (const c of result.children || []) {
    if (c.id.startsWith('cluster:')) {
      const externalId = c.id.slice('cluster:'.length);
      layoutedNodes.push({
        id: c.id,
        type: 'productGroup',
        position: { x: c.x || 0, y: c.y || 0 },
        data: {
          externalId,
          info: productInfoMap?.get(externalId),
          color: productColorMap?.get(externalId),
        },
        style: { width: c.width, height: c.height, zIndex: -1 },
        selectable: false,
        draggable: false,
        connectable: false,
      });
      for (const child of c.children || []) {
        const orig = rawById.get(child.id);
        if (!orig) continue;
        layoutedNodes.push(decorateChild(orig, child, c.id, collapsedSet, toggleCollapse));
      }
    } else {
      const orig = rawById.get(c.id);
      if (!orig) continue;
      layoutedNodes.push(decorateChild(orig, c, null, collapsedSet, toggleCollapse));
    }
  }

  return { nodes: layoutedNodes, edges: rawEdges };
}

function decorateChild(orig, elkNode, parentId, collapsedSet, toggleCollapse) {
  const w = NODE_WIDTHS[orig.type] || 200;
  const isCollapsed = collapsedSet.has(orig.id);
  return {
    ...orig,
    parentId: parentId || undefined,
    extent: parentId ? 'parent' : undefined,
    targetPosition: 'left',
    sourcePosition: 'right',
    position: { x: elkNode.x || 0, y: elkNode.y || 0 },
    style: { width: w },
    data: {
      ...orig.data,
      collapsed: isCollapsed,
      onToggleCollapse: () => toggleCollapse(orig.id),
    },
  };
}

// Resolve the upstream dataset for a columnLineage inputField reference.
// Exact (namespace, name) is preferred; falls back to a same-namespace, same-
// schema-prefix dataset that exposes a column matching the requested field
// name (case-insensitive). This tolerates dbt-ol mixing the dbt-source logical
// name in the dataset facet with the physical table name in the columnLineage
// facet (e.g. `OP_PRICES_HISTORY_V1.snowflake_prices_history` as an event input
// vs `OP_PRICES_HISTORY_V1.PRICES_HISTORY` in columnLineage.inputFields).
function resolveUpstreamDataset(input, datasetMap, nsNameToId) {
  const nsKey = `${input.namespace}:${input.name}`;
  const exact = nsNameToId.get(nsKey);
  if (exact && datasetMap.has(exact)) return exact;

  if (!input.name || !input.name.includes('.')) return null;
  const schemaPrefix = input.name.substring(0, input.name.lastIndexOf('.') + 1);
  const wantField = (input.field || '').toLowerCase();
  for (const [id, data] of datasetMap) {
    if (data.namespace !== input.namespace) continue;
    if (!data.name || !data.name.startsWith(schemaPrefix)) continue;
    if (data.name === input.name) continue; // already covered by exact
    const hasField = (data.fields || []).some((f) => f.name.toLowerCase() === wantField);
    if (hasField) return id;
  }
  return null;
}

// Trace column lineage backward from a field, returning Map<nodeId, Set<fieldName>>.
export function traceColumnLineage(nodeId, fieldName, nodes) {
  const datasetMap = new Map();
  const nsNameToId = new Map();
  for (const node of nodes) {
    if (node.type === 'dataset') {
      datasetMap.set(node.id, node.data);
      if (node.data.namespace && node.data.name) {
        nsNameToId.set(`${node.data.namespace}:${node.data.name}`, node.id);
      }
    }
  }

  const result = new Map();
  const visited = new Set();
  const queue = [{ nodeId, fieldName }];

  while (queue.length > 0) {
    const item = queue.shift();
    const key = `${item.nodeId}::${item.fieldName}`;
    if (visited.has(key)) continue;
    visited.add(key);

    if (!result.has(item.nodeId)) result.set(item.nodeId, new Set());
    result.get(item.nodeId).add(item.fieldName);

    const dsData = datasetMap.get(item.nodeId);
    const inputs = dsData?.columnLineage?.[item.fieldName]?.inputFields;
    if (!inputs) continue;

    for (const input of inputs) {
      const inputNodeId = resolveUpstreamDataset(input, datasetMap, nsNameToId);
      if (!inputNodeId) continue;
      const inputData = datasetMap.get(inputNodeId);
      // OpenLineage column lineage can also disagree on field case: dbt-ol
      // lowercases column refs from parsed SQL, but Snowflake's schema facet
      // preserves uppercase. Resolve to the schema's spelling so the highlight
      // Set matches what DatasetNode renders.
      const schemaField = (inputData.fields || []).find(
        (f) => f.name.toLowerCase() === input.field.toLowerCase()
      );
      queue.push({ nodeId: inputNodeId, fieldName: schemaField ? schemaField.name : input.field });
    }
  }

  return result;
}
