const Group = require('../models/Group');
const User = require('../models/User');

async function createGroup(req, res) {
  try {
    const { name, member_ids = [], description } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Group name is required' });

    const group = await Group.createGroup(name.trim(), req.user.id, description?.trim() || null);
    await Group.addMember(group.id, req.user.id, 'admin');

    for (const uid of member_ids) {
      const parsed = parseInt(uid, 10);
      if (parsed && parsed !== req.user.id) {
        await Group.addMember(group.id, parsed, 'member', 'active');
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

    const [messages, group, members, pending] = await Promise.all([
      Group.getGroupMessages(groupId),
      Group.getGroupById(groupId),
      Group.getGroupMembers(groupId),
      Group.getPendingMembers(groupId),
    ]);
    const myRole = (await Group.isAdmin(groupId, req.user.id)) ? 'admin' : 'member';
    res.json({ messages, group, members, pending, my_role: myRole });
  } catch (err) {
    console.error('Get group messages error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function sendGroupMessage(req, res) {
  try {
    const groupId = parseInt(req.params.id, 10);
    const { content, image_url, file_url, file_name, file_size } = req.body;
    if (!content?.trim() && !image_url && !file_url) return res.status(400).json({ message: 'Message content is required' });

    const member = await Group.isMember(groupId, req.user.id);
    if (!member) return res.status(403).json({ message: 'Not a member' });

    const saved = await Group.sendGroupMessage({
      groupId,
      senderId: req.user.id,
      content: content?.trim() || '',
      imageUrl: image_url || null,
      fileUrl: file_url || null,
      fileName: file_name || null,
      fileSize: file_size || null,
    });
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

    const group = await Group.getGroupById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    if (!(await Group.isMember(groupId, req.user.id))) {
      return res.status(403).json({ message: 'Not a member' });
    }
    if (group.only_admins_can_add && !(await Group.isAdmin(groupId, req.user.id))) {
      return res.status(403).json({ message: 'Only admins can add members' });
    }

    const targetId = parseInt(user_id, 10);
    const status = group.require_approval ? 'pending' : 'active';
    await Group.addMember(groupId, targetId, 'member', status);
    res.json({ message: status === 'pending' ? 'Join request sent' : 'Member added' });
  } catch (err) {
    console.error('Add member error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function removeGroupMember(req, res) {
  try {
    const groupId = parseInt(req.params.id, 10);
    const userId = parseInt(req.params.userId, 10);
    const isSelf = userId === req.user.id;
    const admin = await Group.isAdmin(groupId, req.user.id);

    if (!admin && !isSelf) return res.status(403).json({ message: 'Only admins can remove members' });
    if (isSelf && admin) {
      if ((await Group.countAdmins(groupId)) <= 1) {
        return res.status(400).json({ message: 'Promote another admin before leaving' });
      }
    }

    await Group.removeMember(groupId, userId);
    res.json({ message: 'Member removed' });
  } catch (err) {
    console.error('Remove member error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function setMemberRoleHandler(req, res) {
  try {
    const groupId = parseInt(req.params.id, 10);
    const targetId = parseInt(req.params.userId, 10);
    const { role } = req.body;
    if (!['admin', 'member'].includes(role)) return res.status(400).json({ message: 'Invalid role' });
    if (!(await Group.isAdmin(groupId, req.user.id))) {
      return res.status(403).json({ message: 'Only admins can change roles' });
    }
    if (role === 'member' && (await Group.countAdmins(groupId)) <= 1) {
      return res.status(400).json({ message: 'Group must have at least one admin' });
    }
    await Group.setMemberRole(groupId, targetId, role);
    res.json({ message: 'Role updated' });
  } catch (err) {
    console.error('Set role error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function leaveGroup(req, res) {
  try {
    const groupId = parseInt(req.params.id, 10);
    if (await Group.isAdmin(groupId, req.user.id)) {
      if ((await Group.countAdmins(groupId)) <= 1) {
        return res.status(400).json({ message: 'Promote another admin before leaving, or delete the group.' });
      }
    }
    await Group.removeMember(groupId, req.user.id);
    res.json({ message: 'Left group' });
  } catch (err) {
    console.error('Leave group error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function deleteGroupHandler(req, res) {
  try {
    const groupId = parseInt(req.params.id, 10);
    if (!(await Group.isAdmin(groupId, req.user.id))) {
      return res.status(403).json({ message: 'Only admins can delete the group' });
    }
    await Group.deleteGroup(groupId);
    res.json({ message: 'Group deleted' });
  } catch (err) {
    console.error('Delete group error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getInviteLink(req, res) {
  try {
    const groupId = parseInt(req.params.id, 10);
    if (!(await Group.isMember(groupId, req.user.id))) return res.status(403).json({ message: 'Not a member' });
    const group = await Group.getGroupById(groupId);
    res.json({ invite_code: group.invite_code, invite_enabled: group.invite_enabled });
  } catch (err) {
    console.error('Get invite error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function resetGroupInviteCode(req, res) {
  try {
    const groupId = parseInt(req.params.id, 10);
    if (!(await Group.isAdmin(groupId, req.user.id))) {
      return res.status(403).json({ message: 'Only admins can reset the invite link' });
    }
    const newCode = await Group.resetInviteCode(groupId);
    res.json({ invite_code: newCode });
  } catch (err) {
    console.error('Reset invite error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

// GET /join/:inviteCode — preview group before joining
async function getGroupByInvitePreview(req, res) {
  try {
    const group = await Group.getGroupByInviteCode(req.params.inviteCode);
    if (!group) return res.status(404).json({ message: 'Invalid or expired invite link' });
    const isMem = await Group.isMember(group.id, req.user.id);
    res.json({ group: { ...group, is_member: isMem } });
  } catch (err) {
    console.error('Preview invite error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

// POST /join/:inviteCode — actually join
async function joinByInviteCode(req, res) {
  try {
    const group = await Group.getGroupByInviteCode(req.params.inviteCode);
    if (!group) return res.status(404).json({ message: 'Invalid or expired invite link' });
    if (await Group.isMember(group.id, req.user.id)) {
      return res.json({ message: 'Already a member', group, already_member: true });
    }
    const status = group.require_approval ? 'pending' : 'active';
    await Group.addMember(group.id, req.user.id, 'member', status);
    res.json({ message: status === 'pending' ? 'Join request sent' : 'Joined group', group, pending: status === 'pending' });
  } catch (err) {
    console.error('Join by invite error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getPendingMembersHandler(req, res) {
  try {
    const groupId = parseInt(req.params.id, 10);
    if (!(await Group.isAdmin(groupId, req.user.id))) {
      return res.status(403).json({ message: 'Admins only' });
    }
    const pending = await Group.getPendingMembers(groupId);
    res.json({ pending });
  } catch (err) {
    console.error('Get pending error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function approveMember(req, res) {
  try {
    const groupId = parseInt(req.params.id, 10);
    const targetId = parseInt(req.params.userId, 10);
    if (!(await Group.isAdmin(groupId, req.user.id))) return res.status(403).json({ message: 'Admins only' });
    await Group.setMemberStatus(groupId, targetId, 'active');
    res.json({ message: 'Member approved' });
  } catch (err) {
    console.error('Approve error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function rejectMember(req, res) {
  try {
    const groupId = parseInt(req.params.id, 10);
    const targetId = parseInt(req.params.userId, 10);
    if (!(await Group.isAdmin(groupId, req.user.id))) return res.status(403).json({ message: 'Admins only' });
    await Group.removeMember(groupId, targetId);
    res.json({ message: 'Member rejected' });
  } catch (err) {
    console.error('Reject error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function updateGroupSettingsHandler(req, res) {
  try {
    const groupId = parseInt(req.params.id, 10);
    if (!(await Group.isAdmin(groupId, req.user.id))) {
      return res.status(403).json({ message: 'Only admins can update settings' });
    }
    const { name, description, require_approval, only_admins_can_add, invite_enabled } = req.body;
    const updated = await Group.updateGroupSettings(groupId, {
      name: name?.trim(),
      description: description !== undefined ? (description?.trim() || null) : undefined,
      requireApproval: require_approval,
      onlyAdminsCanAdd: only_admins_can_add,
      inviteEnabled: invite_enabled,
    });
    res.json({ group: updated });
  } catch (err) {
    console.error('Update settings error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function deleteGroupMessageHandler(req, res) {
  try {
    const groupId = parseInt(req.params.id, 10);
    const messageId = parseInt(req.params.messageId, 10);
    if (!messageId) return res.status(400).json({ message: 'Invalid message id' });

    const result = await Group.deleteGroupMessage(messageId, req.user.id);

    if (result.error === 'not_found') {
      return res.status(404).json({ message: 'Message not found' });
    }
    if (result.error === 'forbidden') {
      return res.status(403).json({ message: 'You can only delete your own messages' });
    }
    if (result.error === 'already_deleted') {
      return res.json({ message: 'Message already deleted', data: result.message });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`group_${groupId}`).emit('group_message_deleted', {
        messageId: result.message.id,
        groupId,
      });
    }

    res.json({ message: 'Message deleted', data: result.message });
  } catch (err) {
    console.error('Delete group message error:', err.message);
    res.status(500).json({ message: 'Server error deleting message' });
  }
}

module.exports = {
  createGroup, getMyGroups, getGroupMessages, sendGroupMessage,
  addGroupMember, removeGroupMember, setMemberRoleHandler, leaveGroup, deleteGroupHandler,
  getInviteLink, resetGroupInviteCode, joinByInviteCode, getGroupByInvitePreview,
  getPendingMembersHandler, approveMember, rejectMember, updateGroupSettingsHandler,
  deleteGroupMessageHandler,
};
