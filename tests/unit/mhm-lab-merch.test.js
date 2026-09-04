/**
 * Development work by David Lane
 */
import '../../public/mountain-high/js/mhm-lab-merch.js';

const { MhmLabMerch } = globalThis;

describe('MhmLabMerch', () => {
  test('QR points at the Mountain High page on the public site', () => {
    expect(MhmLabMerch.PAGE_PATH).toBe('/mountain-high/');
    expect(MhmLabMerch.pageUrl({
      brand: { publicSiteUrl: 'https://www.thelanefamily.us' },
    })).toBe('https://www.thelanefamily.us/mountain-high/');
  });
});
