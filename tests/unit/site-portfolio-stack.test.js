/**
 * Development work by David Lane
 */
import '../../public/shared/site-portfolio.js';

const { SITE_PORTFOLIO } = globalThis;

function labels(items) {
  return (items || []).map((item) => item.label);
}

function projectStack(id) {
  const project = SITE_PORTFOLIO.PORTFOLIO_PROJECTS.find((item) => item.id === id);
  return project ? project.stack || [] : [];
}

describe('portfolio platform name', () => {
  test('public brand is Lane AI Labs', () => {
    expect(SITE_PORTFOLIO.PLATFORM_NAME).toBe('Lane AI Labs');
  });
});

describe('portfolio tech stack', () => {
  test('chips include WebGL and WebGPU for a glanceable wall', () => {
    expect(labels(SITE_PORTFOLIO.STACK_CHIPS)).toEqual(
      expect.arrayContaining(['WebGL', 'WebGPU'])
    );
  });

  test('frontend group lists WebGL and WebGPU where canvases paint', () => {
    const frontend = SITE_PORTFOLIO.STACK_GROUPS.find((group) => group.id === 'frontend');
    expect(labels(frontend.items)).toEqual(expect.arrayContaining(['WebGL', 'WebGPU']));
  });

  test('project stacks tag GPU only where it runs', () => {
    expect(projectStack('disasters')).toContain('WebGPU');
    expect(projectStack('gse-analyzer')).toContain('WebGPU');
    expect(projectStack('glazed')).toContain('WebGL');
    expect(projectStack('middle-east')).toContain('WebGL');
    expect(projectStack('unit-tests')).not.toContain('WebGL');
    expect(projectStack('unit-tests')).not.toContain('WebGPU');
    expect(projectStack('encompass')).not.toContain('WebGPU');
  });

  test('stack desk is open at a glance — tags, no accordion', () => {
    const html = SITE_PORTFOLIO.renderLaneStackDesk({ loggedIn: true });
    expect(html).toContain('lane-stack-glance');
    expect(html).toContain('>WebGL<');
    expect(html).toContain('>WebGPU<');
    expect(html).not.toContain('<details');
    expect(html).not.toContain('Open canopy');
    expect(html).not.toContain('<summary');
  });
});
