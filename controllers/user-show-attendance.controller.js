import { 
  markShowAttended, 
  getUserAttendedShows, 
  getUserShowStats, 
  checkUserAttendance,
  removeShowAttendance,
  getShowsWithAttendanceCounts
} from '../services/user-show-attendance.service.js';

/**
 * Mark a show as attended by user
 */
export async function markAttended(req, res) {
  try {
    const { userId, showId } = req.params;
    const { personalNotes, rating, photos } = req.body;

    if (!userId || !showId) {
      return res.status(400).json({ error: 'User ID and Show ID are required' });
    }

    const attendance = await markShowAttended(userId, showId, {
      personalNotes,
      rating,
      photos
    });

    res.json({
      success: true,
      attendance,
      message: 'Show marked as attended!'
    });

  } catch (error) {
    console.error('Error marking show as attended:', error);
    res.status(500).json({ error: 'Failed to mark show as attended' });
  }
}

/**
 * Get user's attended shows
 */
export async function getMyShows(req, res) {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const shows = await getUserAttendedShows(userId);
    const stats = await getUserShowStats(userId);

    res.json({
      success: true,
      shows,
      stats,
      total: shows.length
    });

  } catch (error) {
    console.error('Error getting user shows:', error);
    res.status(500).json({ error: 'Failed to get user shows' });
  }
}

/**
 * Get user show statistics
 */
export async function getMyStats(req, res) {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const stats = await getUserShowStats(userId);

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error getting user stats:', error);
    res.status(500).json({ error: 'Failed to get user stats' });
  }
}

/**
 * Check if user attended a specific show
 */
export async function checkAttendance(req, res) {
  try {
    const { userId, showId } = req.params;

    if (!userId || !showId) {
      return res.status(400).json({ error: 'User ID and Show ID are required' });
    }

    const attendance = await checkUserAttendance(userId, showId);

    res.json({
      success: true,
      attended: !!attendance,
      attendance
    });

  } catch (error) {
    console.error('Error checking attendance:', error);
    res.status(500).json({ error: 'Failed to check attendance' });
  }
}

/**
 * Remove show attendance
 */
export async function removeAttendance(req, res) {
  try {
    const { userId, showId } = req.params;

    if (!userId || !showId) {
      return res.status(400).json({ error: 'User ID and Show ID are required' });
    }

    const result = await removeShowAttendance(userId, showId);

    res.json({
      success: true,
      message: 'Show attendance removed',
      removed: !!result
    });

  } catch (error) {
    console.error('Error removing attendance:', error);
    res.status(500).json({ error: 'Failed to remove attendance' });
  }
}

/**
 * Get all shows with attendance counts
 */
export async function getShowsWithCounts(req, res) {
  try {
    const shows = await getShowsWithAttendanceCounts();

    res.json({
      success: true,
      shows,
      total: shows.length
    });

  } catch (error) {
    console.error('Error getting shows with counts:', error);
    res.status(500).json({ error: 'Failed to get shows with attendance counts' });
  }
}
