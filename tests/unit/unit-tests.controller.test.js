/**
 * Development work by David Lane
 */
import { jest } from '@jest/globals';

const saveUnitTestFile = jest.fn();
const listUnitTestFiles = jest.fn();
const getUnitTestFile = jest.fn();
const searchByFieldId = jest.fn();
const getFieldCoverageImpact = jest.fn();
const getCoverageGaps = jest.fn();
const deleteUnitTestFile = jest.fn();

const saveBrRuleFile = jest.fn();
const listBrRuleFiles = jest.fn();
const getBrRuleFile = jest.fn();
const searchBrRulesByFieldId = jest.fn();
const deleteBrRuleFile = jest.fn();

const getLearnHints = jest.fn();
const saveLearnHints = jest.fn();

const exportFolderExists = jest.fn();
const streamTsExportZip = jest.fn();

const queryMock = jest.fn();
const getPool = jest.fn();

await jest.unstable_mockModule('../../services/unit-tests-file.service.js', () => ({
  saveUnitTestFile,
  listUnitTestFiles,
  getUnitTestFile,
  searchByFieldId,
  getFieldCoverageImpact,
  getCoverageGaps,
  deleteUnitTestFile,
}));

await jest.unstable_mockModule('../../services/business-rule-files.service.js', () => ({
  saveBrRuleFile,
  listBrRuleFiles,
  getBrRuleFile,
  searchBrRulesByFieldId,
  deleteBrRuleFile,
}));

await jest.unstable_mockModule('../../services/unit-tests-learn-hints.service.js', () => ({
  getLearnHints,
  saveLearnHints,
}));

await jest.unstable_mockModule('../../services/unit-tests-export.service.js', () => ({
  exportFolderExists,
  streamTsExportZip,
  TS_EXPORT_ZIP_NAME: 'encompass-unit-tests-ts.zip',
}));

await jest.unstable_mockModule('../../services/database.service.js', () => ({
  getPool,
}));

const {
  uploadUnitTestFile,
  listUnitTestFilesHandler,
  getUnitTestFileHandler,
  searchUnitTestsByFieldId,
  getFieldCoverageHandler,
  postCoverageGapsHandler,
  getLearnHintsHandler,
  putLearnHintsHandler,
  deleteUnitTestFileHandler,
  uploadBrRuleFileHandler,
  saveBrRuleJsonHandler,
  getBrRuleFileHandler,
  searchBrRulesByFieldIdHandler,
  deleteBrRuleFileHandler,
  downloadTsExportHandler,
  saveTestExecution,
  getTestExecutions,
  getAllTestExecutions,
  deleteTestExecution,
} = await import('../../controllers/unit-tests.controller.js');

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.headersSent = false;
  return res;
};

describe('unit-tests.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getPool.mockReturnValue({ query: queryMock });
  });

  describe('uploadUnitTestFile', () => {
    test('returns 400 when no file uploaded', async () => {
      const res = createRes();
      await uploadUnitTestFile({ file: null }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'No file uploaded' });
      expect(saveUnitTestFile).not.toHaveBeenCalled();
    });

    test('returns 201 when file saved', async () => {
      saveUnitTestFile.mockResolvedValue({
        id: 1,
        file_name: 'a.xlsx',
        original_name: 'a.xlsx',
        field_ids: ['CX.TYPE'],
        row_count: 5,
        uploaded_at: '2026-01-01',
      });
      const res = createRes();
      await uploadUnitTestFile({ file: { buffer: Buffer.from('x'), originalname: 'a.xlsx' } }, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, file: expect.objectContaining({ id: 1 }) }),
      );
    });
  });

  describe('searchUnitTestsByFieldId', () => {
    test('returns 400 when fieldId missing', async () => {
      const res = createRes();
      await searchUnitTestsByFieldId({ query: {} }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(searchByFieldId).not.toHaveBeenCalled();
    });

    test('returns files when fieldId provided', async () => {
      searchByFieldId.mockResolvedValue([{ id: 2 }]);
      const res = createRes();
      await searchUnitTestsByFieldId({ query: { fieldId: ' CX.TYPE ' } }, res);
      expect(searchByFieldId).toHaveBeenCalledWith('CX.TYPE');
      expect(res.json).toHaveBeenCalledWith({ success: true, files: [{ id: 2 }] });
    });
  });

  describe('postCoverageGapsHandler', () => {
    test('returns 400 when fieldIds is not an array', async () => {
      const res = createRes();
      await postCoverageGapsHandler({ body: { fieldIds: 'nope' } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('returns gaps for field id list', async () => {
      getCoverageGaps.mockResolvedValue({ gaps: ['CX.MISSING'], covered: ['CX.TYPE'] });
      const res = createRes();
      await postCoverageGapsHandler({ body: { fieldIds: ['CX.TYPE', 'CX.MISSING'] } }, res);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        gaps: ['CX.MISSING'],
        covered: ['CX.TYPE'],
      });
    });
  });

  describe('putLearnHintsHandler', () => {
    test('returns 400 when hints object missing', async () => {
      const res = createRes();
      await putLearnHintsHandler({ body: {} }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('saves hints and returns payload', async () => {
      const hints = { 'CX.TYPE': { source: 'team' } };
      saveLearnHints.mockResolvedValue(hints);
      const res = createRes();
      await putLearnHintsHandler({ body: { clientId: 'ut-1', hints } }, res);
      expect(saveLearnHints).toHaveBeenCalledWith('ut-1', hints);
      expect(res.json).toHaveBeenCalledWith({ success: true, hints, clientId: 'ut-1' });
    });
  });

  describe('getUnitTestFileHandler', () => {
    test('returns 404 when file not found', async () => {
      getUnitTestFile.mockResolvedValue(null);
      const res = createRes();
      await getUnitTestFileHandler({ params: { id: '99' } }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('streams excel buffer when found', async () => {
      getUnitTestFile.mockResolvedValue({
        original_name: 'test.xlsx',
        file_name: 'test.xlsx',
        buffer: Buffer.from('excel'),
      });
      const res = createRes();
      await getUnitTestFileHandler({ params: { id: '1' } }, res);
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(res.send).toHaveBeenCalledWith(Buffer.from('excel'));
    });
  });

  describe('deleteUnitTestFileHandler', () => {
    test('returns 404 when delete returns false', async () => {
      deleteUnitTestFile.mockResolvedValue(false);
      const res = createRes();
      await deleteUnitTestFileHandler({ params: { id: '1' } }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('saveBrRuleJsonHandler', () => {
    test('returns 400 for invalid sourceFormat', async () => {
      const res = createRes();
      await saveBrRuleJsonHandler({ body: { sourceFormat: 'bad', body: 'x' } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(saveBrRuleFile).not.toHaveBeenCalled();
    });

    test('returns 400 when body empty', async () => {
      const res = createRes();
      await saveBrRuleJsonHandler({ body: { sourceFormat: 'encompass_br_xml', body: '  ' } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getBrRuleFileHandler', () => {
    test('returns 404 when rule missing', async () => {
      getBrRuleFile.mockResolvedValue(null);
      const res = createRes();
      await getBrRuleFileHandler({ params: { id: '5' } }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('downloadTsExportHandler', () => {
    test('returns 404 when export folder missing', async () => {
      exportFolderExists.mockReturnValue(false);
      const res = createRes();
      await downloadTsExportHandler({}, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(streamTsExportZip).not.toHaveBeenCalled();
    });

    test('sets zip headers and streams when folder exists', async () => {
      exportFolderExists.mockReturnValue(true);
      streamTsExportZip.mockResolvedValue(undefined);
      const res = createRes();
      await downloadTsExportHandler({}, res);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/zip');
      expect(streamTsExportZip).toHaveBeenCalledWith(res);
    });
  });

  describe('saveTestExecution', () => {
    test('returns 503 when database unavailable', async () => {
      getPool.mockReturnValue(null);
      const res = createRes();
      await saveTestExecution({ body: { fileName: 'a.xlsx', testNumber: 'overall', testedBy: 'DEVELOPER' } }, res);
      expect(res.status).toHaveBeenCalledWith(503);
    });

    test('returns 400 when required fields missing', async () => {
      const res = createRes();
      await saveTestExecution({ body: { fileName: 'a.xlsx' } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(queryMock).not.toHaveBeenCalled();
    });

    test('returns 400 for invalid testedBy', async () => {
      const res = createRes();
      await saveTestExecution(
        { body: { fileName: 'a.xlsx', testNumber: 'overall', testedBy: 'QA' } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('upserts execution and returns row', async () => {
      queryMock.mockResolvedValue({
        rows: [{ id: 10, file_name: 'a.xlsx', test_number: 'overall', tested_by: 'DEVELOPER' }],
      });
      const res = createRes();
      await saveTestExecution(
        { body: { fileName: 'a.xlsx', testNumber: 'overall', testedBy: 'DEVELOPER' } },
        res,
      );
      expect(queryMock).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, execution: expect.objectContaining({ id: 10 }) }),
      );
    });
  });

  describe('getTestExecutions', () => {
    test('returns 400 when fileName missing', async () => {
      const res = createRes();
      await getTestExecutions({ query: {} }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('returns empty executions with dbUnavailable when pool missing', async () => {
      getPool.mockReturnValue(null);
      const res = createRes();
      await getTestExecutions({ query: { fileName: 'a.xlsx' } }, res);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        executions: {},
        dbUnavailable: true,
      });
    });

    test('groups executions by test_number', async () => {
      queryMock.mockResolvedValue({
        rows: [
          {
            test_number: 'overall',
            tested_by: 'DEVELOPER',
            tested_at: '2026-01-01',
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
        ],
      });
      const res = createRes();
      await getTestExecutions({ query: { fileName: 'a.xlsx' } }, res);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        executions: {
          overall: {
            DEVELOPER: {
              testedAt: '2026-01-01',
              createdAt: '2026-01-01',
              updatedAt: '2026-01-01',
            },
          },
        },
      });
    });
  });

  describe('getAllTestExecutions', () => {
    test('returns 503 when database unavailable', async () => {
      getPool.mockReturnValue(null);
      const res = createRes();
      await getAllTestExecutions({ query: {} }, res);
      expect(res.status).toHaveBeenCalledWith(503);
    });
  });

  describe('deleteTestExecution', () => {
    test('returns 404 when id not found', async () => {
      queryMock.mockResolvedValue({ rows: [] });
      const res = createRes();
      await deleteTestExecution({ params: { id: '404' } }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('listUnitTestFilesHandler', () => {
    test('returns file list on success', async () => {
      listUnitTestFiles.mockResolvedValue([{ id: 1 }]);
      const res = createRes();
      await listUnitTestFilesHandler({}, res);
      expect(res.json).toHaveBeenCalledWith({ success: true, files: [{ id: 1 }] });
    });
  });

  describe('getFieldCoverageHandler', () => {
    test('returns 400 when fieldId missing', async () => {
      const res = createRes();
      await getFieldCoverageHandler({ query: {} }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('uploadBrRuleFileHandler', () => {
    test('returns 400 when no file uploaded', async () => {
      const res = createRes();
      await uploadBrRuleFileHandler({ file: null }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('searchBrRulesByFieldIdHandler', () => {
    test('returns 400 when fieldId missing', async () => {
      const res = createRes();
      await searchBrRulesByFieldIdHandler({ query: {} }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('deleteBrRuleFileHandler', () => {
    test('returns 404 when rule not deleted', async () => {
      deleteBrRuleFile.mockResolvedValue(false);
      const res = createRes();
      await deleteBrRuleFileHandler({ params: { id: '1' } }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getLearnHintsHandler', () => {
    test('loads hints for client id', async () => {
      getLearnHints.mockResolvedValue({ 'CX.TYPE': {} });
      const res = createRes();
      await getLearnHintsHandler({ query: { clientId: 'ut-abc' } }, res);
      expect(getLearnHints).toHaveBeenCalledWith('ut-abc');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        hints: { 'CX.TYPE': {} },
        clientId: 'ut-abc',
      });
    });
  });
});
