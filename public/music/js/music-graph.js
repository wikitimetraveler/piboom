/**
 * Music Graph Explorer — collection subgraph UI.
 */
(function () {
  const NODE_BADGE = {
    artist: 'bg-primary',
    album: 'bg-info text-dark',
    member: 'bg-success',
    venue: 'bg-warning text-dark',
    show: 'bg-danger'
  };

  const EDGE_LABEL = {
    HAS_ALBUM: 'artist → album',
    MEMBER_OF: 'member → artist',
    PERFORMED_AT: 'show → venue',
    PERFORMED_BY: 'show → artist',
    RECORDING_OF: 'album → show'
  };

  let graphState = { nodes: [], edges: [], nodeById: new Map(), edgeById: new Map() };
  let selectedNodeId = null;

  function $(id) {
    return document.getElementById(id);
  }

  function getUserId() {
    return (
      localStorage.getItem('currentUserId') ||
      localStorage.getItem('loggedInUserId') ||
      (window.DEMO_USERS && window.DEMO_USERS[0] && window.DEMO_USERS[0].id) ||
      ''
    );
  }

  function setStatus(message, isError) {
    const el = $('statusMessage');
    if (!el) return;
    el.className = `alert mb-0 py-2 ${isError ? 'alert-danger' : 'alert-light border'}`;
    el.textContent = message;
  }

  async function fetchJson(url, options) {
    const response = await fetch(url, options);
    const payload = await response.json();
    if (!response.ok || payload.success === false) {
      throw new Error(payload.details || payload.error || `Request failed (${response.status})`);
    }
    return payload.data;
  }

  function ingestGraph(data) {
    const nodes = data.nodes || [];
    const edges = data.edges || [];
    graphState = {
      nodes,
      edges,
      nodeById: new Map(nodes.map((n) => [Number(n.id), n])),
      edgeById: new Map(edges.map((e) => [Number(e.id), e]))
    };
  }

  function nodeBadge(type) {
    return `<span class="badge ${NODE_BADGE[type] || 'bg-secondary'}">${type}</span>`;
  }

  function formatMeta(node) {
    let meta = node.metadata_json || {};
    if (typeof meta === 'string') {
      try { meta = JSON.parse(meta); } catch (_) { meta = {}; }
    }
    const bits = [];
    if (meta.year) bits.push(`Year: ${meta.year}`);
    if (meta.genre) bits.push(meta.genre);
    if (meta.storageZone && meta.storageSlot) bits.push(`Shelf ${meta.storageZone}${meta.storageSlot}`);
    if (meta.showDate) bits.push(meta.showDate);
    if (meta.instrument) bits.push(meta.instrument);
    if (meta.city) bits.push([meta.city, meta.state].filter(Boolean).join(', '));
    return bits.join(' · ');
  }

  function renderSummaryFromGraph(data) {
    const counts = {};
    for (const node of data.nodes || []) {
      counts[node.node_type] = (counts[node.node_type] || 0) + 1;
    }
    const edgeCounts = {};
    for (const edge of data.edges || []) {
      edgeCounts[edge.edge_type] = (edgeCounts[edge.edge_type] || 0) + 1;
    }

    $('summaryPanel').innerHTML = `
      <div class="row g-2 mb-2">
        <div class="col-6 col-md-3"><div class="stat-box"><div class="stat-label">Nodes</div><div class="stat-value">${(data.nodes || []).length}</div></div></div>
        <div class="col-6 col-md-3"><div class="stat-box"><div class="stat-label">Edges</div><div class="stat-value">${(data.edges || []).length}</div></div></div>
        <div class="col-6 col-md-3"><div class="stat-box"><div class="stat-label">Albums</div><div class="stat-value">${data.albumCount ?? counts.album ?? 0}</div></div></div>
        <div class="col-6 col-md-3"><div class="stat-box"><div class="stat-label">Depth</div><div class="stat-value">${data.depth ?? '-'}</div></div></div>
      </div>
      <div class="small text-muted mb-1">Node types</div>
      <div class="mb-2">${Object.entries(counts).map(([k, v]) => `${nodeBadge(k)} ${v}`).join(' ') || '—'}</div>
      <div class="small text-muted mb-1">Edge types</div>
      <div>${Object.entries(edgeCounts).map(([k, v]) => `<span class="badge bg-dark me-1">${k} (${v})</span>`).join('') || '—'}</div>
    `;
  }

  function renderNodeList(filterType) {
    const body = $('nodesBody');
    const typeFilter = filterType || $('typeFilter')?.value || '';
    let nodes = [...graphState.nodes];
    if (typeFilter) nodes = nodes.filter((n) => n.node_type === typeFilter);
    nodes.sort((a, b) => {
      const order = { artist: 0, album: 1, member: 2, show: 3, venue: 4 };
      const d = (order[a.node_type] ?? 9) - (order[b.node_type] ?? 9);
      return d !== 0 ? d : String(a.label).localeCompare(String(b.label));
    });

    if (!nodes.length) {
      body.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">No nodes. Load a collection or refresh the graph.</td></tr>';
      return;
    }

    body.innerHTML = nodes
      .map((node) => {
        const active = Number(node.id) === Number(selectedNodeId) ? 'table-active' : '';
        const meta = formatMeta(node);
        return `
          <tr class="node-row ${active}" data-node-id="${node.id}" role="button">
            <td>${node.id}</td>
            <td>${nodeBadge(node.node_type)}</td>
            <td><strong>${escapeHtml(node.label || '')}</strong>${meta ? `<div class="small text-muted">${escapeHtml(meta)}</div>` : ''}</td>
            <td class="small">${escapeHtml(node.source || '')}</td>
            <td class="mono small">${escapeHtml(node.external_id || '')}</td>
          </tr>
        `;
      })
      .join('');

    body.querySelectorAll('.node-row').forEach((row) => {
      row.addEventListener('click', () => selectNode(row.dataset.nodeId));
    });
  }

  function renderEdges() {
    const body = $('edgesBody');
    const edges = graphState.edges;
    if (!edges.length) {
      body.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">No edges in current graph.</td></tr>';
      return;
    }

    body.innerHTML = edges
      .map((edge) => {
        const from = graphState.nodeById.get(Number(edge.from_node_id));
        const to = graphState.nodeById.get(Number(edge.to_node_id));
        return `
          <tr>
            <td><span class="badge bg-dark">${edge.edge_type}</span><div class="small text-muted">${EDGE_LABEL[edge.edge_type] || ''}</div></td>
            <td>${from ? `${nodeBadge(from.node_type)} ${escapeHtml(from.label)}` : edge.from_node_id}</td>
            <td class="text-center">→</td>
            <td>${to ? `${nodeBadge(to.node_type)} ${escapeHtml(to.label)}` : edge.to_node_id}</td>
            <td>${edge.confidence != null ? Number(edge.confidence).toFixed(2) : ''}</td>
          </tr>
        `;
      })
      .join('');
  }

  function renderNodeDetail(node) {
    const panel = $('nodeDetail');
    if (!node) {
      panel.innerHTML = '<div class="text-muted small">Select a node to inspect metadata and neighbors.</div>';
      return;
    }
    let meta = node.metadata_json || {};
    if (typeof meta === 'string') {
      try { meta = JSON.parse(meta); } catch (_) { meta = {}; }
    }
    panel.innerHTML = `
      <div class="mb-2">${nodeBadge(node.node_type)} <strong>${escapeHtml(node.label)}</strong></div>
      <div class="small text-muted mb-2">ID ${node.id} · ${escapeHtml(node.source || '')} · <span class="mono">${escapeHtml(node.external_id || '')}</span></div>
      <pre class="detail-json mono small mb-0">${escapeHtml(JSON.stringify(meta, null, 2))}</pre>
    `;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function selectNode(nodeId) {
    const depth = $('depthInput').value.trim() || '3';
    selectedNodeId = Number(nodeId);
    const node = graphState.nodeById.get(selectedNodeId);
    renderNodeDetail(node);
    renderNodeList();

    try {
      setStatus(`Loading neighborhood for node ${nodeId}…`);
      const [graph, summary] = await Promise.all([
        fetchJson(`/api/music-graph/${encodeURIComponent(nodeId)}?depth=${encodeURIComponent(depth)}`),
        fetchJson(`/api/music-graph/${encodeURIComponent(nodeId)}/summary?depth=${encodeURIComponent(depth)}`)
      ]);
      ingestGraph(graph);
      renderNodeList();
      renderEdges();
      renderSummaryFromGraph({ ...graph, albumCount: summary.nodeTypeCounts?.album });
      renderNodeDetail(graphState.nodeById.get(selectedNodeId) || node);
      setStatus(`Focused on ${node?.label || nodeId} (depth ${graph.depth}).`);
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  async function loadCollectionGraph() {
    const userId = getUserId();
    if (!userId) {
      setStatus('Select a user to load their collection graph.', true);
      return;
    }
    const depth = $('depthInput').value.trim() || '3';
    try {
      setStatus(`Loading collection graph for ${userId}…`);
      const data = await fetchJson(
        `/api/music-graph/collection/${encodeURIComponent(userId)}?depth=${encodeURIComponent(depth)}`
      );
      selectedNodeId = null;
      ingestGraph(data);
      renderSummaryFromGraph(data);
      renderNodeList();
      renderEdges();
      renderNodeDetail(null);
      setStatus(`Loaded ${data.nodes?.length || 0} nodes / ${data.edges?.length || 0} edges for ${userId}.`);
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  async function refreshGraph() {
    const userId = getUserId();
    if (!userId) {
      setStatus('Select a user before refresh.', true);
      return;
    }
    try {
      setStatus('Refreshing graph from collection + MusicBrainz (may take a moment)…');
      $('refreshBtn').disabled = true;
      await fetchJson('/api/music-graph/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, force: true })
      });
      await loadCollectionGraph();
      setStatus(`Graph refreshed for ${userId}.`);
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      $('refreshBtn').disabled = false;
    }
  }

  async function searchArtist() {
    const key = $('artistKeyInput').value.trim();
    if (!key) {
      setStatus('Enter an artist name or MusicBrainz ID.', true);
      return;
    }
    const depth = $('depthInput').value.trim() || '3';
    try {
      setStatus(`Searching artist "${key}"…`);
      const data = await fetchJson(
        `/api/music-graph/artist/${encodeURIComponent(key)}?depth=${encodeURIComponent(depth)}`
      );
      selectedNodeId = data.startNodeId;
      ingestGraph(data);
      renderSummaryFromGraph(data);
      renderNodeList();
      renderEdges();
      renderNodeDetail(graphState.nodeById.get(selectedNodeId));
      setStatus(`Loaded artist neighborhood (${data.nodes?.length || 0} nodes).`);
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  function bindEvents() {
    $('loadCollectionBtn').addEventListener('click', loadCollectionGraph);
    $('refreshBtn').addEventListener('click', refreshGraph);
    $('searchArtistBtn').addEventListener('click', searchArtist);
    $('typeFilter').addEventListener('change', () => renderNodeList());
    $('depthInput').addEventListener('change', () => {
      if (selectedNodeId) selectNode(selectedNodeId);
    });

    window.addEventListener('userChanged', loadCollectionGraph);
    window.addEventListener('storage', (e) => {
      if (e.key === 'loggedInUserId' || e.key === 'currentUserId') loadCollectionGraph();
    });
  }

  function init() {
    bindEvents();
    const params = new URLSearchParams(window.location.search);
    const artist = params.get('artist');
    if (artist) {
      $('artistKeyInput').value = artist;
      searchArtist();
      return;
    }
    loadCollectionGraph();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
