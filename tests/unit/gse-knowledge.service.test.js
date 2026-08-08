/**
 * Development work by David Lane
 */
import { describe, expect, it, beforeAll } from '@jest/globals';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import gseKnowledgeService from '../../services/gse-knowledge.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

describe('gse-knowledge.service', () => {
  beforeAll(() => {
    execFileSync(process.execPath, ['scripts/build-gse-knowledge.js'], {
      cwd: ROOT,
      env: { ...process.env, GSE_SKIP_EMBED: '1' },
      stdio: 'pipe'
    });
  }, 60000);

  it('loads summary with local pooling and ARM categories', async () => {
    const summary = await gseKnowledgeService.getSummary();
    expect(summary.totalRecords).toBeGreaterThan(0);
    expect(summary.table).toBe('gse_knowledge_chunks');
    expect(summary.counts).toBeDefined();
  });

  it('keyword-searches mortgage pooling content', async () => {
    const hits = await gseKnowledgeService.searchKeyword('UMBS TBA pooling Majors', 5);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].title).toBeTruthy();
    expect(hits[0].retrieval).toBe('keyword');
  });

  it('keyword-searches ARM first rate change cutoff', async () => {
    const hits = await gseKnowledgeService.searchKeyword('March 10 April July rate change', 5);
    expect(hits.length).toBeGreaterThan(0);
    const blob = hits.map((h) => `${h.title} ${h.content}`).join(' ').toLowerCase();
    expect(blob.includes('march') || blob.includes('april') || blob.includes('rate')).toBe(true);
  });

  it('builds a graphical knowledge graph with hub and category nodes', async () => {
    const graph = await gseKnowledgeService.getGraph(2);
    expect(Array.isArray(graph.nodes)).toBe(true);
    expect(Array.isArray(graph.links)).toBe(true);
    expect(graph.nodes.some((n) => n.kind === 'hub')).toBe(true);
    expect(graph.nodes.some((n) => n.kind === 'category')).toBe(true);
    expect(graph.links.length).toBeGreaterThan(0);
  });
});
