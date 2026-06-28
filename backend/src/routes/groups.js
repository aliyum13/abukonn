const express = require('express');
const auth = require('../middleware/auth');
const {
  createGroup, getMyGroups, getGroupMessages, sendGroupMessage,
  addGroupMember, removeGroupMember, setMemberRoleHandler, leaveGroup, deleteGroupHandler,
  getInviteLink, resetGroupInviteCode, joinByInviteCode, getGroupByInvitePreview,
  getPendingMembersHandler, approveMember, rejectMember, updateGroupSettingsHandler,
} = require('../controllers/groupController');

const router = express.Router();
router.use(auth);

// Static routes before /:id
router.post('/', createGroup);
router.get('/', getMyGroups);
router.get('/join/:inviteCode', getGroupByInvitePreview);
router.post('/join/:inviteCode', joinByInviteCode);

// Group-specific routes
router.get('/:id/messages', getGroupMessages);
router.post('/:id/messages', sendGroupMessage);
router.post('/:id/members', addGroupMember);
router.delete('/:id/members/:userId', removeGroupMember);
router.patch('/:id/members/:userId/role', setMemberRoleHandler);
router.patch('/:id/members/:userId/approve', approveMember);
router.patch('/:id/members/:userId/reject', rejectMember);
router.get('/:id/pending', getPendingMembersHandler);
router.delete('/:id/leave', leaveGroup);
router.delete('/:id', deleteGroupHandler);
router.get('/:id/invite', getInviteLink);
router.post('/:id/invite/reset', resetGroupInviteCode);
router.patch('/:id/settings', updateGroupSettingsHandler);

module.exports = router;
