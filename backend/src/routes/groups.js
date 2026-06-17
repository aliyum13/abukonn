const express = require('express');
const auth = require('../middleware/auth');
const {
  createGroup,
  getMyGroups,
  getGroupMessages,
  sendGroupMessage,
  addGroupMember,
  removeGroupMember,
} = require('../controllers/groupController');

const router = express.Router();
router.use(auth);

router.post('/', createGroup);
router.get('/', getMyGroups);
router.get('/:id/messages', getGroupMessages);
router.post('/:id/messages', sendGroupMessage);
router.post('/:id/members', addGroupMember);
router.delete('/:id/members/:userId', removeGroupMember);

module.exports = router;
