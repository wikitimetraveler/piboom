/**
 * Development work by David Lane
 */
import { getPool } from '../services/database.service.js';
import {
  saveUnitTestFile,
  listUnitTestFiles,
  getUnitTestFile,
  searchByFieldId,
  getFieldCoverageImpact,
  getCoverageGaps,
  deleteUnitTestFile,
} from '../services/unit-tests-file.service.js';
import {
  saveBrRuleFile,
  listBrRuleFiles,
  getBrRuleFile,
  searchBrRulesByFieldId,
  deleteBrRuleFile,
} from '../services/business-rule-files.service.js';
import {
  getLearnHints,
  saveLearnHints,
} from '../services/unit-tests-learn-hints.service.js';
import {
  exportFolderExists,
  streamTsExportZip,
  TS_EXPORT_ZIP_NAME,
} from '../services/unit-tests-export.service.js';

/**
 * Download portable TypeScript export bundle (on-demand zip).
 * GET /api/unit-tests/ts-export
 */
export async function downloadTsExportHandler(req, res) {
  try {
    if (!exportFolderExists()) {
      return res.status(404).json({ error: 'TypeScript export bundle not found' });
    }
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${TS_EXPORT_ZIP_NAME}"`);
    await streamTsExportZip(res);
  } catch (error) {
    console.error('Error streaming TS export zip:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Failed to create export zip',
        message: error.message,
      });
    }
  }
}

/**
 * Upload unit test Excel file to library
 * POST /api/unit-tests/files
 */
export async function uploadUnitTestFile(req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const record = await saveUnitTestFile(req.file.buffer, req.file.originalname);
    return res.status(201).json({
      success: true,
      file: {
        id: record.id,
        file_name: record.file_name,
        original_name: record.original_name,
        field_ids: record.field_ids,
        row_count: record.row_count,
        uploaded_at: record.uploaded_at,
      },
    });
  } catch (error) {
    console.error('Error uploading unit test file:', error);
    return res.status(500).json({
      error: 'Failed to upload unit test file',
      message: error.message,
    });
  }
}

/**
 * List all stored unit test files
 * GET /api/unit-tests/files
 */
export async function listUnitTestFilesHandler(req, res) {
  try {
    const files = await listUnitTestFiles();
    return res.json({ success: true, files });
  } catch (error) {
    console.error('Error listing unit test files:', error);
    return res.status(500).json({
      error: 'Failed to list unit test files',
      message: error.message,
    });
  }
}

/**
 * Get unit test file by id (download)
 * GET /api/unit-tests/files/:id
 */
export async function getUnitTestFileHandler(req, res) {
  try {
    const { id } = req.params;
    const result = await getUnitTestFile(parseInt(id, 10));
    if (!result) {
      return res.status(404).json({ error: 'Unit test file not found' });
    }
    const fileName = result.original_name || result.file_name;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.send(result.buffer);
  } catch (error) {
    console.error('Error getting unit test file:', error);
    return res.status(500).json({
      error: 'Failed to get unit test file',
      message: error.message,
    });
  }
}

/**
 * Search unit test files by field ID
 * GET /api/unit-tests/search?fieldId=...
 */
export async function searchUnitTestsByFieldId(req, res) {
  try {
    const { fieldId } = req.query;
    if (!fieldId || !String(fieldId).trim()) {
      return res.status(400).json({ error: 'fieldId query parameter is required' });
    }
    const files = await searchByFieldId(String(fieldId).trim());
    return res.json({ success: true, files });
  } catch (error) {
    console.error('Error searching unit test files:', error);
    return res.status(500).json({
      error: 'Failed to search unit test files',
      message: error.message,
    });
  }
}

/**
 * Field coverage impact (library files + co-occurring fields).
 * GET /api/unit-tests/coverage?fieldId=...
 */
export async function getFieldCoverageHandler(req, res) {
  try {
    const { fieldId } = req.query;
    if (!fieldId || !String(fieldId).trim()) {
      return res.status(400).json({ error: 'fieldId query parameter is required' });
    }
    const impact = await getFieldCoverageImpact(String(fieldId).trim());
    return res.json({ success: true, ...impact });
  } catch (error) {
    console.error('Error getting field coverage:', error);
    return res.status(500).json({
      error: 'Failed to get field coverage',
      message: error.message,
    });
  }
}

/**
 * Coverage gaps for a manifest of field IDs.
 * POST /api/unit-tests/coverage/gaps  body: { fieldIds: string[] }
 */
export async function postCoverageGapsHandler(req, res) {
  try {
    const fieldIds = req.body?.fieldIds;
    if (!Array.isArray(fieldIds)) {
      return res.status(400).json({ error: 'fieldIds array is required in request body' });
    }
    const gaps = await getCoverageGaps(fieldIds);
    return res.json({ success: true, ...gaps });
  } catch (error) {
    console.error('Error computing coverage gaps:', error);
    return res.status(500).json({
      error: 'Failed to compute coverage gaps',
      message: error.message,
    });
  }
}

/**
 * GET /api/unit-tests/learn-hints?clientId=...
 */
export async function getLearnHintsHandler(req, res) {
  try {
    const clientId = req.query.clientId || req.headers['x-unit-tests-client-id'];
    const hints = await getLearnHints(clientId);
    return res.json({ success: true, hints, clientId: clientId || 'default' });
  } catch (error) {
    console.error('Error loading learn hints:', error);
    return res.status(500).json({
      error: 'Failed to load learn hints',
      message: error.message,
    });
  }
}

/**
 * PUT /api/unit-tests/learn-hints  body: { clientId?, hints }
 */
export async function putLearnHintsHandler(req, res) {
  try {
    const { clientId, hints } = req.body || {};
    if (!hints || typeof hints !== 'object') {
      return res.status(400).json({ error: 'hints object is required in request body' });
    }
    const saved = await saveLearnHints(clientId, hints);
    return res.json({ success: true, hints: saved, clientId: clientId || 'default' });
  } catch (error) {
    console.error('Error saving learn hints:', error);
    return res.status(500).json({
      error: 'Failed to save learn hints',
      message: error.message,
    });
  }
}

/**
 * Delete unit test file from library
 * DELETE /api/unit-tests/files/:id
 */
export async function deleteUnitTestFileHandler(req, res) {
  try {
    const { id } = req.params;
    const deleted = await deleteUnitTestFile(parseInt(id, 10));
    if (!deleted) {
      return res.status(404).json({ error: 'Unit test file not found' });
    }
    return res.json({ success: true, message: 'Unit test file deleted' });
  } catch (error) {
    console.error('Error deleting unit test file:', error);
    return res.status(500).json({
      error: 'Failed to delete unit test file',
      message: error.message,
    });
  }
}

const BR_JSON_FORMATS = new Set([
  'encompass_br_xml',
  'tool8_field_matrix_json',
  'encompass_br_vb_snippet',
]);

/**
 * POST /api/unit-tests/br-rules/file — multipart field "file" (.xml, .json)
 */
export async function uploadBrRuleFileHandler(req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const record = await saveBrRuleFile(req.file.buffer, req.file.originalname || 'rule.xml');
    return res.status(201).json({
      success: true,
      file: {
        id: record.id,
        file_name: record.file_name,
        original_name: record.original_name,
        source_format: record.source_format,
        display_name: record.display_name,
        field_ids: record.field_ids,
        uploaded_at: record.uploaded_at,
      },
    });
  } catch (error) {
    console.error('Error uploading BR rule file:', error);
    return res.status(500).json({
      error: 'Failed to upload business rule',
      message: error.message,
    });
  }
}

/**
 * POST /api/unit-tests/br-rules — JSON { sourceFormat, body, originalName? }
 */
export async function saveBrRuleJsonHandler(req, res) {
  try {
    const { sourceFormat, body, originalName } = req.body || {};
    if (!sourceFormat || !BR_JSON_FORMATS.has(String(sourceFormat))) {
      return res.status(400).json({
        error: 'Invalid or missing sourceFormat',
        allowed: [...BR_JSON_FORMATS],
      });
    }
    if (body == null || String(body).trim() === '') {
      return res.status(400).json({ error: 'body is required' });
    }
    const record = await saveBrRuleFile(
      Buffer.from(String(body), 'utf8'),
      originalName || 'pasted.txt',
      sourceFormat,
    );
    return res.status(201).json({
      success: true,
      file: {
        id: record.id,
        file_name: record.file_name,
        original_name: record.original_name,
        source_format: record.source_format,
        display_name: record.display_name,
        field_ids: record.field_ids,
        uploaded_at: record.uploaded_at,
      },
    });
  } catch (error) {
    console.error('Error saving BR rule (JSON):', error);
    return res.status(500).json({
      error: 'Failed to save business rule',
      message: error.message,
    });
  }
}

export async function listBrRuleFilesHandler(req, res) {
  try {
    const files = await listBrRuleFiles();
    return res.json({ success: true, files });
  } catch (error) {
    console.error('Error listing BR rule files:', error);
    return res.status(500).json({
      error: 'Failed to list business rules',
      message: error.message,
    });
  }
}

export async function getBrRuleFileHandler(req, res) {
  try {
    const { id } = req.params;
    const row = await getBrRuleFile(parseInt(id, 10));
    if (!row) {
      return res.status(404).json({ error: 'Business rule not found' });
    }
    const { body_text, ...meta } = row;
    return res.json({
      success: true,
      file: {
        ...meta,
        body_text,
      },
    });
  } catch (error) {
    console.error('Error getting BR rule file:', error);
    return res.status(500).json({
      error: 'Failed to get business rule',
      message: error.message,
    });
  }
}

export async function searchBrRulesByFieldIdHandler(req, res) {
  try {
    const { fieldId } = req.query;
    if (!fieldId || !String(fieldId).trim()) {
      return res.status(400).json({ error: 'fieldId query parameter is required' });
    }
    const files = await searchBrRulesByFieldId(String(fieldId).trim());
    return res.json({ success: true, files });
  } catch (error) {
    console.error('Error searching BR rules:', error);
    return res.status(500).json({
      error: 'Failed to search business rules',
      message: error.message,
    });
  }
}

export async function deleteBrRuleFileHandler(req, res) {
  try {
    const { id } = req.params;
    const deleted = await deleteBrRuleFile(parseInt(id, 10));
    if (!deleted) {
      return res.status(404).json({ error: 'Business rule not found' });
    }
    return res.json({ success: true, message: 'Business rule deleted' });
  } catch (error) {
    console.error('Error deleting BR rule file:', error);
    return res.status(500).json({
      error: 'Failed to delete business rule',
      message: error.message,
    });
  }
}

/**
 * Save or update test execution record
 * POST /api/unit-tests/executions
 */
export async function saveTestExecution(req, res) {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const { fileName, testNumber, testedBy } = req.body;

    if (!fileName || !testNumber || !testedBy) {
      return res.status(400).json({ 
        error: 'Missing required fields: fileName, testNumber, testedBy' 
      });
    }

    if (!['DEVELOPER', 'UAT TESTER', 'POST RELEASE TESTER'].includes(testedBy)) {
      return res.status(400).json({ 
        error: 'Invalid testedBy value. Must be DEVELOPER, UAT TESTER, or POST RELEASE TESTER' 
      });
    }

    // Use INSERT ... ON CONFLICT to update if exists, insert if not
    const result = await pool.query(`
      INSERT INTO test_executions (file_name, test_number, tested_by, tested_at, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (file_name, test_number, tested_by) 
      DO UPDATE SET 
        tested_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [fileName, testNumber, testedBy]);

    return res.json({
      success: true,
      execution: result.rows[0]
    });
  } catch (error) {
    console.error('Error saving test execution:', error);
    return res.status(500).json({ 
      error: 'Failed to save test execution',
      message: error.message 
    });
  }
}

/**
 * Get test executions for a file
 * GET /api/unit-tests/executions?fileName=...
 * Returns empty executions on DB failure so the UI can still load.
 */
export async function getTestExecutions(req, res) {
  const { fileName } = req.query;

  if (!fileName) {
    return res.status(400).json({ error: 'fileName query parameter is required' });
  }

  try {
    const pool = getPool();
    if (!pool) {
      return res.json({ success: true, executions: {}, dbUnavailable: true });
    }

    const result = await pool.query(`
      SELECT 
        test_number,
        tested_by,
        tested_at,
        created_at,
        updated_at
      FROM test_executions
      WHERE file_name = $1
      ORDER BY test_number, tested_at DESC
    `, [fileName]);

    // Group by test_number to get the latest execution for each tester type
    const executionsByTest = {};
    result.rows.forEach(row => {
      if (!executionsByTest[row.test_number]) {
        executionsByTest[row.test_number] = {};
      }
      executionsByTest[row.test_number][row.tested_by] = {
        testedAt: row.tested_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    });

    return res.json({
      success: true,
      executions: executionsByTest
    });
  } catch (error) {
    console.error('Error getting test executions:', error);
    // Return empty executions so UI still loads; don't fail the page
    return res.json({ success: true, executions: {}, dbUnavailable: true });
  }
}

/**
 * Get all test executions (for admin/reporting)
 * GET /api/unit-tests/executions/all
 */
export async function getAllTestExecutions(req, res) {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const { limit = 100, offset = 0 } = req.query;

    const result = await pool.query(`
      SELECT 
        id,
        file_name,
        test_number,
        tested_by,
        tested_at,
        created_at,
        updated_at
      FROM test_executions
      ORDER BY tested_at DESC
      LIMIT $1 OFFSET $2
    `, [parseInt(limit), parseInt(offset)]);

    const countResult = await pool.query(`
      SELECT COUNT(*) as total FROM test_executions
    `);

    return res.json({
      success: true,
      executions: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error getting all test executions:', error);
    return res.status(500).json({ 
      error: 'Failed to get test executions',
      message: error.message 
    });
  }
}

/**
 * Delete test execution
 * DELETE /api/unit-tests/executions/:id
 */
export async function deleteTestExecution(req, res) {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const { id } = req.params;

    const result = await pool.query(`
      DELETE FROM test_executions
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Test execution not found' });
    }

    return res.json({
      success: true,
      message: 'Test execution deleted'
    });
  } catch (error) {
    console.error('Error deleting test execution:', error);
    return res.status(500).json({ 
      error: 'Failed to delete test execution',
      message: error.message 
    });
  }
}
