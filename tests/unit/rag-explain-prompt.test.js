/**
 * Development work by David Lane
 */
import {
  RAG_GRAPH_EXPLAINER,
  buildRagRuntimeNote,
  isRagArchitectureQuestion
} from '../../lib/knowledge/rag-explain-prompt.js';

describe('rag-explain-prompt', () => {
  test('explainer includes metaphor and hard rules', () => {
    expect(RAG_GRAPH_EXPLAINER).toMatch(/two currents, one dock/i);
    expect(RAG_GRAPH_EXPLAINER).toMatch(/executionAllowed=false/);
    expect(RAG_GRAPH_EXPLAINER).toMatch(/ops triage/);
    expect(RAG_GRAPH_EXPLAINER).toMatch(/graph_nodes/);
  });

  test('buildRagRuntimeNote lists lanes and readiness', () => {
    const note = buildRagRuntimeNote([
      {
        label: 'HeyGen API knowledge',
        vectorReady: true,
        store: 'heygen-sources.json',
        table: 'heygen_knowledge_chunks'
      },
      {
        label: 'ICE knowledge',
        vectorReady: false,
        table: 'ice_knowledge_chunks'
      }
    ]);
    expect(note).toMatch(/Live retrieval status/);
    expect(note).toMatch(/vector\+keyword/);
    expect(note).toMatch(/keyword-only/);
    expect(note).toMatch(/heygen_knowledge_chunks/);
  });

  test('isRagArchitectureQuestion detects RAG / graph asks', () => {
    expect(isRagArchitectureQuestion('How does your RAG work?')).toBe(true);
    expect(isRagArchitectureQuestion('Explain pgvector and GraphRAG')).toBe(true);
    expect(isRagArchitectureQuestion('What is the difference between Video Agent and /v3/videos?')).toBe(
      false
    );
  });
});
