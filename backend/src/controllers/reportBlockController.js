const ReportBlock = require('../models/ReportBlock');

const VALID_REASONS = [
  'spam',
  'harassment',
  'hate_speech',
  'misinformation',
  'inappropriate_content',
  'impersonation',
  'other',
];

// ── Reports ───────────────────────────────────────────────────────────────────

async function reportPost(req, res) {
  try {
    const postId = parseInt(req.params.id, 10);
    const { reason, details } = req.body;
    if (!VALID_REASONS.includes(reason)) {
      return res.status(400).json({ message: 'Invalid report reason.' });
    }
    const result = await ReportBlock.createReport({
      reporterId: req.user.id,
      reportedPostId: postId,
      reason,
      details,
    });
    if (result.duplicate) {
      return res.status(409).json({ message: 'You have already reported this post.' });
    }
    res.status(201).json({ message: 'Report submitted. Our team will review it shortly.' });
  } catch (err) {
    console.error('Report post error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function reportUser(req, res) {
  try {
    const userId = parseInt(req.params.id, 10);
    if (userId === req.user.id) {
      return res.status(400).json({ message: 'You cannot report yourself.' });
    }
    const { reason, details } = req.body;
    if (!VALID_REASONS.includes(reason)) {
      return res.status(400).json({ message: 'Invalid report reason.' });
    }
    const result = await ReportBlock.createReport({
      reporterId: req.user.id,
      reportedUserId: userId,
      reason,
      details,
    });
    if (result.duplicate) {
      return res.status(409).json({ message: 'You have already reported this user.' });
    }
    res.status(201).json({ message: 'Report submitted. Our team will review it shortly.' });
  } catch (err) {
    console.error('Report user error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

// ── Blocks ───────────────────────────────────────────────────────────────────

async function blockUser(req, res) {
  try {
    const blockedId = parseInt(req.params.id, 10);
    if (blockedId === req.user.id) {
      return res.status(400).json({ message: 'You cannot block yourself.' });
    }
    await ReportBlock.blockUser(req.user.id, blockedId);
    res.json({ message: 'User blocked.' });
  } catch (err) {
    console.error('Block user error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function unblockUser(req, res) {
  try {
    const blockedId = parseInt(req.params.id, 10);
    await ReportBlock.unblockUser(req.user.id, blockedId);
    res.json({ message: 'User unblocked.' });
  } catch (err) {
    console.error('Unblock user error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getBlockList(req, res) {
  try {
    const list = await ReportBlock.getBlockList(req.user.id);
    res.json({ blocked: list });
  } catch (err) {
    console.error('Get block list error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getBlockStatus(req, res) {
  try {
    const targetId = parseInt(req.params.id, 10);
    const blocked = await ReportBlock.isBlocked(req.user.id, targetId);
    const blockedBy = await ReportBlock.isBlocked(targetId, req.user.id);
    res.json({ blocked, blocked_by: blockedBy });
  } catch (err) {
    console.error('Block status error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

// ── Admin ─────────────────────────────────────────────────────────────────────

async function adminGetReports(req, res) {
  try {
    const status = req.query.status || 'pending';
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;
    const reports = await ReportBlock.getReports({ status, limit, offset });
    res.json({ reports });
  } catch (err) {
    console.error('Admin get reports error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function adminResolveReport(req, res) {
  try {
    const reportId = parseInt(req.params.id, 10);
    const { status } = req.body;
    if (!['resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ message: 'Status must be resolved or dismissed.' });
    }
    const report = await ReportBlock.resolveReport({ reportId, adminId: req.user.id, status });
    if (!report) return res.status(404).json({ message: 'Report not found.' });
    res.json({ message: `Report ${status}.`, report });
  } catch (err) {
    console.error('Admin resolve report error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = {
  reportPost,
  reportUser,
  blockUser,
  unblockUser,
  getBlockList,
  getBlockStatus,
  adminGetReports,
  adminResolveReport,
};
