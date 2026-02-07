import { getPool } from '../services/database.service.js';

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
 */
export async function getTestExecutions(req, res) {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const { fileName } = req.query;

    if (!fileName) {
      return res.status(400).json({ error: 'fileName query parameter is required' });
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
    return res.status(500).json({ 
      error: 'Failed to get test executions',
      message: error.message 
    });
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
