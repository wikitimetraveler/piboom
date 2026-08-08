/**
 * Development work by David Lane
 */
/**
 * Unified Disasters — Graph DB ego-network (D3 force).
 * Persisted graph_nodes / graph_edges — as-of reseed, not live /near.
 */
(function (global) {
  'use strict';

  const NODE_COLORS = {
    disaster_event: '#b45309',
    county: '#0f766e',
    zip: '#0369a1',
    loan: '#4338ca',
    milestone: '#64748b',
    processor: '#9a3412',
    fema_declaration: '#b45309',
    nws_alert: '#0284c7',
    nasa_fire: '#c2410c',
    state: '#475569',
    borrower: '#6d28d9'
  };

  let simulation = null;
  let lastEgo = null;
  let lastDisasterObj = null;
  let lastDepth = 2;
  let loadToken = 0;
  let reseedInFlight = false;

  function prefersReducedMotion() {
    return global.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
  }

  function resolveDisasterExternalId(disasterObj) {
    if (!disasterObj) return '';
    const sid = disasterObj.source_id ?? disasterObj.sourceId;
    if (sid != null && String(sid).trim()) return String(sid).trim();
    if (disasterObj.id != null && String(disasterObj.id).trim()) return String(disasterObj.id).trim();
    return '';
  }

  /** Ordered unique keys to try against graph_nodes.external_id (source_id first). */
  function disasterExternalIdCandidates(disasterObj) {
    if (!disasterObj) return [];
    const out = [];
    const push = (v) => {
      if (v == null) return;
      const s = String(v).trim();
      if (!s || out.includes(s)) return;
      out.push(s);
    };
    push(disasterObj.source_id ?? disasterObj.sourceId);
    push(disasterObj.id);
    const src = disasterObj.source;
    const sid = disasterObj.source_id ?? disasterObj.sourceId;
    if (src && sid != null && String(sid).trim()) {
      push(`${String(src).trim()}|${String(sid).trim()}`);
    }
    return out;
  }

  function formatSeededAt(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function setStatus(msg, variant) {
    const el = document.getElementById('duGraphPanelStatus');
    if (!el) return;
    el.textContent = msg || '';
    el.className = `du-graph-panel-status small mb-2 text-${variant || 'muted'}`;
  }

  function setAsOfBadge(seededAtMax) {
    const badge = document.getElementById('duGraphAsOfBadge');
    if (!badge) return;
    if (!seededAtMax) {
      badge.hidden = true;
      badge.textContent = '';
      return;
    }
    badge.hidden = false;
    badge.textContent = `Graph as-of ${formatSeededAt(seededAtMax)}`;
    badge.title = 'Persisted NEAR / impact edges — not live GET /api/disasters/near';
  }

  function setStats(ego) {
    const el = document.getElementById('duGraphPanelStats');
    if (!el) return;
    if (!ego?.found) {
      el.textContent = '';
      return;
    }
    el.textContent = `${ego.nodeCount || 0} nodes · ${ego.edgeCount || 0} edges · ${ego.nearLinkCount || 0} NEAR rays`;
  }

  function clearSvg() {
    const host = document.getElementById('duGraphForceHost');
    if (!host) return;
    host.innerHTML = '';
    if (simulation) {
      simulation.stop();
      simulation = null;
    }
  }

  function strokeWidthForConfidence(confidence) {
    const c = confidence === 0 ? 0 : (Number.isFinite(confidence) ? confidence : 0.5);
    return 1 + Math.max(0, Math.min(1, c)) * 2.5;
  }

  function renderForce(ego) {
    clearSvg();
    const host = document.getElementById('duGraphForceHost');
    if (!host || typeof d3 === 'undefined') {
      setStatus('D3 unavailable — open the impact graph prototype for table view.', 'warning');
      return;
    }

    const nodes = (ego.nodes || []).map((n) => ({ ...n }));
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links = (ego.edges || [])
      .filter((e) => nodeIds.has(e.from_node_id) && nodeIds.has(e.to_node_id))
      .map((e) => ({
        source: e.from_node_id,
        target: e.to_node_id,
        edge_type: e.edge_type,
        confidence: e.confidence,
        metadata: e.metadata
      }));

    if (!nodes.length) {
      setStatus('No graph nodes for this event (graph may need a reseed).', 'warning');
      return;
    }

    const width = host.clientWidth || 640;
    const height = Math.max(280, Math.min(420, host.clientWidth * 0.45 || 320));

    const svg = d3
      .select(host)
      .append('svg')
      .attr('class', 'du-graph-force-svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Impact graph ego network for selected disaster');

    const g = svg.append('g');

    const zoom = d3.zoom().scaleExtent([0.4, 2.5]).on('zoom', (event) => {
      g.attr('transform', event.transform);
    });
    svg.call(zoom);

    const link = g
      .append('g')
      .attr('class', 'du-graph-links')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', (d) => (d.edge_type === 'NEAR' ? '#d97706' : '#94a3b8'))
      .attr('stroke-opacity', 0.75)
      .attr('stroke-width', (d) => strokeWidthForConfidence(d.confidence))
      .attr('stroke-dasharray', (d) => (d.edge_type === 'NEAR' ? '5 4' : null));

    const node = g
      .append('g')
      .attr('class', 'du-graph-nodes')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('class', 'du-graph-node')
      .call(
        d3
          .drag()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    node
      .append('circle')
      .attr('r', (d) => (d.node_type === 'disaster_event' ? 10 : d.node_type === 'loan' ? 7 : 6))
      .attr('fill', (d) => NODE_COLORS[d.node_type] || '#64748b')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5);

    node
      .append('title')
      .text(
        (d) =>
          `${d.node_type}: ${d.label || d.external_id || d.id}` +
          (d.disaster_risk_score != null ? `\nops triage: ${d.disaster_risk_score}` : '')
      );

    node
      .filter((d) => d.node_type === 'disaster_event' || d.node_type === 'loan' || nodes.length < 18)
      .append('text')
      .attr('class', 'du-graph-node-label')
      .attr('dx', 10)
      .attr('dy', 3)
      .text((d) => {
        const label = d.label || d.external_id || String(d.id);
        return label.length > 28 ? `${label.slice(0, 26)}…` : label;
      });

    node.on('click', (event, d) => {
      if (d.node_type !== 'loan' || !d.external_id) return;
      const gridApi = global.encompassLoansGridApi;
      if (!gridApi) return;
      let focused = false;
      gridApi.forEachNode((rowNode) => {
        const loan = rowNode.data?.loanObj || rowNode.data;
        const key = String(loan?.loan_number || loan?.loanNumber || '');
        if (key && key === String(d.external_id)) {
          rowNode.setSelected(true);
          gridApi.ensureNodeVisible(rowNode, 'middle');
          focused = true;
        }
      });
      if (focused) {
        document.getElementById('encompassLoansGrid')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });

    simulation = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3
          .forceLink(links)
          .id((d) => d.id)
          .distance((d) => (d.edge_type === 'NEAR' ? 70 : 55))
          .strength(0.55)
      )
      .force('charge', d3.forceManyBody().strength(-180))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(16));

    if (prefersReducedMotion()) {
      simulation.stop();
      for (let i = 0; i < 80; i += 1) simulation.tick();
      link
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x)
        .attr('y2', (d) => d.target.y);
      node.attr('transform', (d) => `translate(${d.x},${d.y})`);
      return;
    }

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x)
        .attr('y2', (d) => d.target.y);
      node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

    // Brief entrance: fade nodes in
    node.style('opacity', 0).transition().duration(450).style('opacity', 1);
  }

  async function fetchEgo(externalId, depth) {
    const res = await fetch(
      `/api/disaster-impact-graph/disaster/${encodeURIComponent(externalId)}/ego?depth=${encodeURIComponent(depth)}`
    );
    const payload = await res.json();
    if (!res.ok || payload.success === false) {
      throw new Error(payload.details || payload.error || `Graph request failed (${res.status})`);
    }
    return payload.data || {};
  }

  async function loadForDisaster(disasterObj, options) {
    lastDisasterObj = disasterObj || null;
    const candidates = disasterExternalIdCandidates(disasterObj);
    const externalId = candidates[0] || resolveDisasterExternalId(disasterObj);
    const depth = options?.depth ?? 2;
    lastDepth = depth;
    const token = ++loadToken;

    const card = document.getElementById('duGraphDbSection');
    if (card) card.classList.remove('du-section-card-hidden');

    const collapse = document.getElementById('collapseGraphDb');
    if (collapse && typeof bootstrap !== 'undefined') {
      bootstrap.Collapse.getOrCreateInstance(collapse, { toggle: false }).show();
    }

    setAsOfBadge(null);
    setStats(null);
    clearSvg();

    if (!externalId) {
      lastEgo = null;
      setStatus('Select a disaster with a source id to load the graph DB.', 'muted');
      global.duGeoOverlays?.setGraphNearRays?.([]);
      return null;
    }

    setStatus('Loading persisted impact graph…', 'muted');
    const prototypeLink = document.getElementById('duGraphPrototypeLink');
    if (prototypeLink) {
      prototypeLink.href = `/disaster-impact-graph.html`;
    }

    try {
      let ego = null;
      let usedId = externalId;
      for (const candidate of candidates.length ? candidates : [externalId]) {
        if (token !== loadToken) return null;
        ego = await fetchEgo(candidate, depth);
        usedId = candidate;
        if (ego.found) break;
      }
      if (token !== loadToken) return null;
      lastEgo = ego;

      if (!ego?.found) {
        setStatus(
          `No graph node for “${usedId}”. Click Reseed graph after ingest, or open the prototype.`,
          'warning'
        );
        setAsOfBadge(null);
        setStats(null);
        global.duGeoOverlays?.setGraphNearRays?.([]);
        return ego;
      }

      setAsOfBadge(ego.seededAtMax);
      setStats(ego);
      const nearNote = ego.nearLinkCount
        ? `${ego.nearLinkCount} graph NEAR link(s) with coordinates`
        : 'No coordinate-backed NEAR rays (edges may lack seeded coords)';
      setStatus(
        `Ego graph depth ${ego.depth} · ${nearNote}. Live proximity stays on /near.`,
        'success'
      );
      renderForce(ego);

      if (prototypeLink && ego.startNodeId) {
        prototypeLink.href = `/disaster-impact-graph.html#node=${encodeURIComponent(ego.startNodeId)}`;
      }

      global.duGeoOverlays?.setGraphNearRays?.(ego.nearLinks || [], {
        seededAtMax: ego.seededAtMax
      });
      return ego;
    } catch (err) {
      if (token !== loadToken) return null;
      lastEgo = null;
      setStatus(err.message || 'Failed to load graph DB', 'danger');
      global.duGeoOverlays?.setGraphNearRays?.([]);
      return null;
    }
  }

  async function reseedGraph() {
    if (reseedInFlight) return null;
    reseedInFlight = true;
    const btn = document.getElementById('duGraphReseedBtn');
    if (btn) {
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
    }
    setStatus('Reseeding impact graph from current disasters + loans…', 'muted');
    try {
      const res = await fetch('/api/disaster-impact-graph/refresh', { method: 'POST' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload.success === false) {
        throw new Error(
          payload.details ||
            payload.error ||
            `Graph reseed failed (${res.status}). Localhost or DISASTER_REFRESH_TOKEN required.`
        );
      }
      const seeded = payload.data?.seeded || {};
      setStatus(
        `Graph reseeded (${seeded.edgesSeeded ?? '—'} edges). Reloading ego network…`,
        'success'
      );
      if (lastDisasterObj) {
        return loadForDisaster(lastDisasterObj, { depth: lastDepth });
      }
      return payload.data;
    } catch (err) {
      setStatus(err.message || 'Failed to reseed graph', 'danger');
      return null;
    } finally {
      reseedInFlight = false;
      if (btn) {
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
      }
    }
  }

  function bindReseedButton() {
    const btn = document.getElementById('duGraphReseedBtn');
    if (!btn || btn.dataset.duBound === '1') return;
    btn.dataset.duBound = '1';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      reseedGraph();
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bindReseedButton);
    } else {
      bindReseedButton();
    }
  }

  function getLastEgo() {
    return lastEgo;
  }

  global.DuGraphPanel = {
    loadForDisaster,
    resolveDisasterExternalId,
    disasterExternalIdCandidates,
    reseedGraph,
    getLastEgo,
    clear: () => {
      clearSvg();
      lastEgo = null;
      lastDisasterObj = null;
      setStatus('Select a disaster in the grid to explore the graphical database.', 'muted');
      setAsOfBadge(null);
      setStats(null);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
