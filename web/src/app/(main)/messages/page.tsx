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
  last_message: string | null;
  last_message_at: string | null;
  last_sender_name: string | null;
}

interface ChatMessage {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  created_at: string;
  sender_name: string;
  is_read: boolean;
}

interface GroupMessage {
  id: number;
  group_id: number;
  sender_id: number;
  sender_name: string;
  sender_photo: string | null;
  content: string;
  created_at: string;
}

interface GroupMember {
  id: number;
  full_name: string;
  profile_photo_url: string | null;
  department: string;
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

/** Returns a friendly preview string for the conversation list. */
function friendlyPreview(content: string | null): string {
  if (!content) return 'No messages yet';
  const shared = parseSharedPost(content);
  if (shared) return `📌 Shared a post`;
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
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
      if (data.group) setActiveGroupInfo(data.group);
      if (data.members) setGroupMembers(data.members);
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

  const handleSend = async (e?: FormEvent) => {
    e?.preventDefault();
    const text = newMessage.trim();
    if (!text || !token || sending) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (activeId) socketRef.current?.emit('typing_stop', { conversationId: activeId, token });

    setNewMessage('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setSending(true);

    try {
      if (activeId) {
        // DM send via REST
        const res = await fetch(`${API_URL}/api/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ conversation_id: activeId, content: text }),
        });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        setMessages(prev => prev.some(m => m.id === data.data.id) ? prev : [...prev, data.data]);
        setConversations(prev =>
          prev.map(c => c.id === activeId ? { ...c, last_message: text, last_message_at: new Date().toISOString() } : c)
        );
      } else if (activeGroupId) {
        // Group send via REST
        const res = await fetch(`${API_URL}/api/groups/${activeGroupId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ content: text }),
        });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        setGroupMessages(prev => prev.some(m => m.id === data.message.id) ? prev : [...prev, data.message]);
        setGroups(prev =>
          prev.map(g => g.id === activeGroupId ? { ...g, last_message: text, last_message_at: new Date().toISOString() } : g)
        );
      }
    } catch {
      setNewMessage(text);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
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

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="py-2"><ConversationSkeleton /><ConversationSkeleton /><ConversationSkeleton /></div>
              ) : listItems.length === 0 ? (
                <EmptyState
                  title="No conversations yet"
                  description="Find students to message or create a group."
                  className="py-12"
                  icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>}
                />
              ) : (
                listItems.map(item => {
                  if (item.kind === 'dm') {
                    const conv = item;
                    const isActive = activeId === conv.id;
                    return (
                      <button key={`dm-${conv.id}`} type="button" onClick={() => selectDM(conv.id)}
                        className={cn('flex w-full items-center gap-3 px-4 py-3 text-left transition', isActive ? 'border-r-2 border-brand-600 bg-brand-50' : 'hover:bg-surface-muted')}>
                        <div className="relative shrink-0">
                          <Avatar src={conv.other_user_photo} name={conv.other_user_name} size="md" />
                          {onlineUsers.has(conv.other_user_id) && (
                            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-brand-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className={cn('truncate text-body-sm', conv.unread_count > 0 ? 'font-semibold text-ink' : 'font-medium text-ink')}>{conv.other_user_name}</p>
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
                        return (
                          <div key={msg.id} className={cn('flex items-end gap-2', isSent ? 'justify-end' : 'justify-start')}>
                            {!isSent && <div className="w-7 shrink-0">{showAvatar && <Avatar src={activeConversation.other_user_photo} name={activeConversation.other_user_name} size="sm" className="h-7 w-7" />}</div>}
                            {(() => {
                              const shared = parseSharedPost(msg.content);
                              return (
                                <div className={cn(
                                  'min-w-0 rounded-2xl px-4 py-2.5 text-body-sm',
                                  shared ? 'max-w-[85%] w-72' : 'max-w-[75%]',
                                  isSent ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md border border-border bg-white dark:bg-[#1a1a1a] dark:border-[#333] text-ink'
                                )}>
                                  {shared
                                    ? <SharedPostCard data={shared} isSent={isSent} />
                                    : <p className="whitespace-pre-wrap break-words">{msg.content}</p>
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

                <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-border p-4">
                  <textarea ref={textareaRef} value={newMessage} onChange={handleTypingChange} onKeyDown={handleKeyDown}
                    placeholder="Type a message… (Enter to send)" rows={1} disabled={sending}
                    className="flex-1 resize-none rounded-xl border border-border bg-white dark:bg-[#1a1a1a] dark:border-[#333] px-4 py-2.5 text-body-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60"
                    style={{ maxHeight: '120px' }} />
                  <Button type="submit" size="sm" disabled={sending || !newMessage.trim()} loading={sending} className="shrink-0">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                  </Button>
                </form>
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
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{activeGroupInfo.name}</p>
                    <p className="text-caption text-ink-muted">{activeGroupInfo.member_count} members</p>
                  </div>
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
                        return (
                          <div key={msg.id} className={cn('flex items-end gap-2', isSent ? 'justify-end' : 'justify-start')}>
                            {!isSent && (
                              <div className="w-7 shrink-0">
                                {showSenderInfo && <Avatar src={msg.sender_photo} name={msg.sender_name} size="sm" className="h-7 w-7" />}
                              </div>
                            )}
                            <div className={cn('max-w-[75%] min-w-0', isSent ? 'items-end' : 'items-start', 'flex flex-col')}>
                              {showSenderInfo && !isSent && (
                                <p className="mb-0.5 ml-1 text-caption font-medium text-ink-secondary">{msg.sender_name}</p>
                              )}
                              {(() => {
                                const shared = parseSharedPost(msg.content);
                                return (
                                  <div className={cn(
                                    'rounded-2xl px-4 py-2.5 text-body-sm',
                                    shared ? 'w-72' : '',
                                    isSent ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md border border-border bg-white dark:bg-[#1a1a1a] dark:border-[#333] text-ink'
                                  )}>
                                    {shared
                                      ? <SharedPostCard data={shared} isSent={isSent} />
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
    </>
  );
}
