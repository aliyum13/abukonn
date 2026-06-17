const Group = require('../models/Group');
const User = require('../models/User');

async function createGroup(req, res) {
  try {
    const { name, member_ids = [] } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Group name is required' });
    }

    const group = await Group.createGroup(name.trim(), req.user.id);

    // Creator is always a member
    await Group.addMember(group.id, req.user.id);

    // Add additional members
    for (const uid of member_ids) {
      const parsed = parseInt(uid, 10);
      if (parsed && parsed !== req.user.id) {
        await Group.addMember(group.id, parsed);
      }
    }

    const full = await Group.getGroupById(group.id);
    res.status(201).json({ group: full });
  } catch (err) {
    console.error('Create group error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getMyGroups(req, res) {
  try {
    const groups = await Group.getMyGroups(req.user.id);
    res.json({ groups });
  } catch (err) {
    console.error('Get groups error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getGroupMessages(req, res) {
  try {
    const groupId = parseInt(req.params.id, 10);
    const member = await Group.isMember(groupId, req.user.id);
    if (!member) return res.status(403).json({ message: 'Not a member of this group' });

    const messages = await Group.getGroupMessages(groupId);
    const group = await Group.getGroupById(groupId);
    const members = await Group.getGroupMembers(groupId);
    res.json({ messages, group, members });
  } catch (err) {
    console.error('Get group messages error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function sendGroupMessage(req, res) {
  try {
    const groupId = parseInt(req.params.id, 10);
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Content is required' });
    }

    const member = await Group.isMember(groupId, req.user.id);
    if (!member) return res.status(403).json({ message: 'Not a member' });

    const saved = await Group.sendGroupMessage({ groupId, senderId: req.user.id, content: content.trim() });
    const sender = await User.findById(req.user.id);
    const message = { ...saved, sender_name: sender.full_name, sender_photo: sender.profile_photo_url };

    const io = req.app.get('io');
    if (io) io.to(`group_${groupId}`).emit('receive_group_message', message);

    res.status(201).json({ message });
  } catch (err) {
    console.error('Send group message error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function addGroupMember(req, res) {
  try {
    const groupId = parseInt(req.params.id, 10);
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ message: 'user_id required' });

    const member = await Group.isMember(groupId, req.user.id);
    if (!member) return res.status(403).json({ message: 'Not a member' });

    await Group.addMember(groupId, parseInt(user_id, 10));
    res.json({ message: 'Member added' });
  } catch (err) {
    console.error('Add member error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function removeGroupMember(req, res) {
  try {
    const groupId = parseInt(req.params.id, 10);
    const userId = parseInt(req.params.userId, 10);
    const group = await Group.getGroupById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    // Only the creator or the user themselves can remove
    if (group.created_by !== req.user.id && userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await Group.removeMember(groupId, userId);
    res.json({ message: 'Member removed' });
  } catch (err) {
    console.error('Remove member error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = {
  createGroup,
  getMyGroups,
  getGroupMessages,
  sendGroupMessage,
  addGroupMember,
  removeGroupMember,
};
