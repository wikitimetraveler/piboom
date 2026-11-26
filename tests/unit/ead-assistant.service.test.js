/**
 * Development work by David Lane
 */
import {
  APPRAISAL_SKILLS,
  UNDERWRITING_SKILLS,
  EXPERT_TITLE,
  buildEadExpertPrompt,
  buildPackageContext,
} from '../../services/ead-assistant.service.js';
import { photoUadCategory } from '../../services/ead-appraisal.service.js';

describe('ead appraisal and underwriting reviewer', () => {
  test('title stays the appraisal and underwriting reviewer', () => {
    expect(EXPERT_TITLE).toMatch(/appraisal/i);
    expect(EXPERT_TITLE).toMatch(/underwriting/i);
  });

  test('prompt carries both skill sets and refuses a credit decision', () => {
    const prompt = buildEadExpertPrompt();
    expect(prompt).toMatch(/Appraisal skill set/);
    expect(prompt).toMatch(/Underwriting skill set/);
    for (const skill of APPRAISAL_SKILLS.concat(UNDERWRITING_SKILLS)) {
      expect(prompt).toContain(skill.title);
    }
    expect(prompt).toMatch(/do not issue a credit decision/i);
    expect(prompt).toMatch(/new appraised value/i);
    expect(prompt).toMatch(/submitted to HUD/i);
  });

  test('package context names UAD photo categories and sales', () => {
    const text = buildPackageContext({
      label: 'SF5',
      summary: { opinionOfValue: '360000', subjectAddress: '213 Tree Stand Rd' },
      sales: [{ label: 'Comp 1', address: '318 Pine Crest Rd', salePrice: 350000, adjustedPrice: 348000 }],
      images: [{ group: 'DwellingFront', displayTitle: 'Front' }],
    });
    expect(text).toMatch(/UAD category/);
    expect(text).toMatch(/DwellingFront/);
    expect(text).toMatch(/\$350,000/);
    expect(text).toMatch(/213 Tree Stand Rd/);
  });

  test('room photos resolve to the UAD interior exhibit category', () => {
    expect(photoUadCategory({ category: 'DwellingFront' })).toBe('DwellingFront');
    expect(photoUadCategory({ category: 'Kitchen' })).toBe('UnitInteriorExhibit');
    expect(
      photoUadCategory({ roomType: 'Bedroom', location: 'Images/SF5_Bedroom1.png' })
    ).toBe('UnitInteriorExhibit');
    expect(photoUadCategory({ category: 'SalesComparableMap' })).toBe('SalesComparableMap');
    expect(photoUadCategory({ location: 'Images/SF5_VehicleStorage.png' })).toBe('VehicleStorageExhibit');
  });
});
