/**
 * Development work by David Lane
 */
import { Router } from 'express';
import { 
  markAttended, 
  getMyShows, 
  getMyStats, 
  checkAttendance, 
  removeAttendance,
  getShowsWithCounts
} from '../controllers/user-show-attendance.controller.js';

const router = Router();

// Mark a show as attended
router.post('/users/:userId/shows/:showId/attend', markAttended);

// Get user's attended shows
router.get('/users/:userId/shows', getMyShows);

// Get user show statistics
router.get('/users/:userId/stats', getMyStats);

// Check if user attended a specific show
router.get('/users/:userId/shows/:showId/attendance', checkAttendance);

// Remove show attendance
router.delete('/users/:userId/shows/:showId/attend', removeAttendance);

// Get all shows with attendance counts
router.get('/shows/attendance-counts', getShowsWithCounts);

export default router;
