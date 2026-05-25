/**
 * Development work by David Lane
 */
import express from 'express';
import * as loanPipelineController from '../controllers/loan-pipeline.controller.js';
import * as loanPipelineAIController from '../controllers/loan-pipeline-ai.controller.js';

const router = express.Router();

/**
 * Loan Pipeline Routes
 * All routes prefixed with /api/loan-pipeline
 */

// Generate test loans
router.post('/generate', loanPipelineController.generateTestLoans);

// Get all loans with optional filters
router.get('/loans', loanPipelineController.getAllLoans);

// Get single loan by ID
router.get('/loans/:id', loanPipelineController.getLoanById);

// Trigger risk analysis for all loans
router.post('/analyze', loanPipelineController.analyzeAllLoans);

// Analyze single loan
router.post('/analyze/:id', loanPipelineController.analyzeSingleLoan);

// Download KML file
router.get('/kml', loanPipelineController.downloadKML);

// Get pipeline statistics
router.get('/stats', loanPipelineController.getPipelineStats);

// Get loans by milestone
router.get('/milestones/:milestone', loanPipelineController.getLoansByMilestone);

// Get risk analysis summary
router.get('/risk-summary', loanPipelineController.getRiskSummary);

// Get FEMA disasters from stored loan data
router.get('/fema-disasters', loanPipelineController.getFEMADisasters);

// Query FEMA API directly (like tool3)
router.get('/query-fema', loanPipelineController.queryFEMADirect);

// Get flood zones from FEMA NFHL
router.get('/flood-zones', loanPipelineController.getFloodZones);

// Get loans grouped by flood zones (for unified disasters page)
router.get('/flood-zones-loans', loanPipelineController.getFloodZonesLoans);

// Update flood zones for all loans
router.post('/update-flood-zones', loanPipelineController.updateFloodZones);

// Geocode loans missing coordinates
router.post('/geocode-loans', loanPipelineController.geocodeLoans);

// Re-geocode loans with incorrect coordinates
router.post('/regeocode-loans', loanPipelineController.regeocodeLoans);

// Cleanup test loans
router.delete('/cleanup', loanPipelineController.cleanupTestLoans);

// AI Chat and Insights
router.post('/ai/chat', loanPipelineAIController.chatWithAI);
router.post('/ai/chat-disaster-expert', loanPipelineAIController.chatWithDisasterExpert);
router.post('/ai/insights', loanPipelineAIController.generateInsights);
router.post('/ai/analyze', loanPipelineAIController.analyzeDashboardData);
router.get('/ai/history', loanPipelineAIController.getConversationHistory);

export default router;
