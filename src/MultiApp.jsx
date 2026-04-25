import React, { useEffect, useMemo, useRef, useState } from 'react';
import LineageCanvas from './LineageCanvas';
import PickerPanel from './PickerPanel';
import { openLineageToGraph, mergeGraphs, buildProductColorMap } from './lineage';

const MAX_SELECTED = 10;

// `loadEvents` is a function (externalId) => Promise<{ accessible, events }>.
// `dataProducts` is an array of { externalId, name, icon, eventCount, accessible, href }.
export default function MultiApp({
  dataProducts = [],
  currentProductExternalId = null,
  initialProducts = [],
  loadEvents,
}) {
  const [selected, setSelected] = useState(() => {
    const ids = new Set(initialProducts);
    if (currentProductExternalId) ids.add(currentProductExternalId);
    return new Set([...ids].slice(0, MAX_SELECTED));
  });
  const [hoveredProduct, setHoveredProduct] = useState(null);

  // Cache: externalId -> { status, accessible, graph }.
  const [perProduct, setPerProduct] = useState(new Map());
  const abortMapRef = useRef(new Map());

  // URL state — push `?products=` (excluding pinned) on change so browser
  // back/forward steps through selections; read on popstate.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const others = [...selected].filter((id) => id !== currentProductExternalId);
    if (others.length > 0) params.set('products', others.join(','));
    else params.delete('products');
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
    const current = `${window.location.pathname}${window.location.search}`;
    if (next !== current) {
      window.history.pushState({}, '', next);
    }
  }, [selected, currentProductExternalId]);

  useEffect(() => {
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      const ids = new Set(
        (params.get('products') || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      );
      if (currentProductExternalId) ids.add(currentProductExternalId);
      setSelected(new Set([...ids].slice(0, MAX_SELECTED)));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [currentProductExternalId]);

  // Fetch events for newly selected products on demand.
  useEffect(() => {
    for (const id of selected) {
      const cached = perProduct.get(id);
      if (cached) continue;

      const controller = new AbortController();
      abortMapRef.current.set(id, controller);
      setPerProduct((prev) => {
        const next = new Map(prev);
        next.set(id, { status: 'loading' });
        return next;
      });

      loadEvents(id, { signal: controller.signal })
        .then((data) => {
          const events = data?.events || [];
          const accessible = data?.accessible !== false;
          const graph = openLineageToGraph(events, id).graph;
          setPerProduct((prev) => {
            const next = new Map(prev);
            next.set(id, { status: 'ready', accessible, graph });
            return next;
          });
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return;
          setPerProduct((prev) => {
            const next = new Map(prev);
            next.set(id, { status: 'error', accessible: true, graph: [] });
            return next;
          });
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, loadEvents]);

  const onToggle = (externalId) => {
    if (externalId === currentProductExternalId) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(externalId)) {
        next.delete(externalId);
        const c = abortMapRef.current.get(externalId);
        if (c) c.abort();
        abortMapRef.current.delete(externalId);
        // Drop the cache entry so a later re-add triggers a fresh fetch
        // (an aborted in-flight fetch leaves status='loading' otherwise).
        setPerProduct((prevMap) => {
          if (!prevMap.has(externalId)) return prevMap;
          const m = new Map(prevMap);
          m.delete(externalId);
          return m;
        });
      } else {
        if (next.size >= MAX_SELECTED) return prev;
        next.add(externalId);
      }
      return next;
    });
  };

  const productInfoMap = useMemo(() => {
    const m = new Map();
    for (const p of dataProducts) {
      m.set(p.externalId, {
        name: p.name,
        icon: p.icon,
        archetype: p.archetype,
        teamName: p.teamName,
        accessible: p.accessible !== false,
        href: p.href,
      });
    }
    return m;
  }, [dataProducts]);

  const productColorMap = useMemo(
    () => buildProductColorMap([...selected], currentProductExternalId),
    [selected, currentProductExternalId],
  );

  const productStatuses = useMemo(() => {
    const m = new Map();
    for (const [id, v] of perProduct) m.set(id, v.status);
    return m;
  }, [perProduct]);

  const mergedGraph = useMemo(() => {
    const inputs = [];
    for (const id of selected) {
      const cached = perProduct.get(id);
      if (cached && cached.status === 'ready' && cached.graph) {
        inputs.push({ graph: cached.graph });
      }
    }
    if (inputs.length === 0) return [];
    return mergeGraphs(inputs).graph;
  }, [selected, perProduct]);

  return (
    <div className="ol-multi-root">
      <PickerPanel
        items={dataProducts}
        selected={selected}
        onToggle={onToggle}
        pinnedExternalId={currentProductExternalId}
        productColorMap={productColorMap}
        productStatuses={productStatuses}
        onHoverProduct={setHoveredProduct}
      />
      <div className="ol-canvas-wrap">
        {mergedGraph.length > 0 ? (
          <LineageCanvas
            graph={mergedGraph}
            productColorMap={productColorMap}
            productInfoMap={productInfoMap}
            hoveredProductExternalId={hoveredProduct}
            selectedProductExternalIds={[...selected]}
            currentProductExternalId={currentProductExternalId}
          />
        ) : (
          <EmptyState selected={selected} perProduct={perProduct} />
        )}
      </div>
    </div>
  );
}

function EmptyState({ selected, perProduct }) {
  const anyLoading = [...selected].some((id) => perProduct.get(id)?.status === 'loading');
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', color: '#64748b', fontSize: 14,
    }}>
      {anyLoading ? 'Loading lineage…' : 'No lineage events for the selected products'}
    </div>
  );
}
