'use client';

import { useEffect, useState, useRef, useCallback, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';
import { formatTime, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Avatar, Button, Card, EmptyState, Input, Skeleton } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// ── Types ────────────────────────────────────────────────────────────────────

interface Conversation {
  id: number;
  other_user_id: number;
  other_user_name: string;
  other_user_department: string;
  other_user_photo?: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

interface Group {
  id: number;
  name: string;
  avatar_url: string | null;
  created_by: number;
  member_count: number;
  pending_count?: number;
  last_message: string | null;
  last_message_at: string | null;
  last_sender_name: string | null;
  description?: string | null;
  invite_code?: string;
  invite_enabled?: boolean;
  require_approval?: boolean;
  only_admins_can_add?: boolean;
  my_role?: 'admin' | 'member';
}

interface ChatMessage {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  image_url?: string | null;
  created_at: string;
  sender_name: string;
  is_read: boolean;
  is_deleted?: boolean;
}

interface GroupMessage {
  id: number;
  group_id: number;
  sender_id: number;
  sender_name: string;
  sender_photo: string | null;
  content: string;
  created_at: string;
  is_deleted?: boolean;
}

interface GroupMember {
  id: number;
  full_name: string;
  profile_photo_url: string | null;
  department: string;
  role?: 'admin' | 'member';
  status?: string;
}

interface Follower {
  id: number;
  full_name: string;
  profile_photo_url: string | null;
  department: string;
}

type ListItem =
  | ({ kind: 'dm' } & Conversation)
  | ({ kind: 'group' } & Group);

// ── Shared-post helpers ───────────────────────────────────────────────────────

interface SharedPostData {
  type: 'shared_post';
  post_id: number;
  author_name: string;
  content: string;
  image_url: string | null;
}

function parseSharedPost(content: string): SharedPostData | null {
  try {
    const data = JSON.parse(content);
    if (data?.type === 'shared_post') return data as SharedPostData;
  } catch { /* not JSON */ }
  return null;
}

interface StoryReplyData {
  type: 'story_reply';
  story_id: number;
  story_type: 'image' | 'video' | 'text';
  media_url: string | null;
  text_content: string | null;
  bg_color: string | null;
  reply: string;
}

function parseStoryReply(content: string): StoryReplyData | null {
  try {
    const data = JSON.parse(content);
    if (data?.type === 'story_reply') return data as StoryReplyData;
  } catch { /* not JSON */ }
  return null;
}

/** Returns a friendly preview string for the conversation list. */
function friendlyPreview(content: string | null): string {
  if (!content) return 'No messages yet';
  const shared = parseSharedPost(content);
  if (shared) return `📌 Shared a post`;
  const storyReply = parseStoryReply(content);
  if (storyReply) return `↩ ${storyReply.reply}`;
  return content;
}

function SharedPostCard({ data, isSent }: { data: SharedPostData; isSent: boolean }) {
  return (
    <div className="w-full">
      <p className={cn('mb-2 text-[11px] font-medium', isSent ? 'text-brand-200' : 'text-ink-muted')}>
        📌 {data.author_name} shared a post
      </p>
      <div className={cn(
        'overflow-hidden rounded-xl border',
        isSent ? 'border-brand-500/50 bg-white/10' : 'border-border bg-surface-muted dark:bg-[#1a1a1a]'
      )}>
        {data.image_url && (
          <img
            src={data.image_url}
            alt="Shared post"
            className="h-32 w-full object-cover"
          />
        )}
        <div className="px-3 py-2.5">
          <p className={cn(
            'line-clamp-3 text-[13px] leading-relaxed',
            isSent ? 'text-white/90' : 'text-ink'
          )}>
            {data.content}
          </p>
          <Link
            href={`/feed#post-${data.post_id}`}
            className={cn(
              'mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold transition',
              isSent ? 'text-brand-200 hover:text-white' : 'text-brand-600 hover:text-brand-700'
            )}
          >
            View post
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

function StoryReplyCard({ data, isSent }: { data: StoryReplyData; isSent: boolean }) {
  return (
    <div className="w-full">
      <p className={cn('mb-2 text-[11px] font-medium', isSent ? 'text-brand-200' : 'text-ink-muted')}>
        ↩ Replied to a story
      </p>
      <div className={cn(
        'overflow-hidden rounded-xl border',
        isSent ? 'border-brand-500/50 bg-white/10' : 'border-border bg-surface-muted dark:bg-[#1a1a1a]'
      )}>
        {data.story_type === 'image' && data.media_url && (
          <img src={data.media_url} alt="Story" className="h-24 w-full object-cover" />
        )}
        {data.story_type === 'video' && data.media_url && (
          <div className="flex h-24 items-center justify-center bg-black/60">
            <svg className="h-8 w-8 text-white/80" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        )}
        {data.story_type === 'text' && data.text_content && (
          <div className="flex h-16 items-center justify-center px-3" style={{ backgroundColor: data.bg_color || '#16a34a' }}>
            <p className="line-clamp-2 text-center text-xs font-semibold text-white">{data.text_content}</p>
          </div>
        )}
        <div className="px-3 py-2">
          <p className={cn('text-[13px] leading-relaxed', isSent ? 'text-white/90' : 'text-ink')}>
            {data.reply}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Skeletons ────────────────────────────────────────────────────────────────

function ConversationSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="h-10 w-10 shrink-0" rounded="full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
    </div>
  );
}

function MessageSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex justify-start"><Skeleton className="h-10 w-48 rounded-2xl" /></div>
      <div className="flex justify-end"><Skeleton className="h-10 w-56 rounded-2xl" /></div>
      <div className="flex justify-start"><Skeleton className="h-14 w-64 rounded-2xl" /></div>
    </div>
  );
}

// ── Group icon SVG ───────────────────────────────────────────────────────────

function GroupIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function MessagesPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();

  // DM state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Group state
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [activeGroupInfo, setActiveGroupInfo] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [pendingMembers, setPendingMembers] = useState<GroupMember[]>([]);
  const [myGroupRole, setMyGroupRole] = useState<'admin' | 'member'>('member');

  // Group Info panel
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [groupInfoView, setGroupInfoView] = useState<'info' | 'settings' | 'pending'>('info');
  const [settingsForm, setSettingsForm] = useState({ name: '', description: '', require_approval: false, only_admins_can_add: false, invite_enabled: true });
  const [savingSettings, setSavingSettings] = useState(false);
  const [groupInfoToast, setGroupInfoToast] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Create group modal
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [createGroupName, setCreateGroupName] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [followerSearch, setFollowerSearch] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Shared UI state
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [typingText, setTypingText] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<Set<number>>(new Set());

  const [msgImage, setMsgImage] = useState<File | null>(null);
  const [msgImagePreview, setMsgImagePreview] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const activeIdRef = useRef<number | null>(null);
  const activeGroupIdRef = useRef<number | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  activeIdRef.current = activeId;
  activeGroupIdRef.current = activeGroupId;
  conversationsRef.current = conversations;

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !token) router.push('/login');
  }, [authLoading, token, router]);

  // ── Fetch conversations ────────────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [token]);

  // ── Fetch groups ───────────────────────────────────────────────────────────
  const fetchGroups = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/groups`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setGroups(data.groups || []);
    } catch { /* ignore */ }
  }, [token]);

  useEffect(() => {
    if (token) { fetchConversations(); fetchGroups(); }
  }, [token, fetchConversations, fetchGroups]);

  // ── Auto-open from ?userId param ───────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams(window.location.search);
    const uid = params.get('userId');
    if (!uid) return;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/messages/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ recipient_id: parseInt(uid, 10) }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const conv: Conversation = { ...data.conversation, unread_count: 0 };
        setConversations(prev => prev.some(c => c.id === conv.id) ? prev : [conv, ...prev]);
        setActiveId(conv.id);
        setActiveGroupId(null);
        setMobileShowChat(true);
        window.history.replaceState({}, '', '/messages');
      } catch { /* ignore */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Fetch DM messages ──────────────────────────────────────────────────────
  const fetchMessages = useCallback(async (conversationId: number) => {
    if (!token) return;
    setMessagesLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/messages/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMessages(data.messages || []);
      setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, unread_count: 0 } : c));
      socketRef.current?.emit('mark_read', { conversationId, token });
    } catch { setMessages([]); }
    finally { setMessagesLoading(false); }
  }, [token]);

  // ── Fetch group messages ───────────────────────────────────────────────────
  const fetchGroupMessages = useCallback(async (groupId: number) => {
    if (!token) return;
    setMessagesLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/groups/${groupId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setGroupMessages(data.messages || []);
      if (data.group) {
        setActiveGroupInfo(data.group);
        setSettingsForm({
          name: data.group.name || '',
          description: data.group.description || '',
          require_approval: data.group.require_approval || false,
          only_admins_can_add: data.group.only_admins_can_add || false,
          invite_enabled: data.group.invite_enabled !== false,
        });
        setInviteCode(data.group.invite_code || '');
      }
      if (data.members) setGroupMembers(data.members);
      if (data.pending) setPendingMembers(data.pending);
      if (data.my_role) setMyGroupRole(data.my_role);
    } catch { setGroupMessages([]); }
    finally { setMessagesLoading(false); }
  }, [token]);

  useEffect(() => { if (activeId) fetchMessages(activeId); }, [activeId, fetchMessages]);
  useEffect(() => { if (activeGroupId) fetchGroupMessages(activeGroupId); }, [activeGroupId, fetchGroupMessages]);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, groupMessages, typingText]);

  // ── Socket.io ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    const socket = io(API_URL, { autoConnect: true });
    socketRef.current = socket;

    const joinCurrentRoom = () => {
      if (activeIdRef.current) socket.emit('join_conversation', activeIdRef.current);
      if (activeGroupIdRef.current) socket.emit('join_group', activeGroupIdRef.current);
    };

    socket.on('connect', () => {
      socket.emit('user_online', token);
      joinCurrentRoom();
    });

    socket.on('receive_message', (msg: ChatMessage) => {
      if (msg.conversation_id === activeIdRef.current) {
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        socket.emit('mark_read', { conversationId: msg.conversation_id, token });
      }
      fetchConversations();
    });

    socket.on('receive_group_message', (msg: GroupMessage) => {
      if (msg.group_id === activeGroupIdRef.current) {
        setGroupMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
      }
      fetchGroups();
    });

    socket.on('message_deleted', ({ messageId, conversationId }: { messageId: number; conversationId: number }) => {
      if (conversationId === activeIdRef.current) {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_deleted: true, content: '', image_url: null } : m));
      }
    });

    socket.on('group_message_deleted', ({ messageId, groupId }: { messageId: number; groupId: number }) => {
      if (groupId === activeGroupIdRef.current) {
        setGroupMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_deleted: true, content: '' } : m));
      }
    });

    socket.on('user_typing', ({ conversationId }: { conversationId: number }) => {
      if (conversationId === activeIdRef.current) {
        const conv = conversationsRef.current.find(c => c.id === conversationId);
        setTypingText(`${conv?.other_user_name ?? 'Someone'} is typing…`);
      }
    });

    socket.on('user_stopped_typing', ({ conversationId }: { conversationId: number }) => {
      if (conversationId === activeIdRef.current) setTypingText('');
    });

    socket.on('user_status', ({ userId, online }: { userId: number; online: boolean }) => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        if (online) next.add(userId); else next.delete(userId);
        return next;
      });
    });

    socket.on('messages_read', ({ conversationId }: { conversationId: number }) => {
      if (conversationId === activeIdRef.current) {
        setMessages(prev => prev.map(m => ({ ...m, is_read: true })));
      }
    });

    socket.on('connect_error', (err) => console.warn('Socket error:', err.message));

    return () => { socket.disconnect(); socketRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, fetchConversations, fetchGroups]);

  // Join room when active conversation/group changes
  useEffect(() => {
    if (socketRef.current?.connected && activeId) {
      socketRef.current.emit('join_conversation', activeId);
      setTypingText('');
    }
  }, [activeId]);

  useEffect(() => {
    if (socketRef.current?.connected && activeGroupId) {
      socketRef.current.emit('join_group', activeGroupId);
    }
  }, [activeGroupId]);

  // Initial online status
  useEffect(() => {
    if (!conversations.length || !socketRef.current?.connected) return;
    const ids = conversations.map(c => c.other_user_id);
    socketRef.current.emit('get_online_status', ids, (statuses: { userId: number; online: boolean }[]) => {
      setOnlineUsers(new Set(statuses.filter(s => s.online).map(s => s.userId)));
    });
  }, [conversations]);

  // ── Fetch followers for group creation ─────────────────────────────────────
  const openCreateGroup = async () => {
    if (!token || !user) return;
    setShowCreateGroup(true);
    setCreateGroupName('');
    setSelectedMemberIds([]);
    setFollowerSearch('');
    try {
      const res = await fetch(`${API_URL}/api/follows/${user.id}/following`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setFollowers(data.following || []);
    } catch { setFollowers([]); }
  };

  const handleCreateGroup = async () => {
    if (!createGroupName.trim() || !token) return;
    setCreatingGroup(true);
    try {
      const res = await fetch(`${API_URL}/api/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: createGroupName.trim(), member_ids: selectedMemberIds }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const newGroup: Group = {
        ...data.group,
        last_message: null,
        last_message_at: null,
        last_sender_name: null,
      };
      setGroups(prev => [newGroup, ...prev]);
      setActiveGroupId(newGroup.id);
      setActiveGroupInfo(newGroup);
      setActiveId(null);
      setMobileShowChat(true);
      setShowCreateGroup(false);
    } catch { /* ignore */ }
    finally { setCreatingGroup(false); }
  };

  // ── Handlers ───────────────────────────────────────────────────────────────

  const selectDM = (id: number) => {
    setActiveId(id);
    setActiveGroupId(null);
    setMobileShowChat(true);
    setTypingText('');
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const selectGroup = (id: number) => {
    setActiveGroupId(id);
    setActiveId(null);
    setMobileShowChat(true);
    setTypingText('');
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const handleTypingChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;

    if (!activeId || !token) return;
    socketRef.current?.emit('typing_start', { conversationId: activeId, token });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('typing_stop', { conversationId: activeId, token });
    }, 2500);
  };

  const handleImgSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsgImage(file);
    const reader = new FileReader();
    reader.onloadend = () => setMsgImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSend = async (e?: FormEvent) => {
    e?.preventDefault();
    const text = newMessage.trim();
    if (!text && !msgImage) return;
    if (!token || sending) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (activeId) socketRef.current?.emit('typing_stop', { conversationId: activeId, token });

    const capturedText = text;
    const capturedImage = msgImage;
    setNewMessage('');
    setMsgImage(null);
    setMsgImagePreview(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setSending(true);

    try {
      // Upload image if present
      let imageUrl: string | null = null;
      if (capturedImage) {
        const fd = new FormData();
        fd.append('image', capturedImage);
        const upRes = await fetch(`${API_URL}/api/messages/upload-image`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (upRes.ok) {
          const upData = await upRes.json() as { url: string };
          imageUrl = upData.url;
        }
      }

      if (activeId) {
        // DM send via REST
        const res = await fetch(`${API_URL}/api/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ conversation_id: activeId, content: capturedText, image_url: imageUrl }),
        });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        setMessages(prev => prev.some(m => m.id === data.data.id) ? prev : [...prev, data.data]);
        setConversations(prev =>
          prev.map(c => c.id === activeId ? { ...c, last_message: capturedText || '📷 Image', last_message_at: new Date().toISOString() } : c)
        );
      } else if (activeGroupId) {
        // Group send via REST
        const res = await fetch(`${API_URL}/api/groups/${activeGroupId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ content: capturedText }),
        });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        setGroupMessages(prev => prev.some(m => m.id === data.message.id) ? prev : [...prev, data.message]);
        setGroups(prev =>
          prev.map(g => g.id === activeGroupId ? { ...g, last_message: capturedText, last_message_at: new Date().toISOString() } : g)
        );
      }
    } catch {
      if (capturedText) setNewMessage(capturedText);
      if (capturedImage) { setMsgImage(capturedImage); setMsgImagePreview(msgImagePreview); }
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const [deleteTarget, setDeleteTarget] = useState<{ id: number; kind: 'dm' | 'group' } | null>(null);
  const [openMsgMenuId, setOpenMsgMenuId] = useState<number | null>(null);
  const [deletingMsg, setDeletingMsg] = useState(false);

  useEffect(() => {
    if (openMsgMenuId === null) return;
    const close = () => setOpenMsgMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMsgMenuId]);

  const handleDeleteMessage = async () => {
    if (!deleteTarget || !token) return;
    setDeletingMsg(true);
    const { id, kind } = deleteTarget;
    try {
      if (kind === 'dm') {
        setMessages(prev => prev.map(m => m.id === id ? { ...m, is_deleted: true, content: '', image_url: null } : m));
        await fetch(`${API_URL}/api/messages/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        setGroupMessages(prev => prev.map(m => m.id === id ? { ...m, is_deleted: true, content: '' } : m));
        if (activeGroupId) {
          await fetch(`${API_URL}/api/groups/${activeGroupId}/messages/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      }
    } catch {
      // best-effort; UI already updated optimistically
    } finally {
      setDeletingMsg(false);
      setDeleteTarget(null);
      setOpenMsgMenuId(null);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const activeConversation = conversations.find(c => c.id === activeId);
  const isOtherOnline = activeConversation ? onlineUsers.has(activeConversation.other_user_id) : false;
  const lastSentMsg = [...messages].reverse().find(m => m.sender_id === user?.id);

  // Merge & sort DMs + groups by latest activity
  const listItems: ListItem[] = [
    ...conversations.map(c => ({ kind: 'dm' as const, ...c })),
    ...groups.map(g => ({ kind: 'group' as const, ...g })),
  ].sort((a, b) => {
    const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return tb - ta;
  });

  const [conversationSearch, setConversationSearch] = useState('');
  const filteredListItems = conversationSearch.trim()
    ? listItems.filter(item => {
        const q = conversationSearch.toLowerCase();
        if (item.kind === 'dm') return (item.other_user_name || '').toLowerCase().includes(q);
        return item.name.toLowerCase().includes(q);
      })
    : listItems;

  const filteredFollowers = followers.filter(f =>
    f.full_name.toLowerCase().includes(followerSearch.toLowerCase())
  );

  const showList = !mobileShowChat || (!activeId && !activeGroupId);

  if (authLoading || !user) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
        <Card className="h-[calc(100vh-8rem)]">
          <div className="flex h-full">
            <div className="w-full max-w-sm border-r border-border p-4 space-y-2">
              <ConversationSkeleton /><ConversationSkeleton />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
        <Card className="flex h-[calc(100vh-8rem)] overflow-hidden">
          {/* ── Conversation / Group list ──────────────────────────────── */}
          <div className={cn('flex w-full flex-col border-r border-border sm:w-80 sm:shrink-0', mobileShowChat && (activeId || activeGroupId) ? 'hidden sm:flex' : 'flex')}>
            <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
              <h2 className="font-semibold text-ink">Messages</h2>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="text-caption text-brand-600 hover:text-brand-700" onClick={openCreateGroup}>
                  <svg className="mr-1 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  New Group
                </Button>
              </div>
            </div>

            {/* Search bar */}
            <div className="border-b border-border px-3 py-2.5">
              <div className="relative">
                <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  value={conversationSearch}
                  onChange={e => setConversationSearch(e.target.value)}
                  placeholder="Search conversations..."
                  className="h-8 w-full rounded-lg border border-border bg-surface-muted pl-8 pr-7 text-[13px] text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-[#1a1a1a] dark:border-[#333]"
                />
                {conversationSearch && (
                  <button
                    type="button"
                    onClick={() => setConversationSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted transition hover:text-ink"
                    aria-label="Clear search"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="py-2"><ConversationSkeleton /><ConversationSkeleton /><ConversationSkeleton /></div>
              ) : filteredListItems.length === 0 && conversationSearch ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <svg className="mb-2 h-8 w-8 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  <p className="text-body-sm font-medium text-ink">No conversations found</p>
                  <p className="mt-0.5 text-caption text-ink-muted">Try a different name</p>
                </div>
              ) : listItems.length === 0 ? (
                <EmptyState
                  title="No conversations yet"
                  description="Find students to message or create a group."
                  className="py-12"
                  icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>}
                />
              ) : (
                filteredListItems.map(item => {
                  if (item.kind === 'dm') {
                    const conv = item;
                    const isActive = activeId === conv.id;
                    return (
                      <button key={`dm-${conv.id}`} type="button" onClick={() => selectDM(conv.id)}
                        className={cn('flex w-full items-center gap-3 px-4 py-3 text-left transition', isActive ? 'border-r-2 border-brand-600 bg-brand-50' : 'hover:bg-surface-muted')}>
                        <div className="relative shrink-0">
                          <Avatar src={conv.other_user_photo} name={conv.other_user_name || 'User'} size="md" />
                          {onlineUsers.has(conv.other_user_id) && (
                            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-brand-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className={cn('truncate text-body-sm', conv.unread_count > 0 ? 'font-semibold text-ink' : 'font-medium text-ink')}>{conv.other_user_name || 'Unknown User'}</p>
                            {conv.last_message_at && <span className="shrink-0 text-caption text-ink-muted">{timeAgo(conv.last_message_at)}</span>}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <p className={cn('truncate text-caption', conv.unread_count > 0 ? 'font-medium text-ink' : 'text-ink-muted')}>{friendlyPreview(conv.last_message)}</p>
                            {conv.unread_count > 0 && <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">{conv.unread_count > 9 ? '9+' : conv.unread_count}</span>}
                          </div>
                        </div>
                      </button>
                    );
                  } else {
                    const grp = item;
                    const isActive = activeGroupId === grp.id;
                    return (
                      <button key={`group-${grp.id}`} type="button" onClick={() => selectGroup(grp.id)}
                        className={cn('flex w-full items-center gap-3 px-4 py-3 text-left transition', isActive ? 'border-r-2 border-brand-600 bg-brand-50' : 'hover:bg-surface-muted')}>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100">
                          <GroupIcon className="h-5 w-5 text-brand-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-body-sm font-medium text-ink">{grp.name}</p>
                            {grp.last_message_at && <span className="shrink-0 text-caption text-ink-muted">{timeAgo(grp.last_message_at)}</span>}
                          </div>
                          <p className="truncate text-caption text-ink-muted">
                            {grp.last_message
                              ? `${grp.last_sender_name ?? ''}: ${grp.last_message}`
                              : `${grp.member_count} members`}
                          </p>
                        </div>
                      </button>
                    );
                  }
                })
              )}
            </div>
          </div>

          {/* ── Chat panel ──────────────────────────────────────────────── */}
          <div className={cn('flex flex-1 flex-col', showList ? 'hidden sm:flex' : 'flex')}>
            {activeId && activeConversation ? (
              /* DM chat */
              <>
                <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                  <button type="button" onClick={() => { setMobileShowChat(false); setTypingText(''); }} className="rounded-lg p-1 text-ink-secondary hover:bg-surface-subtle sm:hidden" aria-label="Back">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <div className="relative shrink-0">
                    <Avatar src={activeConversation.other_user_photo} name={activeConversation.other_user_name} size="sm" />
                    {isOtherOnline && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-500" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/profile/${activeConversation.other_user_id}`} className="font-medium text-ink hover:text-brand-600">{activeConversation.other_user_name}</Link>
                    <p className="text-caption text-ink-muted">{isOtherOnline ? <span className="font-medium text-brand-600">Online</span> : activeConversation.other_user_department}</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-surface-muted/40 p-4">
                  {messagesLoading ? <MessageSkeleton /> : messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <p className="text-body-sm font-medium text-ink">Start the conversation</p>
                      <p className="mt-1 text-caption text-ink-muted">Say hello to {activeConversation.other_user_name}!</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {messages.map((msg, idx) => {
                        const isSent = msg.sender_id === user.id;
                        const isLastSent = msg.id === lastSentMsg?.id && isSent;
                        const prevMsg = messages[idx - 1];
                        const showAvatar = !isSent && (idx === 0 || prevMsg?.sender_id !== msg.sender_id);
                        const isDeleted = !!msg.is_deleted;
                        return (
                          <div key={msg.id} className={cn('group/msg flex items-end gap-2', isSent ? 'justify-end' : 'justify-start')}>
                            {!isSent && <div className="w-7 shrink-0">{showAvatar && <Avatar src={activeConversation.other_user_photo} name={activeConversation.other_user_name} size="sm" className="h-7 w-7" />}</div>}
                            {isSent && !isDeleted && (
                              <div className="relative shrink-0 self-center">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setOpenMsgMenuId(openMsgMenuId === msg.id ? null : msg.id); }}
                                  className="flex h-6 w-6 items-center justify-center rounded-full text-ink-muted opacity-60 transition hover:bg-surface-muted hover:opacity-100 sm:opacity-0 sm:group-hover/msg:opacity-100"
                                  aria-label="Message options"
                                >
                                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                                </button>
                                {openMsgMenuId === msg.id && (
                                  <div onClick={(e) => e.stopPropagation()} className="absolute bottom-full right-0 z-20 mb-1 w-32 rounded-xl border border-border bg-white py-1 shadow-lg dark:bg-[#1a1a1a] dark:border-[#333]">
                                    <button
                                      type="button"
                                      onClick={() => { setOpenMsgMenuId(null); setDeleteTarget({ id: msg.id, kind: 'dm' }); }}
                                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-caption font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                            {(() => {
                              if (isDeleted) {
                                return (
                                  <div className={cn(
                                    'min-w-0 max-w-[75%] rounded-2xl px-4 py-2.5 text-body-sm italic',
                                    isSent ? 'rounded-br-md bg-surface-muted text-ink-muted' : 'rounded-bl-md border border-border bg-white dark:bg-[#1a1a1a] dark:border-[#333] text-ink-muted'
                                  )}>
                                    This message was deleted
                                    <div className={cn('mt-1 flex items-center gap-2', isSent ? 'justify-end' : 'justify-start')}>
                                      <span className="text-caption text-ink-muted">{formatTime(msg.created_at)}</span>
                                    </div>
                                  </div>
                                );
                              }
                              const shared = parseSharedPost(msg.content);
                              const storyReply = !shared ? parseStoryReply(msg.content) : null;
                              const isCard = shared || storyReply;
                              return (
                                <div className={cn(
                                  'min-w-0 rounded-2xl px-4 py-2.5 text-body-sm',
                                  isCard ? 'max-w-[85%] w-72' : 'max-w-[75%]',
                                  isSent ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md border border-border bg-white dark:bg-[#1a1a1a] dark:border-[#333] text-ink'
                                )}>
                                  {shared
                                    ? <SharedPostCard data={shared} isSent={isSent} />
                                    : storyReply
                                    ? <StoryReplyCard data={storyReply} isSent={isSent} />
                                    : <>
                                        {msg.image_url && (
                                          <a href={msg.image_url} target="_blank" rel="noopener noreferrer" className="mb-1.5 block">
                                            <img src={msg.image_url} alt="Image" className="max-h-60 w-full rounded-xl object-cover" />
                                          </a>
                                        )}
                                        {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
                                      </>
                                  }
                                  <div className={cn('mt-1 flex items-center gap-2', isSent ? 'justify-end' : 'justify-start')}>
                                    <span className={cn('text-caption', isSent ? 'text-brand-200' : 'text-ink-muted')}>{formatTime(msg.created_at)}</span>
                                    {isLastSent && <span className={cn('text-caption', isSent ? 'text-brand-200' : 'text-ink-muted')}>{msg.is_read ? '✓✓ Read' : '✓ Delivered'}</span>}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                      {typingText && (
                        <div className="flex items-end gap-2">
                          <div className="w-7 shrink-0" />
                          <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-border bg-white dark:bg-[#1a1a1a] dark:border-[#333] px-4 py-2.5">
                            <span className="flex gap-1">{[0,1,2].map(i => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-ink-muted" style={{ animationDelay: `${i*0.15}s` }} />)}</span>
                            <span className="text-caption text-ink-muted">{typingText}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="border-t border-border">
                  {msgImagePreview && (
                    <div className="relative mx-4 mt-3 w-24">
                      <img src={msgImagePreview} alt="Preview" className="h-20 w-24 rounded-xl object-cover" />
                      <button type="button" onClick={() => { setMsgImage(null); setMsgImagePreview(null); }}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                  <form onSubmit={handleSend} className="flex items-end gap-2 p-4">
                    <input ref={imgInputRef} type="file" accept="image/*" onChange={handleImgSelect} className="hidden" />
                    <button type="button" onClick={() => imgInputRef.current?.click()} disabled={sending}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-muted hover:text-brand-600 disabled:opacity-40">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                    </button>
                    <textarea ref={textareaRef} value={newMessage} onChange={handleTypingChange} onKeyDown={handleKeyDown}
                      placeholder="Type a message… (Enter to send)" rows={1} disabled={sending}
                      className="flex-1 resize-none rounded-xl border border-border bg-white dark:bg-[#1a1a1a] dark:border-[#333] px-4 py-2.5 text-body-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60"
                      style={{ maxHeight: '120px' }} />
                    <Button type="submit" size="sm" disabled={sending || (!newMessage.trim() && !msgImage)} loading={sending} className="shrink-0">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                    </Button>
                  </form>
                </div>
              </>
            ) : activeGroupId && activeGroupInfo ? (
              /* Group chat */
              <>
                <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                  <button type="button" onClick={() => setMobileShowChat(false)} className="rounded-lg p-1 text-ink-secondary hover:bg-surface-subtle sm:hidden" aria-label="Back">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100">
                    <GroupIcon className="h-4.5 w-4.5 text-brand-600" />
                  </div>
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { setShowGroupInfo(true); setGroupInfoView('info'); }}>
                    <p className="font-medium text-ink hover:text-brand-600 transition">{activeGroupInfo.name}</p>
                    <p className="text-caption text-ink-muted">
                      {activeGroupInfo.member_count} members
                      {(activeGroupInfo.pending_count ?? 0) > 0 && myGroupRole === 'admin' && (
                        <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          {activeGroupInfo.pending_count} pending
                        </span>
                      )}
                    </p>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto bg-surface-muted/40 p-4">
                  {messagesLoading ? <MessageSkeleton /> : groupMessages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <p className="text-body-sm font-medium text-ink">Group created!</p>
                      <p className="mt-1 text-caption text-ink-muted">Be the first to send a message to the group.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {groupMessages.map((msg, idx) => {
                        const isSent = msg.sender_id === user.id;
                        const prevMsg = groupMessages[idx - 1];
                        const showSenderInfo = !isSent && (idx === 0 || prevMsg?.sender_id !== msg.sender_id);
                        const isDeleted = !!msg.is_deleted;
                        return (
                          <div key={msg.id} className={cn('group/msg flex items-end gap-2', isSent ? 'justify-end' : 'justify-start')}>
                            {!isSent && (
                              <div className="w-7 shrink-0">
                                {showSenderInfo && <Avatar src={msg.sender_photo} name={msg.sender_name} size="sm" className="h-7 w-7" />}
                              </div>
                            )}
                            {isSent && !isDeleted && (
                              <div className="relative shrink-0 self-center">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setOpenMsgMenuId(openMsgMenuId === msg.id ? null : msg.id); }}
                                  className="flex h-6 w-6 items-center justify-center rounded-full text-ink-muted opacity-60 transition hover:bg-surface-muted hover:opacity-100 sm:opacity-0 sm:group-hover/msg:opacity-100"
                                  aria-label="Message options"
                                >
                                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                                </button>
                                {openMsgMenuId === msg.id && (
                                  <div onClick={(e) => e.stopPropagation()} className="absolute bottom-full right-0 z-20 mb-1 w-32 rounded-xl border border-border bg-white py-1 shadow-lg dark:bg-[#1a1a1a] dark:border-[#333]">
                                    <button
                                      type="button"
                                      onClick={() => { setOpenMsgMenuId(null); setDeleteTarget({ id: msg.id, kind: 'group' }); }}
                                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-caption font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                            <div className={cn('max-w-[75%] min-w-0', isSent ? 'items-end' : 'items-start', 'flex flex-col')}>
                              {showSenderInfo && !isSent && (
                                <p className="mb-0.5 ml-1 text-caption font-medium text-ink-secondary">{msg.sender_name}</p>
                              )}
                              {(() => {
                                if (isDeleted) {
                                  return (
                                    <div className={cn(
                                      'rounded-2xl px-4 py-2.5 text-body-sm italic',
                                      isSent ? 'rounded-br-md bg-surface-muted text-ink-muted' : 'rounded-bl-md border border-border bg-white dark:bg-[#1a1a1a] dark:border-[#333] text-ink-muted'
                                    )}>
                                      This message was deleted
                                      <p className="mt-1 text-caption text-ink-muted">{formatTime(msg.created_at)}</p>
                                    </div>
                                  );
                                }
                                const shared = parseSharedPost(msg.content);
                                const storyReply = !shared ? parseStoryReply(msg.content) : null;
                                const isCard = shared || storyReply;
                                return (
                                  <div className={cn(
                                    'rounded-2xl px-4 py-2.5 text-body-sm',
                                    isCard ? 'w-72' : '',
                                    isSent ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md border border-border bg-white dark:bg-[#1a1a1a] dark:border-[#333] text-ink'
                                  )}>
                                    {shared
                                      ? <SharedPostCard data={shared} isSent={isSent} />
                                      : storyReply
                                      ? <StoryReplyCard data={storyReply} isSent={isSent} />
                                      : <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                                    }
                                    <p className={cn('mt-1 text-caption', isSent ? 'text-brand-200 text-right' : 'text-ink-muted')}>{formatTime(msg.created_at)}</p>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-border p-4">
                  <textarea ref={textareaRef} value={newMessage} onChange={handleTypingChange} onKeyDown={handleKeyDown}
                    placeholder="Message group… (Enter to send)" rows={1} disabled={sending}
                    className="flex-1 resize-none rounded-xl border border-border bg-white dark:bg-[#1a1a1a] dark:border-[#333] px-4 py-2.5 text-body-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60"
                    style={{ maxHeight: '120px' }} />
                  <Button type="submit" size="sm" disabled={sending || !newMessage.trim()} loading={sending} className="shrink-0">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                  </Button>
                </form>
              </>
            ) : (
              <EmptyState title="Select a conversation" description="Choose a chat from the list, find someone to message, or create a group." className="flex-1"
                icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>}
              />
            )}
          </div>
        </Card>
      </div>

      {/* ── Group Info Panel ────────────────────────────────────────────── */}
      {showGroupInfo && activeGroupInfo && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowGroupInfo(false)} />
          <div className="relative flex w-full max-w-sm flex-col bg-white shadow-2xl dark:bg-[#111] dark:border-l dark:border-[#222]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3.5 dark:border-[#222]">
              <div className="flex items-center gap-2">
                {groupInfoView !== 'info' && (
                  <button type="button" onClick={() => setGroupInfoView('info')} className="mr-1 text-ink-muted hover:text-ink">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                  </button>
                )}
                <h3 className="font-semibold text-ink">
                  {groupInfoView === 'info' ? 'Group Info' : groupInfoView === 'settings' ? 'Group Settings' : 'Pending Members'}
                </h3>
              </div>
              <button type="button" onClick={() => setShowGroupInfo(false)} className="text-ink-muted hover:text-ink">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            {groupInfoToast && (
              <div className="mx-4 mt-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm text-brand-700">{groupInfoToast}</div>
            )}

            <div className="flex-1 overflow-y-auto">
              {/* INFO VIEW */}
              {groupInfoView === 'info' && (
                <div className="space-y-0">
                  {/* Group details */}
                  <div className="px-4 py-4 border-b border-border dark:border-[#222]">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-xl dark:bg-brand-950">💬</div>
                      <div>
                        <p className="font-semibold text-ink">{activeGroupInfo.name}</p>
                        <p className="text-sm text-ink-muted">{activeGroupInfo.member_count} members</p>
                      </div>
                    </div>
                    {activeGroupInfo.description && (
                      <p className="mt-2 text-sm text-ink-muted">{activeGroupInfo.description}</p>
                    )}
                  </div>

                  {/* Admin actions */}
                  {myGroupRole === 'admin' && (
                    <div className="px-4 py-3 border-b border-border dark:border-[#222] flex flex-wrap gap-2">
                      <button type="button" onClick={() => setGroupInfoView('settings')}
                        className="rounded-full border border-border px-3.5 py-1.5 text-[13px] font-medium text-ink transition hover:bg-surface-muted">
                        ⚙️ Settings
                      </button>
                      {pendingMembers.length > 0 && (
                        <button type="button" onClick={() => setGroupInfoView('pending')}
                          className="rounded-full border border-amber-300 bg-amber-50 px-3.5 py-1.5 text-[13px] font-medium text-amber-700 transition hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                          ⏳ Pending ({pendingMembers.length})
                        </button>
                      )}
                    </div>
                  )}

                  {/* Members */}
                  <div className="px-4 py-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{groupMembers.length} Members</p>
                    <div className="space-y-1">
                      {groupMembers.map(m => (
                        <div key={m.id} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-surface-muted dark:hover:bg-[#1a1a1a]">
                          <Avatar src={m.profile_photo_url} name={m.full_name} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-medium text-ink truncate">{m.full_name}</p>
                            <p className="text-[11px] text-ink-muted">{m.department}</p>
                          </div>
                          {m.role === 'admin' && (
                            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">Admin</span>
                          )}
                          {/* Admin actions on other members */}
                          {myGroupRole === 'admin' && m.id !== user?.id && (
                            <div className="flex gap-1">
                              <button type="button"
                                onClick={async () => {
                                  const newRole = m.role === 'admin' ? 'member' : 'admin';
                                  await fetch(`${API_URL}/api/groups/${activeGroupInfo.id}/members/${m.id}/role`, {
                                    method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ role: newRole }),
                                  });
                                  setGroupMembers(prev => prev.map(x => x.id === m.id ? { ...x, role: newRole } : x));
                                  setGroupInfoToast(newRole === 'admin' ? `${m.full_name} is now an admin` : `${m.full_name} is now a member`);
                                  setTimeout(() => setGroupInfoToast(''), 3000);
                                }}
                                className="rounded-lg px-2 py-1 text-[11px] font-medium text-ink-muted hover:bg-surface-muted hover:text-ink transition"
                                title={m.role === 'admin' ? 'Demote' : 'Promote to admin'}>
                                {m.role === 'admin' ? '↓' : '↑ Admin'}
                              </button>
                              <button type="button"
                                onClick={async () => {
                                  if (!confirm(`Remove ${m.full_name} from the group?`)) return;
                                  await fetch(`${API_URL}/api/groups/${activeGroupInfo.id}/members/${m.id}`, {
                                    method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
                                  });
                                  setGroupMembers(prev => prev.filter(x => x.id !== m.id));
                                  setActiveGroupInfo(g => g ? { ...g, member_count: Math.max(0, (g.member_count || 1) - 1) } : g);
                                }}
                                className="rounded-lg px-2 py-1 text-[11px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition">
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* SETTINGS VIEW */}
              {groupInfoView === 'settings' && myGroupRole === 'admin' && (
                <div className="space-y-5 px-4 py-4">
                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-ink-secondary">Group Name</label>
                    <input value={settingsForm.name} onChange={e => setSettingsForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-ink focus:border-brand-500 focus:outline-none dark:bg-[#0a0a0a] dark:border-[#333]" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-ink-secondary">Description</label>
                    <textarea value={settingsForm.description} onChange={e => setSettingsForm(f => ({ ...f, description: e.target.value }))}
                      rows={3} className="w-full resize-none rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none dark:bg-[#0a0a0a] dark:border-[#333]" />
                  </div>
                  {[
                    { key: 'require_approval' as const, label: 'Require approval to join' },
                    { key: 'only_admins_can_add' as const, label: 'Only admins can add members' },
                    { key: 'invite_enabled' as const, label: 'Invite link enabled' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-sm text-ink">{label}</span>
                      <button type="button" onClick={() => setSettingsForm(f => ({ ...f, [key]: !f[key] }))}
                        className={cn('relative h-6 w-11 rounded-full transition', settingsForm[key] ? 'bg-brand-600' : 'bg-gray-300 dark:bg-[#333]')}>
                        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', settingsForm[key] ? 'left-[22px]' : 'left-0.5')} />
                      </button>
                    </div>
                  ))}

                  {/* Invite link */}
                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-ink-secondary">Invite Link</label>
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-muted px-3 py-2 dark:bg-[#1a1a1a] dark:border-[#333]">
                      <span className="flex-1 truncate font-mono text-[12px] text-ink">{typeof window !== 'undefined' ? `${window.location.origin}/join/${inviteCode}` : `/join/${inviteCode}`}</span>
                      <button type="button" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/join/${inviteCode}`); setCopiedInvite(true); setTimeout(() => setCopiedInvite(false), 2000); }}
                        className="shrink-0 text-[12px] font-semibold text-brand-600 hover:text-brand-700 transition">
                        {copiedInvite ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <button type="button"
                      onClick={async () => {
                        if (!confirm('Reset invite link? The old link will stop working.')) return;
                        const res = await fetch(`${API_URL}/api/groups/${activeGroupInfo.id}/invite/reset`, {
                          method: 'POST', headers: { Authorization: `Bearer ${token}` },
                        });
                        const data = await res.json() as { invite_code?: string };
                        if (data.invite_code) { setInviteCode(data.invite_code); setGroupInfoToast('Invite link reset'); setTimeout(() => setGroupInfoToast(''), 3000); }
                      }}
                      className="mt-1.5 text-[12px] font-medium text-red-500 hover:text-red-600 transition">
                      Reset invite link
                    </button>
                  </div>

                  <Button loading={savingSettings} onClick={async () => {
                    setSavingSettings(true);
                    try {
                      const res = await fetch(`${API_URL}/api/groups/${activeGroupInfo.id}/settings`, {
                        method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: settingsForm.name, description: settingsForm.description, require_approval: settingsForm.require_approval, only_admins_can_add: settingsForm.only_admins_can_add, invite_enabled: settingsForm.invite_enabled }),
                      });
                      const data = await res.json() as { group?: Group };
                      if (data.group) {
                        setActiveGroupInfo(data.group);
                        setGroups(prev => prev.map(g => g.id === activeGroupInfo.id ? { ...g, ...data.group } : g));
                      }
                      setGroupInfoToast('Settings saved'); setTimeout(() => setGroupInfoToast(''), 3000);
                      setGroupInfoView('info');
                    } finally { setSavingSettings(false); }
                  }} className="w-full">Save Settings</Button>
                </div>
              )}

              {/* PENDING VIEW */}
              {groupInfoView === 'pending' && (
                <div className="px-4 py-4">
                  {pendingMembers.length === 0 ? (
                    <p className="py-8 text-center text-sm text-ink-muted">No pending requests</p>
                  ) : (
                    <div className="space-y-3">
                      {pendingMembers.map(m => (
                        <div key={m.id} className="flex items-center gap-3">
                          <Avatar src={m.profile_photo_url} name={m.full_name} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-medium text-ink">{m.full_name}</p>
                            <p className="text-[11px] text-ink-muted">{m.department}</p>
                          </div>
                          <div className="flex gap-1">
                            <button type="button" onClick={async () => {
                              await fetch(`${API_URL}/api/groups/${activeGroupInfo.id}/members/${m.id}/approve`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });
                              setPendingMembers(prev => prev.filter(x => x.id !== m.id));
                              setGroupMembers(prev => [...prev, { ...m, role: 'member', status: 'active' }]);
                              setActiveGroupInfo(g => g ? { ...g, member_count: (g.member_count || 0) + 1, pending_count: Math.max(0, (g.pending_count || 1) - 1) } : g);
                            }} className="rounded-lg bg-brand-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-brand-700 transition">Accept</button>
                            <button type="button" onClick={async () => {
                              await fetch(`${API_URL}/api/groups/${activeGroupInfo.id}/members/${m.id}/reject`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });
                              setPendingMembers(prev => prev.filter(x => x.id !== m.id));
                              setActiveGroupInfo(g => g ? { ...g, pending_count: Math.max(0, (g.pending_count || 1) - 1) } : g);
                            }} className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition">Reject</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="border-t border-border px-4 py-3 dark:border-[#222] space-y-2">
              <button type="button"
                onClick={async () => {
                  if (!confirm('Leave this group?')) return;
                  const res = await fetch(`${API_URL}/api/groups/${activeGroupInfo.id}/leave`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
                  const d = await res.json() as { message?: string };
                  if (!res.ok) { setGroupInfoToast(d.message || 'Could not leave'); setTimeout(() => setGroupInfoToast(''), 4000); return; }
                  setGroups(prev => prev.filter(g => g.id !== activeGroupInfo.id));
                  setActiveGroupId(null); setActiveGroupInfo(null); setShowGroupInfo(false); setMobileShowChat(false);
                }}
                className="w-full rounded-xl py-2.5 text-center text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/30">
                Leave Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Group Modal ─────────────────────────────────────────── */}
      {showCreateGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={e => { if (e.target === e.currentTarget) setShowCreateGroup(false); }}>
          <div className="flex w-full max-w-md flex-col rounded-2xl bg-white dark:bg-[#111] dark:border dark:border-[#222] shadow-2xl">
            <div className="flex items-center justify-between border-b border-border dark:border-[#222] px-5 py-4">
              <h3 className="font-semibold text-ink">Create Group</h3>
              <button type="button" onClick={() => setShowCreateGroup(false)} className="rounded-lg p-1 text-ink-secondary hover:bg-surface-muted">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-body-sm font-medium text-ink">Group Name</label>
                <Input value={createGroupName} onChange={e => setCreateGroupName(e.target.value)} placeholder="e.g. CS Study Group 2025" />
              </div>

              <div>
                <label className="mb-1.5 block text-body-sm font-medium text-ink">Add Members</label>
                <Input value={followerSearch} onChange={e => setFollowerSearch(e.target.value)} placeholder="Search people you follow…" />
                <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-border">
                  {filteredFollowers.length === 0 ? (
                    <p className="py-6 text-center text-caption text-ink-muted">No followers found</p>
                  ) : (
                    filteredFollowers.map(f => {
                      const selected = selectedMemberIds.includes(f.id);
                      return (
                        <button key={f.id} type="button"
                          onClick={() => setSelectedMemberIds(prev => selected ? prev.filter(id => id !== f.id) : [...prev, f.id])}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-surface-muted">
                          <Avatar src={f.profile_photo_url} name={f.full_name} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-body-sm font-medium text-ink">{f.full_name}</p>
                            <p className="truncate text-caption text-ink-muted">{f.department}</p>
                          </div>
                          <div className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition', selected ? 'border-brand-600 bg-brand-600' : 'border-border')}>
                            {selected && <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
                {selectedMemberIds.length > 0 && (
                  <p className="mt-1.5 text-caption text-ink-muted">{selectedMemberIds.length} member{selectedMemberIds.length !== 1 ? 's' : ''} selected</p>
                )}
              </div>
            </div>

            <div className="flex gap-3 border-t border-border px-5 py-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowCreateGroup(false)}>Cancel</Button>
              <Button className="flex-1" disabled={!createGroupName.trim() || creatingGroup} loading={creatingGroup} onClick={handleCreateGroup}>Create Group</Button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={e => { if (e.target === e.currentTarget && !deletingMsg) setDeleteTarget(null); }}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-[#111] dark:border dark:border-[#222]">
            <h3 className="font-semibold text-ink">Delete this message?</h3>
            <p className="mt-1.5 text-body-sm text-ink-muted">This cannot be undone.</p>
            <div className="mt-5 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)} disabled={deletingMsg}>Cancel</Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 focus-visible:ring-red-500"
                loading={deletingMsg}
                onClick={handleDeleteMessage}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
