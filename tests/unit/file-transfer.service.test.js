/**
 * Development work by David Lane
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  setTransferDirForTests,
  saveTransferFile,
  listTransferFiles,
  getTransferFile,
  deleteTransferFile,
  isAllowedUpload,
  classifyKind,
  MAX_FILE_BYTES,
} from '../../services/file-transfer.service.js';

describe('file-transfer.service', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ft-'));
    setTransferDirForTests(tmpDir);
  });

  afterEach(async () => {
    setTransferDirForTests(null);
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('isAllowedUpload accepts docs and spreadsheets', () => {
    expect(isAllowedUpload('rates.xlsx')).toBe(true);
    expect(isAllowedUpload('memo.pdf')).toBe(true);
    expect(isAllowedUpload('export.csv')).toBe(true);
    expect(isAllowedUpload('bundle.zip')).toBe(true);
    expect(isAllowedUpload('photo.png')).toBe(false);
    expect(isAllowedUpload('run.exe')).toBe(false);
  });

  test('classifyKind', () => {
    expect(classifyKind('a.xlsx')).toBe('spreadsheet');
    expect(classifyKind('b.pdf')).toBe('document');
    expect(classifyKind('c.zip')).toBe('archive');
  });

  test('save / list / get / delete round-trip', async () => {
    const buf = Buffer.from('loan,amount\n1,100\n');
    const saved = await saveTransferFile({
      buffer: buf,
      originalName: 'loans.csv',
      mimeType: 'text/csv',
      note: 'test batch',
    });
    expect(saved.id).toBeTruthy();
    expect(saved.originalName).toBe('loans.csv');
    expect(saved.kind).toBe('spreadsheet');
    expect(saved.note).toBe('test batch');
    expect(saved.bytes).toBe(buf.length);

    const listed = await listTransferFiles();
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe(saved.id);

    const got = await getTransferFile(saved.id);
    expect(got).not.toBeNull();
    expect(got.buffer.toString('utf8')).toBe(buf.toString('utf8'));
    expect(got.meta.originalName).toBe('loans.csv');

    const deleted = await deleteTransferFile(saved.id);
    expect(deleted).toBe(true);
    expect(await listTransferFiles()).toHaveLength(0);
    expect(await getTransferFile(saved.id)).toBeNull();
  });

  test('rejects empty and disallowed types', async () => {
    await expect(
      saveTransferFile({ buffer: Buffer.alloc(0), originalName: 'a.csv' })
    ).rejects.toMatchObject({ code: 'FILE_REQUIRED' });

    await expect(
      saveTransferFile({ buffer: Buffer.from('x'), originalName: 'evil.exe' })
    ).rejects.toMatchObject({ code: 'FILE_TYPE_NOT_ALLOWED' });
  });

  test('rejects oversized files', async () => {
    const big = Buffer.alloc(MAX_FILE_BYTES + 1, 1);
    await expect(
      saveTransferFile({ buffer: big, originalName: 'huge.xlsx' })
    ).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
  });
});
