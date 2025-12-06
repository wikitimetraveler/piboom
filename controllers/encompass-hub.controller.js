import { fetchPipelineLoans, fetchLoanDetails } from '../services/encompass-hub.service.js';
import {
  ensureEncompassToken,
  getEncompassEnvStatus,
  getEncompassTokenStatus,
} from '../services/encompass-auth.service.js';

export async function getHubStatus(req, res) {
  const envStatus = getEncompassEnvStatus();

  if (!envStatus.ok) {
    return res.json({
      connected: false,
      reason: 'missing-env',
      missing: envStatus.missing,
    });
  }

  try {
    if (!getEncompassTokenStatus().connected) {
      await ensureEncompassToken();
    }
    const tokenStatus = getEncompassTokenStatus();
    return res.json({
      connected: tokenStatus.connected,
      expiresAt: tokenStatus.expiresAt,
      secondsRemaining: tokenStatus.secondsRemaining,
    });
  } catch (error) {
    return res.status(500).json({
      connected: false,
      reason: 'token-error',
      message: error.message,
    });
  }
}

export async function getPipeline(req, res) {
  try {
    const { state, counties, limit, loanFolder, loanType } = req.query;
    const loans = await fetchPipelineLoans({
      state,
      counties,
      loanFolder,
      loanType,
      limit: limit ? Number(limit) : undefined,
    });

    return res.json({
      count: loans.length,
      items: loans,
    });
  } catch (error) {
    console.error('Error fetching Encompass pipeline:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch Encompass pipeline data',
      details: error.message,
    });
  }
}

export async function getLoan(req, res) {
  try {
    const { loanGuid } = req.params;
    const loan = await fetchLoanDetails(loanGuid);

    return res.json(loan);
  } catch (error) {
    console.error('Error fetching Encompass loan:', error.message);
    const status = error.response?.status === 404 ? 404 : 500;
    return res.status(status).json({
      error: status === 404 ? 'Loan not found' : 'Failed to fetch loan details',
      details: error.message,
    });
  }
}

