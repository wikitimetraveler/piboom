/**
 * Shared “how we use RAG + graph DBs” explainer for LOS AI Labs assistants.
 * Keep metaphor + facts in one place so Encompass + HeyGen experts stay aligned.
 */

/** Clever + technical architecture block for system prompts */
export const RAG_GRAPH_EXPLAINER = `
## How LOS AI Labs uses RAG + graph DBs ("two currents, one dock")

When someone asks how our knowledge, RAG, vectors, pgvector, GraphRAG, or graph DB works — lead with this model, then go technical.

### Metaphor (speak this first)
- **Keyword current** — the frost catalog: exact titles, paths, field IDs, endpoint names. Always on; works offline from committed JSON.
- **Vector current** — the undercurrent of meaning: OpenAI \`text-embedding-3-small\` (1536-d) in Postgres **pgvector**, HNSW cosine, distance via \`embedding <=> query\`.
- **The dock** — hybrid merge: run both lanes in parallel (\`Promise.all\`), boost vector hits, dedupe, hand the assistant cited slips ([S1], [S2]…).
- **Graph archipelago** — Postgres **graph_nodes** + edges (disaster impact graph). Structural hops (\`NEAR\` / recursive CTE) are the bridges between islands. **GraphRAG** adds a scent trail: \`findSimilarNodes\` embeds node text so similar hazards/places surface even without a direct edge.
- **Hard rule** — GraphRAG similarity ≠ live map proximity (\`GET /api/disasters/near\`). Loan \`disaster_risk_score\` is **ops triage**, not a loss probability. Knowledge RAG is **retrieval only** (\`executionAllowed=false\`) — we never execute ICE APIs from retrieved snippets.

### Technical map (cite when useful)
| Store | Table / file | Service | Job |
|-------|----------------|---------|-----|
| ICE knowledge | \`ice_knowledge_chunks\` + \`data/knowledge/ice-sources.json\` | \`lib/knowledge/ice-knowledge.service.js\` | \`npm run build:ice-knowledge\` |
| Encompass docs | \`encompass_docs_chunks\` + \`data/encompass-docs.json\` | \`services/encompass-docs.service.js\` | \`npm run scrape:encompass-docs\` |
| HeyGen API docs | \`heygen_knowledge_chunks\` + \`data/knowledge/heygen-sources.json\` | \`services/heygen-knowledge.service.js\` | \`npm run build:heygen-knowledge\` |
| GSE / mortgage | \`gse_knowledge_chunks\` + \`data/knowledge/gse-sources.json\` | \`services/gse-knowledge.service.js\` | \`npm run build:gse-knowledge\` |
| Disaster graph | \`graph_nodes.embedding\` + relational edges | \`services/disaster-impact-graph.service.js\` | \`npm run embed:graph-nodes\` |

Shared helpers: \`lib/knowledge/embedding-utils.js\`. Schema: \`ensureKnowledgeVectorTable\` / \`ensurePgvectorExtension\` in \`services/database.service.js\`. Docs: \`docs/VECTOR_RAG.md\`, \`docs/AI_SYSTEM.md\`.

### Answer pattern for “how do you use RAG?”
1. One sentence metaphor (two currents → dock).
2. Which store(s) *you* (this expert) search on this turn.
3. Hybrid + fallback (no DB/key → keyword still answers).
4. If relevant: graph archipelago vs live \`/near\`.
5. Point to refresh jobs / docs — keep it speakable for TTS.
`;

/**
 * Compact runtime note injected into the system message each chat turn.
 * @param {{ label: string, vectorReady?: boolean, store?: string, table?: string }[]} lanes
 */
export function buildRagRuntimeNote(lanes = []) {
  if (!lanes.length) return '';
  const lines = [
    '\n\n## Live retrieval status (this turn)',
    'You are answering with hybrid RAG on these lanes:'
  ];
  for (const lane of lanes) {
    const ready =
      lane.vectorReady === true
        ? 'vector+keyword'
        : lane.vectorReady === false
          ? 'keyword-only (vector not ready)'
          : 'hybrid when available';
    const store = lane.store ? ` · ${lane.store}` : '';
    const table = lane.table ? ` · ${lane.table}` : '';
    lines.push(`- **${lane.label}**: ${ready}${store}${table}`);
  }
  lines.push(
    'If the user asks how knowledge works, use the "two currents, one dock" explainer and mention this live status.'
  );
  return lines.join('\n');
}

/**
 * True when the user is asking about our RAG / graph architecture (not a random API fact).
 */
export function isRagArchitectureQuestion(message = '') {
  const q = String(message).toLowerCase();
  return (
    /\b(rag|retrieval.?augment|pgvector|embedding|graphrag|graph\s*(db|database|rag)|hybrid\s*search|vector\s*search|knowledge\s*(base|index|store)|how\s+(do|does)\s+(you|this|the)\s+(know|retrieve|search|ground))\b/.test(
      q
    ) || /\b(two currents|frost catalog|undercurrent)\b/.test(q)
  );
}
