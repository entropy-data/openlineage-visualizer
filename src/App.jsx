import React, { useMemo, useCallback, useState } from 'react';
import {
  ReactFlow,
  ConnectionLineType,
  Background,
  Controls,
} from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import DatasetNode from './DatasetNode';
import JobNode from './JobNode';
import DetailPanel from './DetailPanel';

import '@xyflow/react/dist/style.css';

const nodeTypes = {
  dataset: DatasetNode,
  job: JobNode,
};

const NODE_WIDTHS = { dataset: 240, job: 200 };
const HEADER_HEIGHT = 34;
const FIELD_ROW_HEIGHT = 20;
const FIELD_LIST_PADDING = 5;

function getNodeHeight(node, collapsed) {
  if (node.type === 'job') return 80;
  const fields = node.data?.fields || [];
  if (fields.length === 0) return 40;
  if (collapsed) return HEADER_HEIGHT;
  return HEADER_HEIGHT + FIELD_LIST_PADDING + fields.length * FIELD_ROW_HEIGHT;
}

function marquezToReactFlow(graph) {
  const nodes = graph.map((entry) => ({
    id: entry.id,
    type: entry.type === 'JOB' ? 'job' : 'dataset',
    position: { x: 0, y: 0 },
    data: entry.data,
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

function getLayoutedElements(nodes, edges, collapsedSet, toggleCollapse) {
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 80 });

  nodes.forEach((node) => {
    const w = NODE_WIDTHS[node.type] || 200;
    const isCollapsed = collapsedSet.has(node.id);
    const h = getNodeHeight(node, isCollapsed);
    g.setNode(node.id, { width: w, height: h });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    const w = NODE_WIDTHS[node.type] || 200;
    const isCollapsed = collapsedSet.has(node.id);
    const h = getNodeHeight(node, isCollapsed);
    return {
      ...node,
      targetPosition: 'left',
      sourcePosition: 'right',
      position: { x: pos.x - w / 2, y: pos.y - h / 2 },
      style: { width: w },
      data: {
        ...node.data,
        collapsed: isCollapsed,
        onToggleCollapse: () => toggleCollapse(node.id),
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

/** Trace column lineage backward from a field, returning Map<nodeId, Set<fieldName>> */
function traceColumnLineage(nodeId, fieldName, nodes) {
  const datasetMap = new Map();
  for (const node of nodes) {
    if (node.type === 'dataset') datasetMap.set(node.id, node.data);
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
      const inputNodeId = `${input.namespace}:${input.name}`;
      if (datasetMap.has(inputNodeId)) {
        queue.push({ nodeId: inputNodeId, fieldName: input.field });
      }
    }
  }

  return result;
}

export default function App({ graphData }) {
  const [selectedNode, setSelectedNode] = useState(null);
  const [collapsedNodes, setCollapsedNodes] = useState(new Set());
  const [selectedColumn, setSelectedColumn] = useState(null);

  const toggleCollapse = useCallback((nodeId) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const { rawNodes, rawEdges } = useMemo(() => {
    const { nodes, edges } = marquezToReactFlow(graphData.graph);
    return { rawNodes: nodes, rawEdges: edges };
  }, [graphData]);

  const { layoutedNodes, layoutedEdges } = useMemo(() => {
    const result = getLayoutedElements(rawNodes, rawEdges, collapsedNodes, toggleCollapse);
    return { layoutedNodes: result.nodes, layoutedEdges: result.edges };
  }, [rawNodes, rawEdges, collapsedNodes, toggleCollapse]);

  // Column lineage tracing
  const columnLineageMap = useMemo(() => {
    if (!selectedColumn) return null;
    return traceColumnLineage(selectedColumn.nodeId, selectedColumn.fieldName, rawNodes);
  }, [selectedColumn, rawNodes]);

  // Compute which jobs are in the lineage chain
  const highlightedJobIds = useMemo(() => {
    if (!columnLineageMap) return null;
    const hlDatasets = new Set(columnLineageMap.keys());
    const jobs = new Set();
    for (const node of rawNodes) {
      if (node.type !== 'job') continue;
      let fromHl = false;
      let toHl = false;
      for (const edge of rawEdges) {
        if (edge.target === node.id && hlDatasets.has(edge.source)) fromHl = true;
        if (edge.source === node.id && hlDatasets.has(edge.target)) toHl = true;
      }
      if (fromHl && toHl) jobs.add(node.id);
    }
    return jobs;
  }, [columnLineageMap, rawNodes, rawEdges]);

  // Apply highlighting to nodes
  const nodes = useMemo(() => {
    if (!columnLineageMap) return layoutedNodes;
    return layoutedNodes.map((node) => {
      if (node.type === 'dataset') {
        const hlFields = columnLineageMap.get(node.id);
        return {
          ...node,
          data: { ...node.data, highlightedFields: hlFields || null, dimmed: !hlFields },
        };
      }
      return {
        ...node,
        data: { ...node.data, dimmed: !highlightedJobIds?.has(node.id) },
      };
    });
  }, [layoutedNodes, columnLineageMap, highlightedJobIds]);

  // Apply highlighting to edges
  const edges = useMemo(() => {
    if (!columnLineageMap) return layoutedEdges;
    const allHl = new Set([...columnLineageMap.keys(), ...(highlightedJobIds || [])]);
    return layoutedEdges.map((edge) => {
      const both = allHl.has(edge.source) && allHl.has(edge.target);
      return {
        ...edge,
        style: both
          ? { stroke: '#6366f1', strokeWidth: 2 }
          : { stroke: '#e2e8f0', strokeWidth: 1 },
      };
    });
  }, [layoutedEdges, columnLineageMap, highlightedJobIds]);

  const onFieldClick = useCallback((nodeId, fieldName) => {
    setSelectedColumn((prev) => {
      if (prev && prev.nodeId === nodeId && prev.fieldName === fieldName) return null;
      return { nodeId, fieldName };
    });
  }, []);

  const onNodeClick = useCallback((_event, node) => {
    setSelectedNode(node);
    setSelectedColumn(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedColumn(null);
  }, []);

  const onClose = useCallback(() => {
    setSelectedNode(null);
    setSelectedColumn(null);
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        panOnDrag={true}
        zoomOnScroll={true}
        zoomOnPinch={true}
        zoomOnDoubleClick={true}
        preventScrolling={false}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { stroke: '#94a3b8', strokeWidth: 1.5 },
        }}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
      >
        <Background color="#e2e8f0" gap={20} />
        <Controls position="bottom-left" showInteractive={false} />
      </ReactFlow>
      <DetailPanel
        node={selectedNode}
        onClose={onClose}
        selectedColumn={selectedColumn}
        onFieldClick={onFieldClick}
      />
    </div>
  );
}
