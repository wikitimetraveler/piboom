/**
 * Development work by David Lane
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  parseEadAppraisalZip,
  buildSyntheticEadZip,
  getEadSessionAsset,
  clearEadSessionsForTests,
  listEadSamples,
  parseEadSample,
  MAX_ZIP_BYTES,
} from '../../services/ead-appraisal.service.js';

describe('ead-appraisal.service', () => {
  afterEach(async () => {
    await clearEadSessionsForTests();
  });

  test('MAX_ZIP_BYTES is 60 MB', () => {
    expect(MAX_ZIP_BYTES).toBe(60 * 1024 * 1024);
  });

  test('happy path: one XML, one PDF, two JPGs, fields and image match', async () => {
    const zip = buildSyntheticEadZip();
    const result = await parseEadAppraisalZip(zip, { originalName: 'SF5_Appraisal.zip' });

    expect(result.ok).toBe(true);
    expect(result.findings.filter((f) => f.severity === 'Fatal')).toHaveLength(0);
    expect(result.summary.documentType).toBe('AppraisalReport');
    expect(result.summary.opinionOfValue).toBe('195000');
    expect(result.summary.marketValueCondition).toBe('AsIs');
    expect(result.summary.effectiveDate).toBe('2019-10-05');
    expect(result.summary.appraiserName).toBe('Tom Appraiser');
    expect(result.summary.borrowerName).toBe('Betty Borrower');
    expect(result.summary.subjectAddress).toMatch(/12345 Holiday Hwy/i);
    expect(result.summary.subjectAddress).toMatch(/Surfside/i);
    expect(result.package.xmlCount).toBe(1);
    expect(result.package.pdfCount).toBe(1);
    expect(result.package.imageCount).toBe(2);
    expect(result.images).toHaveLength(2);
    expect(result.images[0].caption).toMatch(/front/i);
    expect(result.images[0].category).toMatch(/DwellingFront/i);
    expect(result.images[0].group).toBe('DwellingFront');
    expect(result.images[0].uadCategory).toBe('DwellingFront');
    expect(result.images[1].category).toMatch(/Kitchen/i);
    expect(result.images[1].group).toBe('UnitInteriorExhibit');
    expect(result.images[0].displayTitle).toMatch(/front/i);
    expect(result.sales.map((row) => row.role)).toEqual(['SubjectProperty', 'SalesComparable']);
    expect(result.sales[1].salePrice).toBe(190000);
    expect(result.sales[1].adjustedPrice).toBe(200000);
    expect(result.sales[0].latitude).toBeCloseTo(21.28, 2);
    expect(result.pdf).toBeTruthy();
    expect(result.sessionId).toBeTruthy();

    const asset = await getEadSessionAsset(result.sessionId, result.pdf.name);
    expect(asset).toBeTruthy();
    expect(asset.contentType).toBe('application/pdf');
    expect(asset.buffer.length).toBeGreaterThan(0);
  });

  test('missing PDF yields SYS9003', async () => {
    const zip = buildSyntheticEadZip({ includePdf: false });
    const result = await parseEadAppraisalZip(zip);

    expect(result.ok).toBe(false);
    expect(result.findings.some((f) => f.code === 'SYS9003')).toBe(true);
    expect(result.package.pdfCount).toBe(0);
  });

  test('two XML files yields SYS9001 too-many finding', async () => {
    const zip = buildSyntheticEadZip({ includeSecondXml: true });
    const result = await parseEadAppraisalZip(zip);

    expect(result.ok).toBe(false);
    const tooMany = result.findings.find(
      (f) => f.code === 'SYS9001' && /Too many XML/i.test(f.message)
    );
    expect(tooMany).toBeTruthy();
    expect(result.package.xmlCount).toBe(2);
  });

  test('unknown document type is a fatal finding', async () => {
    const zip = buildSyntheticEadZip({ documentType: 'LegacyForm1004' });
    const result = await parseEadAppraisalZip(zip);

    expect(result.ok).toBe(false);
    expect(
      result.findings.some(
        (f) => f.code === 'SYS9001' && /document type/i.test(f.message)
      )
    ).toBe(true);
  });

  test('image named in XML but absent from ZIP yields SYS9008', async () => {
    const zip = buildSyntheticEadZip({ omitReferencedImage: true });
    const result = await parseEadAppraisalZip(zip);

    expect(result.findings.some((f) => f.code === 'SYS9008')).toBe(true);
    const kitchenMissing = result.findings.find(
      (f) => f.code === 'SYS9008' && /kitchen/i.test(f.message)
    );
    expect(kitchenMissing).toBeTruthy();
    expect(kitchenMissing.severity).toBe('Warning');
  });

  test('PDF name mismatch yields SYS9004', async () => {
    const zip = buildSyntheticEadZip({
      pdfName: 'other-report.pdf',
      xmlPdfRef: 'SF5_Appraisal_v1.4.pdf',
    });
    const result = await parseEadAppraisalZip(zip);

    expect(result.findings.some((f) => f.code === 'SYS9004')).toBe(true);
  });

  test('empty buffer is rejected', async () => {
    await expect(parseEadAppraisalZip(Buffer.alloc(0))).rejects.toMatchObject({
      code: 'ZIP_REQUIRED',
    });
  });

  test('listEadSamples returns local Appendix D-1 zips when present', async () => {
    const catalog = await listEadSamples();
    expect(catalog).toHaveProperty('samples');
    expect(Array.isArray(catalog.samples)).toBe(true);
    const sf5Path = path.join(catalog.dir, 'Appendix D-1 SF5_Appraisal.zip');
    if (!fs.existsSync(sf5Path)) {
      expect(catalog.available).toBe(false);
      return;
    }
    expect(catalog.available).toBe(true);
    const sf5 = catalog.samples.find((s) => s.id === 'sf5');
    expect(sf5).toBeTruthy();
    expect(sf5.recommended).toBe(true);
  });

  test('parseEadSample parses SF5 when fixture is on disk', async () => {
    const catalog = await listEadSamples();
    const sf5 = catalog.samples.find((s) => s.id === 'sf5');
    if (!sf5) return;

    const result = await parseEadSample('sf5');
    expect(result.sample.fileName).toMatch(/SF5/i);
    expect(result.package.xmlCount).toBe(1);
    expect(result.package.pdfCount).toBe(1);
    expect(result.summary).toBeTruthy();
    expect(result.summary.documentType).toBeTruthy();
    expect(result.images.length).toBeGreaterThan(0);
  });
});
