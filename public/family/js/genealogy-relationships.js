/**
 * Genealogy source file.
 * Author: Levi Lane.
 *
 * Relationship graph (D3 v7 force layout), 1891 register family panel, and the Postgres
 * relationships explorer for /family/genealogy.html and /family/lane-relationships.html.
 * Links carrying `provenance` were decoded from the book's genealogy codes
 * (No. N families, (N) carry-forward children, pedigrees).
 */
(function () {
  'use strict';

  const RELATION_COLORS = { father: '#3399ff', mother: '#ff3399', spouse: '#b8b800', associated: '#999999' };
  const LEGACY_COLOR = '#c4c9d0';
  const MAX_NODES = 900;
  const SECTION_SHORT = { boston: 'Part I', buxton: 'Part II · Buxton', fishersfield: 'Part III · Fishersfield', additions: 'Additions' };
  const SECTION_LABELS = {
    boston: 'Part I · William Lane of Boston',
    buxton: 'Part II · Buxton',
    fishersfield: 'Part III · Fishersfield',
    additions: 'Additions'
  };

  let graphData = null;
  let graphBackend = '';
  let registerDoc = null;
  let nodesById = new Map();
  let simulation = null;
  let relOffset = 0;
  const REL_PAGE = 50;

  const $ = (id) => document.getElementById(id);
  const escHtml = (v) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  function citation(prov) {
    if (!prov) return '';
    const part = prov.section && prov.section !== 'boston' ? `${SECTION_SHORT[prov.section] || prov.section} · ` : '';
    const bits = [`${part}No. ${prov.familyNo}`];
    if (prov.childOrder) bits.push(`${prov.carryForwardNo ? `(${prov.carryForwardNo}) ` : ''}${prov.childOrder}`);
    if (prov.pdfPage) bits.push(`PDF p. ${prov.pdfPage}`);
    return bits.join(' · ');
  }

  function personLabel(n) {
    if (!n) return '';
    const yr = n.birthYear ? ` (${n.birthYear})` : '';
    return `${n.name || `#${n.id}`}${yr}`;
  }

  function isHtmlBody(text) {
    const trimmed = String(text || '').trim();
    return !trimmed || trimmed.startsWith('<!') || /^<html/i.test(trimmed);
  }

  async function fetchJson(url) {
    const res = await fetch(url);
    const text = await res.text();
    if (isHtmlBody(text)) {
      const err = new Error('html');
      err.html = true;
      throw err;
    }
    try {
      return JSON.parse(text);
    } catch (error) {
      const err = new Error(error.message || 'invalid json');
      err.html = isHtmlBody(text);
      throw err;
    }
  }

  function adoptGraph(data, backend) {
    graphData = {
      nodes: Array.isArray(data.nodes) ? data.nodes : [],
      links: Array.isArray(data.links) ? data.links : []
    };
    graphBackend = backend;
    nodesById = new Map(graphData.nodes.map((n) => [n.id, n]));
    return graphData;
  }

  /** Build father / mother / spouse edges from the decoded 1891 register when the API returns HTML. */
  function graphFromRegister(doc) {
    const nodes = [];
    const links = [];
    const byId = new Map();
    let synth = 1000000;
    const touch = (rawId, fields) => {
      let id = rawId == null || rawId === '' ? null : Number(rawId);
      if (!Number.isFinite(id)) id = synth++;
      let node = byId.get(id);
      if (!node) {
        node = {
          id,
          name: fields.name || `#${id}`,
          gender: fields.gender || '',
          birthYear: fields.birthYear ?? null,
          deathYear: fields.deathYear ?? null
        };
        byId.set(id, node);
        nodes.push(node);
      } else if (fields.name && (!node.name || String(node.name).startsWith('#'))) {
        node.name = fields.name;
      }
      if (fields.genealogyCode) node.genealogyCode = fields.genealogyCode;
      if (fields.gender && !node.gender) node.gender = fields.gender;
      if (fields.birthYear != null && node.birthYear == null) node.birthYear = fields.birthYear;
      return id;
    };
    for (const f of doc.families || []) {
      const provBase = {
        section: f.section || 'boston',
        familyNo: f.familyNo,
        pdfPage: f.pdfPage,
        method: 'lane-genealogy-codes',
        confidence: 'register'
      };
      const headId = touch(f.head && f.head.personId, {
        name: f.head && f.head.name,
        birthYear: f.head && f.head.birthYear,
        deathYear: f.head && f.head.deathYear,
        genealogyCode: {
          section: f.section || 'boston',
          familyKey: String(f.familyKey),
          label: `No. ${f.familyKey}`,
          pdfPage: f.pdfPage,
          generation: f.generation,
          pedigreeText: (f.head && f.head.pedigree) || ''
        }
      });
      const wifeIds = (f.wives || []).map((w) => touch(w.personId, { name: w.name, gender: 'F' }));
      wifeIds.forEach((wid) => {
        links.push({ source: headId, target: wid, relation: 'spouse', provenance: { ...provBase } });
      });
      for (const c of f.children || []) {
        if (c.level != null && Number(c.level) !== 1) continue;
        const cid = touch(c.personId, { name: c.name, birthYear: c.birthYear });
        const childProv = {
          ...provBase,
          childOrder: c.order,
          carryForwardNo: c.carryForwardNo || null,
          pdfPage: c.pdfPage || f.pdfPage
        };
        links.push({ source: cid, target: headId, relation: 'father', provenance: childProv });
        if (wifeIds.length) links.push({ source: cid, target: wifeIds[0], relation: 'mother', provenance: childProv });
      }
    }
    return { nodes, links };
  }

  async function loadRegisterDoc() {
    if (registerDoc) return registerDoc;
    const urls = ['/data/lane-genealogy-codes.json', '/family/data/lane-genealogy-codes.json'];
    for (const url of urls) {
      try {
        const json = await fetchJson(url);
        if (json && Array.isArray(json.families)) {
          registerDoc = json;
          return registerDoc;
        }
      } catch {
        /* next static file */
      }
    }
    return null;
  }

  async function withRegisterCodes(data, backend) {
    const nodes = (data.nodes || []).map((n) => ({ ...n }));
    const links = (data.links || []).map((l) => ({
      ...l,
      source: typeof l.source === 'object' ? l.source.id : l.source,
      target: typeof l.target === 'object' ? l.target.id : l.target
    }));
    const hasCodes = nodes.some((n) => n && n.genealogyCode && n.genealogyCode.familyKey);
    if (hasCodes) return adoptGraph({ nodes, links }, backend);
    const doc = await loadRegisterDoc();
    if (!doc) return adoptGraph({ nodes, links }, backend);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    let stamped = 0;
    for (const f of doc.families || []) {
      const rawId = f.head && f.head.personId;
      if (rawId == null) continue;
      const node = byId.get(Number(rawId));
      if (!node) continue;
      node.genealogyCode = {
        section: f.section || 'boston',
        familyKey: String(f.familyKey),
        familyNo: f.familyNo,
        label: `No. ${f.familyKey}`,
        pdfPage: f.pdfPage,
        generation: f.generation,
        pedigreeText: (f.head && f.head.pedigree) || '',
        sectionLabel: SECTION_LABELS[f.section] || ''
      };
      stamped += 1;
    }
    if (!stamped) return adoptGraph(graphFromRegister(doc), 'register');
    return adoptGraph({ nodes, links }, backend === 'register' ? 'register' : `${backend}+register`);
  }

  async function loadGraphData() {
    if (graphData) return graphData;
    try {
      const json = await fetchJson('/api/genealogy/data');
      if (json && json.success && json.data && Array.isArray(json.data.nodes)) {
        return withRegisterCodes(json.data, 'api');
      }
    } catch {
      /* API missing or returned the site HTML shell */
    }
    try {
      const raw = await fetchJson('/data/laneData.json');
      if (raw && Array.isArray(raw.nodes) && Array.isArray(raw.links)) return withRegisterCodes(raw, 'file');
    } catch {
      /* in-memory file not served */
    }
    const doc = await loadRegisterDoc();
    if (doc) return adoptGraph(graphFromRegister(doc), 'register');
    throw new Error('Family data unavailable');
  }

  function familyPayloadFromRegister(doc, section, familyNo) {
    const families = Array.isArray(doc.families) ? doc.families : [];
    const sectionKey = SECTION_LABELS[section] ? section : 'boston';
    const key = String(familyNo).trim();
    const family = families.find(
      (f) => f.section === sectionKey && (String(f.familyKey) === key || String(f.familyNo) === key)
    );
    if (!family) return null;
    const ref = (personId, name) => {
      if (personId == null) return { id: null, name: name || null };
      const node = nodesById.get(Number(personId));
      return { id: Number(personId), name: (node && node.name) || name || null, birthYear: node?.birthYear ?? null };
    };
    const parent = family.parentLink
      ? families.find((f) => f.section === family.section && f.familyNo === family.parentLink.familyNo)
      : null;
    const childFamilies = families.filter(
      (f) => f.section === family.section && f.parentLink && f.parentLink.familyNo === family.familyNo
    );
    const label =
      family.section === 'boston'
        ? `No. ${family.familyKey}`
        : `${SECTION_LABELS[family.section] || family.section} · No. ${family.familyKey}`;
    const review = (doc.review || [])
      .filter((r) => r.family === label || String(r.family || '').startsWith(`${label} `))
      .slice(0, 50);
    return {
      success: true,
      source: doc.source,
      section: family.section,
      sectionLabel: SECTION_LABELS[family.section] || family.section,
      family: {
        ...family,
        head: family.head ? { ...family.head, person: ref(family.head.personId, family.head.name) } : null,
        wives: (family.wives || []).map((w) => ({ ...w, person: ref(w.personId, w.name) })),
        children: (family.children || []).map((c) => ({
          ...c,
          person: c.personId != null ? ref(c.personId, c.name) : null
        }))
      },
      parentFamily: parent
        ? { familyNo: parent.familyNo, familyKey: parent.familyKey, head: parent.head?.name || null, pdfPage: parent.pdfPage }
        : null,
      childFamilies: childFamilies.map((f) => ({
        familyNo: f.familyNo,
        familyKey: f.familyKey,
        head: f.head?.name || null,
        pdfPage: f.pdfPage
      })),
      review
    };
  }

  function readControls() {
    const relations = new Set(
      [...document.querySelectorAll('[data-graph-relation]')].filter((el) => el.checked).map((el) => el.getAttribute('data-graph-relation'))
    );
    return {
      scope: $('graphScope')?.value || 'register',
      section: $('graphSection')?.value || '',
      familyNo: String($('graphFamilyNo')?.value || '').trim(),
      depth: Number.isFinite(Number.parseInt($('graphDepth')?.value, 10))
        ? Number.parseInt($('graphDepth')?.value, 10)
        : 2,
      bookOnly: !!$('graphBookOnly')?.checked,
      relations
    };
  }

  function findFamilyHead(section, familyKey) {
    const sec = section || 'boston';
    for (const n of graphData.nodes) {
      const c = n.genealogyCode;
      if (c && c.familyKey && String(c.familyKey) === String(familyKey) && (c.section || 'boston') === sec) return n;
    }
    return null;
  }

  /** Nodes + links for the current controls. Family scope walks child links (source = child, target = parent). */
  function selectSubgraph(opts) {
    const allLinks = graphData.links.filter((l) => opts.relations.has(l.relation) && nodesById.has(l.source) && nodesById.has(l.target));
    const levels = new Map();
    let included = new Set();
    let note = '';

    if (opts.scope === 'family') {
      const head = findFamilyHead(opts.section, opts.familyNo);
      if (!head) return { error: `No person in the tree carries register code No. ${opts.familyNo}${opts.section && opts.section !== 'boston' ? ` (${SECTION_SHORT[opts.section]})` : ''} yet.` };
      const spousesOf = (id) =>
        graphData.links
          .filter((l) => l.relation === 'spouse' && (l.source === id || l.target === id))
          .map((l) => (l.source === id ? l.target : l.source));
      const childrenOf = (id) =>
        graphData.links.filter((l) => (l.relation === 'father' || l.relation === 'mother') && l.target === id).map((l) => l.source);
      const add = (id, level) => {
        if (!included.has(id)) {
          included.add(id);
          levels.set(id, level);
        }
      };
      add(head.id, 0);
      spousesOf(head.id).forEach((s) => add(s, 0));
      let frontier = [...included];
      const generations = opts.depth > 0 ? opts.depth : 24;
      for (let d = 1; d <= generations; d += 1) {
        const next = [];
        for (const pid of frontier) {
          for (const cid of childrenOf(pid)) {
            if (included.has(cid)) continue;
            add(cid, d);
            next.push(cid);
            for (const s of spousesOf(cid)) add(s, d);
          }
        }
        frontier = next;
      }
      for (const l of graphData.links) {
        if ((l.relation === 'father' || l.relation === 'mother') && l.source === head.id) add(l.target, -1);
      }
      note = `No. ${opts.familyNo} · ${head.name}`;
    } else {
      for (const l of allLinks) {
        if (!l.provenance) continue;
        if (opts.section && l.provenance.section !== opts.section) continue;
        included.add(l.source);
        included.add(l.target);
      }
      note = opts.section ? SECTION_SHORT[opts.section] : 'All book parts';
    }

    const bookTags = graphData.links.some((l) => l.provenance);
    const linksAmong = (set) =>
      allLinks.filter((l) => set.has(l.source) && set.has(l.target)).filter((l) => !opts.bookOnly || !bookTags || l.provenance);
    if (opts.bookOnly && bookTags) {
      const linked = new Set(linksAmong(included).flatMap((l) => [l.source, l.target]));
      for (const id of [...included]) if (!linked.has(id) && levels.get(id) !== 0) included.delete(id);
    }
    const totalNodes = included.size;
    if (opts.scope !== 'family' && included.size > MAX_NODES) included = new Set([...included].slice(0, MAX_NODES));
    const links = linksAmong(included).map((l) => ({ ...l }));
    const nodes = [...included].map((id) => ({ ...nodesById.get(id), _level: levels.get(id) }));
    return { nodes, links, totalNodes, note };
  }

  function dragBehavior() {
    return d3
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
      });
  }

  function drawGraph(sub, opts) {
    const el = $('d3-visualization');
    if (!el) return;
    if (simulation) simulation.stop();
    el.innerHTML = '';
    if (typeof d3 === 'undefined') {
      el.innerHTML = '<p class="text-warning mb-0">D3 failed to load.</p>';
      return;
    }
    if (!sub.nodes.length) {
      el.innerHTML = '<p class="text-muted mb-0">No relationships match these filters.</p>';
      return;
    }
    const width = el.clientWidth || 900;
    const height = el.clientHeight || 600;
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', height).attr('viewBox', [0, 0, width, height]);
    const g = svg.append('g');
    svg.call(d3.zoom().scaleExtent([0.08, 6]).on('zoom', (event) => g.attr('transform', event.transform)));

    const link = g
      .append('g')
      .selectAll('line')
      .data(sub.links)
      .join('line')
      .attr('stroke', (d) => (d.provenance ? RELATION_COLORS[d.relation] || '#999' : LEGACY_COLOR))
      .attr('stroke-width', (d) => (d.provenance ? 1.8 : 1))
      .attr('stroke-opacity', 0.85)
      .attr('stroke-dasharray', (d) => (d.relation === 'spouse' ? '4 3' : null));
    link.append('title').text((d) => {
      const s = nodesById.get(typeof d.source === 'object' ? d.source.id : d.source);
      const t = nodesById.get(typeof d.target === 'object' ? d.target.id : d.target);
      const rel = d.relation === 'spouse' ? 'spouse of' : `${d.relation} is`;
      return `${personLabel(s)} — ${rel} ${personLabel(t)}${d.provenance ? `\n${citation(d.provenance)}` : '\n(earlier tree link)'}`;
    });

    const node = g
      .append('g')
      .selectAll('g')
      .data(sub.nodes)
      .join('g')
      .attr('class', 'genealogy-graph-node')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        if (typeof window.viewPerson === 'function') window.viewPerson(d.id);
      });
    node
      .append('circle')
      .attr('r', (d) => (d.genealogyCode && d.genealogyCode.familyKey ? 7 : 4.5))
      .attr('fill', (d) => (d.gender === 'F' ? '#f7a8c8' : d.gender === 'M' ? '#8cc4ff' : '#d0d4da'))
      .attr('stroke', (d) => (d.genealogyCode && d.genealogyCode.familyKey ? '#8a5a00' : '#ffffff'))
      .attr('stroke-width', (d) => (d.genealogyCode && d.genealogyCode.familyKey ? 2 : 1));
    node.append('title').text((d) => `${personLabel(d)}${d.genealogyCode ? `\n${d.genealogyCode.label}` : ''}\nClick for details`);
    const showAllLabels = sub.nodes.length <= 140;
    node
      .filter((d) => showAllLabels || (d.genealogyCode && d.genealogyCode.familyKey))
      .append('text')
      .attr('x', 9)
      .attr('y', 3)
      .attr('font-size', 10)
      .attr('class', 'genealogy-graph-label')
      .text((d) => (d.genealogyCode && d.genealogyCode.familyKey ? `${d.name} · No. ${d.genealogyCode.familyKey}` : d.name || ''));

    simulation = d3
      .forceSimulation(sub.nodes)
      .force(
        'link',
        d3
          .forceLink(sub.links)
          .id((d) => d.id)
          .distance((d) => (d.relation === 'spouse' ? 28 : 55))
          .strength(0.7)
      )
      .force('charge', d3.forceManyBody().strength(sub.nodes.length > 400 ? -35 : -90))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('x', d3.forceX(width / 2).strength(0.03));
    if (opts.scope === 'family') {
      const rows = Math.max(opts.depth + 2, 3);
      simulation.force('y', d3.forceY((d) => ((d._level ?? 0) + 1.5) * (height / rows)).strength(0.35));
    } else {
      simulation.force('y', d3.forceY(height / 2).strength(0.03));
    }
    node.call(dragBehavior());
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x)
        .attr('y2', (d) => d.target.y);
      node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

    const summary = $('graphSummary');
    if (summary) {
      const book = sub.links.filter((l) => l.provenance).length;
      const capped = sub.totalNodes > sub.nodes.length ? ` (first ${sub.nodes.length} of ${sub.totalNodes})` : '';
      const via =
        graphBackend === 'file'
          ? ' · laneData.json'
          : graphBackend === 'register'
            ? ' · 1891 register file'
            : graphBackend.endsWith('+register')
              ? ' · register codes on the family tree'
              : '';
      summary.textContent = `${sub.note} — ${sub.nodes.length} people${capped}, ${sub.links.length} links (${book} from the book)${via}`;
    }
  }

  async function renderGraph() {
    const el = $('d3-visualization');
    const opts = readControls();
    try {
      if (el && !graphData) el.innerHTML = '<p class="text-muted mb-0">Loading relationship graph…</p>';
      await loadGraphData();
      if (opts.scope === 'family' && !opts.familyNo) {
        opts.familyNo = '1';
        if ($('graphFamilyNo')) $('graphFamilyNo').value = '1';
        if ($('graphSection') && !$('graphSection').value) $('graphSection').value = 'boston';
      }
      const sub = selectSubgraph(opts);
      if (sub.error) {
        if (el) el.innerHTML = `<p class="text-warning mb-0">${escHtml(sub.error)}</p>`;
        renderRegisterFamily(opts.section || 'boston', opts.familyNo);
        return;
      }
      drawGraph(sub, opts);
      if (opts.scope === 'family') renderRegisterFamily(opts.section || 'boston', opts.familyNo);
      else if ($('registerFamilyPanel')) $('registerFamilyPanel').innerHTML = '';
    } catch (error) {
      if (el) {
        el.innerHTML = `<p class="text-danger mb-0">${escHtml(error.message || String(error))}</p><p class="small text-muted mb-0">The relationship API returned HTML instead of the family graph. Reload after the genealogy service is up, or confirm <code>/family/data/lane-genealogy-codes.json</code> is reachable.</p>`;
      }
    }
  }

  function personLink(ref, fallback) {
    if (ref && ref.id != null) {
      return `<a href="#" onclick="viewPerson(${Number(ref.id)}); return false;">${escHtml(ref.name || fallback || `#${ref.id}`)}</a>`;
    }
    return `<span class="text-muted" title="Not matched to a person in the tree yet">${escHtml(fallback || '—')}</span>`;
  }

  function familyButton(section, key, label) {
    return `<button type="button" class="btn btn-link btn-sm p-0 align-baseline" onclick="GenealogyRelationships.showFamily('${escHtml(section)}','${escHtml(key)}')">${escHtml(label)}</button>`;
  }

  async function renderRegisterFamily(section, familyNo) {
    const panel = $('registerFamilyPanel');
    if (!panel) return;
    panel.innerHTML = '<p class="small text-muted mb-0">Loading register entry…</p>';
    try {
      let json = null;
      try {
        json = await fetchJson(`/api/genealogy/genealogy-codes/${encodeURIComponent(section)}/${encodeURIComponent(familyNo)}`);
      } catch {
        json = null;
      }
      if (!json || !json.success) {
        const doc = await loadRegisterDoc();
        json = doc ? familyPayloadFromRegister(doc, section, familyNo) : null;
      }
      if (!json || !json.success) {
        panel.innerHTML = `<p class="small text-muted mb-0">${escHtml((json && json.error) || 'Register entry not found.')}</p>`;
        return;
      }
      const f = json.family;
      const head = f.head;
      const life = head && head.birthYear ? `${head.birthYear}–${head.deathYear || ''}` : '';
      const wives = (f.wives || [])
        .map((w) => `${w.order > 1 ? `(${w.order}) ` : ''}${personLink(w.person, w.name)}`)
        .join(' · ');
      const kids = (f.children || [])
        .map((c) => {
          const indent = c.level > 1 ? ` style="margin-left:${(c.level - 1) * 1.25}rem"` : '';
          const cf = c.carryForwardNo ? `${familyButton(json.section, String(c.carryForwardNo), `(${c.carryForwardNo})`)} ` : '';
          return `<li${indent}><span class="register-order">${cf}${escHtml(c.order)}</span> ${personLink(c.person, c.name)}${c.birthYear ? ` <span class="text-muted">b. ${escHtml(c.birthYear)}</span>` : ''}${c.pdfPage ? ` <span class="text-muted small">· p. ${escHtml(c.pdfPage)}</span>` : ''}</li>`;
        })
        .join('');
      const parent = json.parentFamily
        ? `<div class="small">Born into ${familyButton(json.section, json.parentFamily.familyKey, `No. ${json.parentFamily.familyKey}`)} (${escHtml(json.parentFamily.head || '')})</div>`
        : '';
      const childFams = (json.childFamilies || []).length
        ? `<div class="small">Children's families: ${json.childFamilies.map((c) => familyButton(json.section, c.familyKey, `No. ${c.familyKey}`)).join(', ')}</div>`
        : '';
      const review = (json.review || []).length
        ? `<div class="small text-muted mt-1">${json.review.length} name(s) in this block are not matched to the tree yet (kept for review, never auto-created).</div>`
        : '';
      panel.innerHTML = `
        <div class="register-family-card">
          <div class="d-flex flex-wrap align-items-baseline gap-2 mb-1">
            <span class="badge genealogy-code-badge">No. ${escHtml(f.familyKey)}</span>
            <strong>${personLink(head && head.person, head && head.name)}</strong>
            ${head && head.pedigree ? `<span class="text-muted small">${escHtml(head.pedigree)}</span>` : ''}
            ${life ? `<span class="small">${escHtml(life)}</span>` : ''}
            <span class="small text-muted">· ${escHtml(json.sectionLabel || '')}${f.generation ? ` · generation ${escHtml(f.generation)}` : ''} · PDF p. ${escHtml(f.pdfPage)}</span>
          </div>
          ${wives ? `<div class="small mb-1"><strong>Wife:</strong> ${wives}</div>` : ''}
          ${parent}${childFams}
          ${kids ? `<div class="small text-muted text-uppercase mt-2 mb-1" style="font-size:0.65rem;letter-spacing:0.08em">Children as numbered in the book</div><ul class="register-children small mb-0">${kids}</ul>` : ''}
          ${review}
        </div>`;
    } catch (error) {
      panel.innerHTML = `<p class="small text-danger mb-0">${escHtml(error.message || String(error))}</p>`;
    }
  }

  function showFamily(section, familyKey) {
    if ($('graphScope')) $('graphScope').value = 'family';
    if ($('graphSection')) $('graphSection').value = section || 'boston';
    if ($('graphFamilyNo')) $('graphFamilyNo').value = String(familyKey);
    const modalEl = $('personDetailModal');
    if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      const inst = bootstrap.Modal.getInstance(modalEl);
      if (inst) inst.hide();
    }
    const tab = $('tree-tab');
    if (tab && typeof bootstrap !== 'undefined' && bootstrap.Tab) bootstrap.Tab.getOrCreateInstance(tab).show();
    renderGraph();
    const viz = $('d3-visualization');
    if (viz && viz.scrollIntoView) viz.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Apply ?q=&relation=&section=&familyNo=&pdfPage= into explorer + graph controls. */
  function applyUrlFilters(params) {
    const setIf = (id, key) => {
      const el = $(id);
      const v = params.get(key);
      if (el && v != null && v !== '') el.value = v;
    };
    setIf('relQ', 'q');
    setIf('relRelation', 'relation');
    setIf('relSection', 'section');
    setIf('relFamilyNo', 'familyNo');
    setIf('relPdfPage', 'pdfPage');
    setIf('graphSection', 'section');
    setIf('graphFamilyNo', 'familyNo');
    if (params.get('familyNo') && $('graphScope')) $('graphScope').value = 'family';
    if (params.has('bookOnly') && $('relBookOnly')) {
      const raw = String(params.get('bookOnly') || '').toLowerCase();
      $('relBookOnly').checked = raw !== '0' && raw !== 'false' && raw !== 'no';
    }
    if (params.has('bookOnly') && $('graphBookOnly')) {
      const raw = String(params.get('bookOnly') || '').toLowerCase();
      $('graphBookOnly').checked = raw !== '0' && raw !== 'false' && raw !== 'no';
    }
  }

  /**
   * Fallback person modal for standalone pages that do not define window.viewPerson.
   * Host pages (genealogy.html) keep their richer renderer when already defined.
   */
  async function viewPersonFallback(id) {
    const titleEl = $('personDetailModalTitle');
    const bodyEl = $('personDetailModalBody');
    const modalEl = $('personDetailModal');
    if (!titleEl || !bodyEl || !modalEl) return;
    titleEl.textContent = 'Loading…';
    bodyEl.innerHTML = '<p class="text-muted mb-0">Fetching profile…</p>';
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
    try {
      let data = null;
      try {
        data = await fetchJson(`/api/genealogy/${encodeURIComponent(id)}`);
      } catch {
        data = null;
      }
      if (!data || !data.success || !data.person) {
        await loadGraphData();
        const person = nodesById.get(Number(id));
        if (!person) {
          titleEl.textContent = 'Not found';
          bodyEl.innerHTML = `<p class="text-warning mb-0">${escHtml((data && data.error) || 'Person not found.')}</p>`;
          return;
        }
        const parents = [];
        const spouses = [];
        const children = [];
        const bookLinks = [];
        for (const link of graphData.links || []) {
          const src = typeof link.source === 'object' ? link.source.id : link.source;
          const tgt = typeof link.target === 'object' ? link.target.id : link.target;
          if (link.relation === 'spouse' && (src === person.id || tgt === person.id)) {
            const other = nodesById.get(src === person.id ? tgt : src);
            if (other) spouses.push(other);
          } else if ((link.relation === 'father' || link.relation === 'mother') && tgt === person.id) {
            const child = nodesById.get(src);
            if (child) children.push(child);
          } else if ((link.relation === 'father' || link.relation === 'mother') && src === person.id) {
            const parent = nodesById.get(tgt);
            if (parent) parents.push(parent);
            if (link.provenance && parent) bookLinks.push({ relation: link.relation, person: parent, provenance: link.provenance });
          }
        }
        data = {
          success: true,
          person,
          family: { parents: parents.map((p) => ({ person: p })), spouses, children, allRelationships: bookLinks }
        };
      }
      if (!data.success || !data.person) {
        titleEl.textContent = 'Not found';
        bodyEl.innerHTML = `<p class="text-warning mb-0">${escHtml(data.error || 'Person not found.')}</p>`;
        return;
      }
      const person = data.person;
      const fam = data.family || {};
      const code = person.genealogyCode;
      titleEl.textContent = person.name || `Person #${person.id}`;
      const life = [person.birthYear, person.deathYear].filter((y) => y != null && y !== '').join('–') || '—';
      const parents = (fam.parents || [])
        .map((r) => (r.person ? personLink(r.person, r.person.name) : null))
        .filter(Boolean)
        .join(', ') || '—';
      const spouses = (fam.spouses || [])
        .map((r) => personLink(r, r.name))
        .join(', ') || '—';
      const children = (fam.children || [])
        .map((r) => personLink(r, r.name))
        .join(', ') || '—';
      const bookLinks = (fam.allRelationships || []).filter((r) => r && r.provenance && r.person);
      const bookRows = bookLinks
        .map((r) => {
          const rel = r.direction === 'from' || r.relation === 'spouse' ? r.relation : 'child';
          return `<li><span class="badge text-bg-light border me-1">${escHtml(rel)}</span>
            ${personLink(r.person, r.person.name)}
            <span class="text-muted">— ${escHtml(citation(r.provenance))}${r.provenance.confirmed ? ' · confirms earlier link' : ''}</span></li>`;
        })
        .join('');
      const familyBtn =
        code && code.familyKey
          ? `<button type="button" class="btn btn-sm btn-outline-primary ms-2" onclick="GenealogyRelationships.showFamily('${escHtml(code.section || 'boston')}','${escHtml(code.familyKey)}')"><i class="bi-diagram-3"></i> Family No. ${escHtml(code.familyKey)}</button>`
          : '';
      const parentBtn =
        code && code.parentFamilyNo
          ? `<button type="button" class="btn btn-sm btn-outline-secondary ms-2" onclick="GenealogyRelationships.showFamily('${escHtml(code.section || 'boston')}','${escHtml(code.parentFamilyNo)}')"><i class="bi-arrow-up"></i> Born in No. ${escHtml(code.parentFamilyNo)}</button>`
          : '';
      bodyEl.innerHTML = `
        ${
          code
            ? `<div class="genealogy-code-card mb-3">
          <div class="d-flex flex-wrap align-items-center gap-1 mb-1">
            <span class="badge genealogy-code-badge">${escHtml(code.label || '')}</span>${familyBtn}${parentBtn}
          </div>
          <div class="small text-muted">${escHtml(code.sectionLabel || '')}${code.generation ? ` · generation ${escHtml(code.generation)}` : ''}${code.pdfPage ? ` · PDF p. ${escHtml(code.pdfPage)}` : ''}</div>
          ${code.pedigreeText ? `<div class="small mt-1"><strong>Pedigree:</strong> ${escHtml(code.pedigreeText)}</div>` : ''}
          ${code.lifespan ? `<div class="small"><strong>Book lifespan:</strong> ${escHtml(code.lifespan)}</div>` : ''}
          ${bookRows ? `<div class="small text-muted text-uppercase mt-2 mb-1" style="font-size:0.65rem;letter-spacing:0.08em">Links decoded from the book</div><ul class="small mb-0 ps-3">${bookRows}</ul>` : ''}
        </div>`
            : bookRows
              ? `<div class="genealogy-code-card mb-3"><div class="small text-muted text-uppercase mb-1" style="font-size:0.65rem;letter-spacing:0.08em">Links decoded from the book</div><ul class="small mb-0 ps-3">${bookRows}</ul></div>`
              : ''
        }
        <dl class="row mb-2">
          <dt class="col-sm-3">Birth–Death</dt><dd class="col-sm-9">${escHtml(life)}</dd>
        </dl>
        <p class="mb-1 small"><strong>Parents:</strong> ${parents}</p>
        <p class="mb-1 small"><strong>Spouses:</strong> ${spouses}</p>
        <p class="mb-0 small"><strong>Children:</strong> ${children}</p>`;
    } catch (error) {
      titleEl.textContent = 'Error';
      bodyEl.innerHTML = `<p class="text-danger mb-0">${escHtml(error.message || String(error))}</p>`;
    }
  }

  function ensureViewPerson() {
    if (typeof window.viewPerson !== 'function') {
      window.viewPerson = viewPersonFallback;
    }
  }

  /* ---------------- Relationships explorer (Postgres) ---------------- */

  function statsFromGraph() {
    const byRelation = {};
    for (const link of graphData?.links || []) {
      const rel = String(link.relation || 'unknown');
      const row = byRelation[rel] || (byRelation[rel] = { relation: rel, total: 0, fromBook: 0, confirmed: 0 });
      row.total += 1;
      if (link.provenance) {
        row.fromBook += 1;
        if (link.provenance.confirmed) row.confirmed += 1;
      }
    }
    return {
      byRelation: Object.values(byRelation).sort((a, b) => a.relation.localeCompare(b.relation)),
      codedPeople: (graphData?.nodes || []).filter((p) => p && p.genealogyCode).length,
      backend: graphBackend === 'register' ? 'register file' : 'memory'
    };
  }

  function relationshipsFromGraph(filters) {
    const q = String(filters.q || '').trim().toLowerCase();
    const bookTags = (graphData?.links || []).some((l) => l.provenance);
    const bookOnly = !!filters.bookOnly && bookTags;
    const rows = [];
    (graphData?.links || []).forEach((link) => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      const p = link.provenance || null;
      if (filters.relation && link.relation !== filters.relation) return;
      if ((bookOnly || filters.section || filters.familyNo || filters.pdfPage) && !p) return;
      if (filters.section && p.section !== filters.section) return;
      if (filters.familyNo && Number(p.familyNo) !== Number(filters.familyNo)) return;
      if (filters.pdfPage && Number(p.pdfPage) !== Number(filters.pdfPage)) return;
      const s = nodesById.get(sourceId);
      const t = nodesById.get(targetId);
      if (!s || !t) return;
      if (q && !String(s.name || '').toLowerCase().includes(q) && !String(t.name || '').toLowerCase().includes(q)) return;
      rows.push({
        relation: link.relation,
        source: { id: s.id, name: s.name, birthYear: Number.parseInt(s.birthYear, 10) || null },
        target: { id: t.id, name: t.name, birthYear: Number.parseInt(t.birthYear, 10) || null },
        provenance: p
      });
    });
    const offset = Number(filters.offset) || 0;
    const limit = Number(filters.limit) || REL_PAGE;
    return {
      success: true,
      total: rows.length,
      offset,
      relationships: rows.slice(offset, offset + limit),
      backend: graphBackend === 'register' ? 'register file' : 'memory'
    };
  }

  async function loadRelStats() {
    const bar = $('relStatsBar');
    if (!bar) return;
    try {
      let json = null;
      try {
        json = await fetchJson('/api/genealogy/relationships/stats');
      } catch {
        json = null;
      }
      if (!json || !json.success) {
        await loadGraphData();
        json = { success: true, stats: statsFromGraph() };
      }
      const s = json.stats;
      const parts = (s.byRelation || []).map(
        (r) =>
          `<span class="rel-stat"><i class="legend-line legend-${escHtml(r.relation)}"></i><strong>${escHtml(r.relation)}</strong> ${r.total.toLocaleString()}
           <span class="text-muted">(${r.fromBook.toLocaleString()} from book · ${r.confirmed.toLocaleString()} confirm earlier links)</span></span>`
      );
      parts.push(`<span class="rel-stat"><strong>${Number(s.codedPeople || 0).toLocaleString()}</strong> people carry a register code</span>`);
      parts.push(`<span class="badge text-bg-${s.backend === 'postgres' ? 'success' : 'secondary'}">${escHtml(s.backend)}</span>`);
      bar.innerHTML = parts.join('');
    } catch (error) {
      bar.innerHTML = `<span class="text-muted">${escHtml(error.message || String(error))}</span>`;
    }
  }

  async function searchRelationships(resetOffset) {
    const out = $('relResults');
    if (!out) return;
    if (resetOffset) relOffset = 0;
    const params = new URLSearchParams();
    const val = (id) => String($(id)?.value || '').trim();
    if (val('relQ')) params.set('q', val('relQ'));
    if (val('relRelation')) params.set('relation', val('relRelation'));
    if (val('relSection')) params.set('section', val('relSection'));
    if (val('relFamilyNo')) params.set('familyNo', val('relFamilyNo'));
    if (val('relPdfPage')) params.set('pdfPage', val('relPdfPage'));
    if ($('relBookOnly')?.checked) params.set('bookOnly', '1');
    params.set('limit', String(REL_PAGE));
    params.set('offset', String(relOffset));
    out.innerHTML = '<p class="small text-muted">Searching…</p>';
    try {
      let json = null;
      try {
        json = await fetchJson(`/api/genealogy/relationships?${params.toString()}`);
      } catch {
        json = null;
      }
      if (!json || !json.success) {
        await loadGraphData();
        json = relationshipsFromGraph({
          q: val('relQ'),
          relation: val('relRelation'),
          section: val('relSection'),
          familyNo: val('relFamilyNo'),
          pdfPage: val('relPdfPage'),
          bookOnly: !!$('relBookOnly')?.checked,
          limit: REL_PAGE,
          offset: relOffset
        });
      }
      if (!json.success) throw new Error(json.error || 'Search failed');
      if (!json.relationships.length) {
        out.innerHTML = '<p class="text-muted">No relationships match.</p>';
        return;
      }
      const rows = json.relationships
        .map((r) => {
          const p = r.provenance;
          const rel =
            r.relation === 'spouse'
              ? 'spouse of'
              : r.relation === 'associated'
                ? 'associated with'
                : `child of (${r.relation})`;
          const graphBtn = p && p.familyNo
            ? `<button type="button" class="btn btn-outline-primary btn-sm py-0" title="Show family in graph" onclick="GenealogyRelationships.showFamily('${escHtml(p.section || 'boston')}','${escHtml(p.familyNo)}')"><i class="bi-diagram-3"></i></button>`
            : '';
          return `<tr>
            <td>${personLink({ id: r.source.id, name: personLabel(r.source) })}</td>
            <td><span class="badge rel-badge rel-badge-${escHtml(r.relation)}">${escHtml(rel)}</span></td>
            <td>${personLink({ id: r.target.id, name: personLabel(r.target) })}</td>
            <td>${p ? escHtml(citation(p)) : '<span class="text-muted">earlier tree link</span>'}</td>
            <td class="small text-muted">${p ? `${escHtml(p.method || '')} · ${escHtml(p.confidence || '')}${p.confirmed ? ' · confirmed' : ''}` : ''}</td>
            <td>${graphBtn}</td>
          </tr>`;
        })
        .join('');
      const from = json.offset + 1;
      const to = json.offset + json.relationships.length;
      out.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2 small">
          <span>${from.toLocaleString()}–${to.toLocaleString()} of ${Number(json.total).toLocaleString()} · <span class="badge text-bg-${json.backend === 'postgres' ? 'success' : 'secondary'}">${escHtml(json.backend)}</span></span>
          <span class="btn-group btn-group-sm">
            <button type="button" class="btn btn-outline-secondary" id="relPrev" ${json.offset <= 0 ? 'disabled' : ''}>Prev</button>
            <button type="button" class="btn btn-outline-secondary" id="relNext" ${to >= json.total ? 'disabled' : ''}>Next</button>
          </span>
        </div>
        <div class="table-responsive">
          <table class="table table-sm table-hover align-middle rel-table">
            <thead><tr><th>Person</th><th>Relation</th><th>Parent / spouse</th><th>Book code</th><th>How decoded</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
      $('relPrev')?.addEventListener('click', () => {
        relOffset = Math.max(0, relOffset - REL_PAGE);
        searchRelationships(false);
      });
      $('relNext')?.addEventListener('click', () => {
        relOffset += REL_PAGE;
        searchRelationships(false);
      });
    } catch (error) {
      out.innerHTML = `<p class="text-danger">${escHtml(error.message || String(error))}</p><p class="small text-muted">Verify GET /api/genealogy/relationships.</p>`;
    }
  }

  function init() {
    ensureViewPerson();

    $('graphApply')?.addEventListener('click', renderGraph);
    $('graphScope')?.addEventListener('change', renderGraph);
    $('graphBookOnly')?.addEventListener('change', renderGraph);
    document.querySelectorAll('[data-graph-relation]').forEach((el) => el.addEventListener('change', renderGraph));
    $('graphFamilyNo')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if ($('graphScope')) $('graphScope').value = 'family';
        renderGraph();
      }
    });
    $('relSearch')?.addEventListener('click', () => searchRelationships(true));
    $('relQ')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') searchRelationships(true);
    });

    document.querySelectorAll('[data-show-family]').forEach((el) => {
      el.addEventListener('click', () => {
        const section = el.getAttribute('data-section') || 'boston';
        const familyNo = el.getAttribute('data-family-no') || el.getAttribute('data-show-family');
        if (familyNo) showFamily(section, familyNo);
      });
    });

    const params = new URLSearchParams(window.location.search);
    applyUrlFilters(params);

    const standalone = !$('relationships-tab') && !!$('relResults');
    let relLoaded = false;
    const loadExplorer = () => {
      if (relLoaded) return;
      relLoaded = true;
      loadRelStats();
      searchRelationships(true);
    };
    if (standalone) {
      loadExplorer();
    } else {
      $('relationships-tab')?.addEventListener('shown.bs.tab', loadExplorer);
    }

    const familyNo = params.get('familyNo');
    const personId = params.get('id');
    if (standalone && !familyNo) {
      if ($('graphScope')) $('graphScope').value = 'family';
      if ($('graphSection') && !params.get('section')) $('graphSection').value = 'boston';
      if ($('graphFamilyNo') && !$('graphFamilyNo').value) $('graphFamilyNo').value = '1';
      const depthEl = $('graphDepth');
      if (depthEl && [...depthEl.options].some((o) => o.value === '0')) depthEl.value = '0';
    }
    if (familyNo) {
      showFamily(params.get('section') || 'boston', familyNo);
    } else {
      renderGraph();
    }
    if (personId && typeof window.viewPerson === 'function') {
      const pid = Number.parseInt(personId, 10);
      if (!Number.isNaN(pid)) window.viewPerson(pid);
    }
  }

  window.GenealogyRelationships = {
    showFamily,
    renderGraph,
    searchRelationships,
    loadRelStats,
    citation,
    applyUrlFilters
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
