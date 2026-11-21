/**
 * Development work by David Lane
 */
import {
  STAFFORD_206_48_PROMPT_APPENDIX,
  appendStaffordKnowledgeToPrompt,
  getStafford20648PromptAppendix,
  loadStafford20648Source,
} from '../../services/disaster-stafford-knowledge.service.js';

describe('disaster-stafford-knowledge.service', () => {
  test('loads 44 CFR 206.48 markdown source', () => {
    const body = loadStafford20648Source({ force: true });
    expect(body).toMatch(/206\.48/);
    expect(body).toMatch(/Public Assistance/i);
    expect(body).toMatch(/Individual Assistance/i);
    expect(body).toMatch(/Governor/i);
  });

  test('prompt appendix covers PA and IA principal factors', () => {
    const appendix = getStafford20648PromptAppendix();
    expect(appendix).toMatch(/206\.48/);
    expect(appendix).toMatch(/per capita|Estimated cost/i);
    expect(appendix).toMatch(/fiscal capacity|Uninsured/i);
    expect(appendix).toMatch(/not legal advice/i);
  });

  test('appendStaffordKnowledgeToPrompt concatenates base + appendix', () => {
    const out = appendStaffordKnowledgeToPrompt('You are a test expert.');
    expect(out.startsWith('You are a test expert.')).toBe(true);
    expect(out).toMatch(/206\.48/);
    expect(out.length).toBeGreaterThan(STAFFORD_206_48_PROMPT_APPENDIX.length);
  });
});
