import React, { useMemo, useCallback, useState, useEffect } from 'react';
import {
  ReactFlow,
  ConnectionLineType,
  Background,
  Controls,
  ControlButton,
  useReactFlow,
} from '@xyflow/react';
import DatasetNode from './DatasetNode';
import JobNode from './JobNode';
import ProductGroupNode from './ProductGroupNode';
import DetailPanel from './DetailPanel';
import { getLayoutedElements, marquezToReactFlow, traceColumnLineage } from './layout';
import { zoomInIcon, zoomOutIcon, fitViewIcon } from './controlIcons';

import '@xyflow/react/dist/style.css';

const nodeTypes = {
  dataset: DatasetNode,
  job: JobNode,
  productGroup: ProductGroupNode,
};

// Rendered as a child of <ReactFlow> so useReactFlow has access to the instance
// without wrapping the whole canvas in a ReactFlowProvider.
function CanvasControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  return (
    <Controls position="bottom-left" showZoom={false} showFitView={false} showInteractive={false}>
      <ControlButton onClick={() => zoomIn()} title="Zoom in" aria-label="Zoom in">
        {zoomInIcon}
      </ControlButton>
      <ControlButton onClick={() => zoomOut()} title="Zoom out" aria-label="Zoom out">
        {zoomOutIcon}
      </ControlButton>
      <ControlButton onClick={() => fitView({ padding: 0.2 })} title="Fit view" aria-label="Fit view">
        {fitViewIcon}
      </ControlButton>
    </Controls>
  );
}

export default function LineageCanvas({
  graph,
  productColorMap,
  productInfoMap,
  hoveredProductExternalId,
  selectedProductExternalIds,
  currentProductExternalId,
}) {
  const [selectedNode, setSelectedNode] = useState(null);
  const [collapsedNodes, setCollapsedNodes] = useState(new Set());
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [layouted, setLayouted] = useState({ nodes: [], edges: [] });

  const toggleCollapse = useCallback((nodeId) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const { rawNodes, rawEdges } = useMemo(() => {
    const { nodes, edges } = marquezToReactFlow(graph);
    return { rawNodes: nodes, rawEdges: edges };
  }, [graph]);

  // Async layout via ELK. The previous result stays on screen until the new one
  // resolves, so the graph doesn't blink to empty when the selection changes.
  useEffect(() => {
    let cancelled = false;
    getLayoutedElements({
      rawNodes,
      rawEdges,
      collapsedSet: collapsedNodes,
      toggleCollapse,
      selectedExternalIds: selectedProductExternalIds || [],
      currentProductExternalId,
      productInfoMap,
      productColorMap,
    }).then((result) => {
      if (!cancelled) setLayouted(result);
    });
    return () => {
      cancelled = true;
    };
  }, [rawNodes, rawEdges, collapsedNodes, toggleCollapse, selectedProductExternalIds, currentProductExternalId, productInfoMap, productColorMap]);

  const columnLineageMap = useMemo(() => {
    if (!selectedColumn) return null;
    return traceColumnLineage(selectedColumn.nodeId, selectedColumn.fieldName, rawNodes);
  }, [selectedColumn, rawNodes]);

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

  const onFieldClick = useCallback((nodeId, fieldName) => {
    setSelectedColumn((prev) => {
      if (prev && prev.nodeId === nodeId && prev.fieldName === fieldName) return null;
      return { nodeId, fieldName };
    });
    const node = rawNodes.find((n) => n.id === nodeId);
    if (node) setSelectedNode(node);
  }, [rawNodes]);

  // Decorate nodes with highlight + product scoping.
  const nodes = useMemo(() => {
    return layouted.nodes.map((node) => {
      // Group nodes pass through unchanged — their dim state follows hover.
      if (node.type === 'productGroup') {
        const matched = !hoveredProductExternalId || node.data.externalId === hoveredProductExternalId;
        return {
          ...node,
          data: { ...node.data, dimmed: !matched },
        };
      }
      const producerIds = node.data.producerProductExternalIds || new Set();
      const consumerIds = node.data.consumerProductExternalIds || new Set();
      const productScoping = computeProductScoping(producerIds, consumerIds, productColorMap, productInfoMap);

      const hoveredScoped = hoveredProductExternalId
        ? (producerIds.has(hoveredProductExternalId) || consumerIds.has(hoveredProductExternalId))
        : true;
      const baseDimmed = hoveredProductExternalId ? !hoveredScoped : false;

      if (node.type === 'dataset') {
        const hlFields = columnLineageMap?.get(node.id);
        return {
          ...node,
          data: {
            ...node.data,
            nodeId: node.id,
            onFieldClick,
            highlightedFields: columnLineageMap ? (hlFields || null) : null,
            dimmed: columnLineageMap ? !hlFields : baseDimmed,
            productScoping,
          },
        };
      }
      return {
        ...node,
        data: {
          ...node.data,
          dimmed: columnLineageMap ? !highlightedJobIds?.has(node.id) : baseDimmed,
          productScoping,
        },
      };
    });
  }, [layouted, columnLineageMap, highlightedJobIds, onFieldClick, productColorMap, productInfoMap, hoveredProductExternalId]);

  const edges = useMemo(() => {
    if (!columnLineageMap) return layouted.edges;
    const allHl = new Set([...columnLineageMap.keys(), ...(highlightedJobIds || [])]);
    return layouted.edges.map((edge) => {
      const both = allHl.has(edge.source) && allHl.has(edge.target);
      return {
        ...edge,
        style: both
          ? { stroke: '#6366f1', strokeWidth: 2 }
          : { stroke: '#e2e8f0', strokeWidth: 1 },
      };
    });
  }, [layouted, columnLineageMap, highlightedJobIds]);

  const onNodeClick = useCallback((_event, node) => {
    if (node.type === 'productGroup') return;
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

  const selectedNodeWithScoping = useMemo(() => {
    if (!selectedNode) return null;
    return nodes.find((n) => n.id === selectedNode.id) || selectedNode;
  }, [selectedNode, nodes]);

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
        <CanvasControls />
      </ReactFlow>
      <DetailPanel
        node={selectedNodeWithScoping}
        onClose={onClose}
        selectedColumn={selectedColumn}
        onFieldClick={onFieldClick}
      />
    </div>
  );
}

function computeProductScoping(producerIds, consumerIds, productColorMap, productInfoMap) {
  if (!productColorMap || (producerIds.size === 0 && consumerIds.size === 0)) return null;
  const toEntries = (set) => {
    const out = [];
    for (const id of set) {
      const color = productColorMap.get(id);
      const info = productInfoMap?.get(id);
      if (!color && !info) continue;
      out.push({ externalId: id, color, info });
    }
    return out;
  };
  const producers = toEntries(producerIds);
  const consumers = toEntries(consumerIds).filter((c) => !producerIds.has(c.externalId));
  if (producers.length === 0 && consumers.length === 0) return null;
  const primary = producers[0] || consumers[0];
  return { primary, producers, consumers };
}
