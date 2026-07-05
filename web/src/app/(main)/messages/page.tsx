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
  file_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
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
  image_url?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  created_at: string;
  is_deleted?: boolean;
}

interface GroupMember {
  id: number;
  full_name: string;
  username?: string;
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

interface MessageReplyData {
  type: 'message_reply';
  quoted_sender: string;
  quoted_text: string;
  reply: string;
}

function parseMessageReply(content: string): MessageReplyData | null {
  try {
    const data = JSON.parse(content);
    if (data?.type === 'message_reply') return data as MessageReplyData;
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
  const messageReply = parseMessageReply(content);
  if (messageReply) return `↩ ${messageReply.reply}`;
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

/** Returns clean, human-readable text for a message (used for copy/forward) — never raw JSON envelopes. */
function plainMessageText(content: string | null): string {
  if (!content) return '';
  const shared = parseSharedPost(content);
  if (shared) return shared.content || '';
  const storyReply = parseStoryReply(content);
  if (storyReply) return storyReply.reply;
  const messageReply = parseMessageReply(content);
  if (messageReply) return messageReply.reply;
  return content;
}

// Renders message text with @mentions highlighted (brand color, semibold)
function renderWithMentions(text: string) {
  const parts = text.split(/(@[a-zA-Z0-9_]{2,30})/g);
  return parts.map((part, i) =>
    /^@[a-zA-Z0-9_]{2,30}$/.test(part)
      ? <span key={i} className="font-semibold text-brand-600 dark:text-brand-400">{part}</span>
      : <span key={i}>{part}</span>
  );
}

function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const VIEWABLE_INLINE_EXTENSIONS = new Set(['pdf', 'txt', 'csv']);
const OFFICE_VIEWER_EXTENSIONS = new Set(['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx']);

function FileAttachmentCard({ url, name, size, isSent, onView }: { url: string; name: string; size?: number | null; isSent: boolean; onView: (url: string, name: string) => void }) {
  const ext = name.split('.').pop()?.toUpperCase() || 'FILE';
  return (
    <button
      type="button"
      onClick={() => onView(url, name)}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition',
        isSent ? 'border-white/25 bg-white/10 hover:bg-white/15' : 'border-border bg-surface-muted hover:bg-surface-subtle dark:border-[#333] dark:bg-[#1a1a1a]'
      )}
    >
      <span className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold',
        isSent ? 'bg-white/20 text-white' : 'bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-400'
      )}>
        {ext.slice(0, 4)}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-[13px] font-medium', isSent ? 'text-white' : 'text-ink')}>{name}</span>
        {!!size && <span className={cn('text-[11px]', isSent ? 'text-white/70' : 'text-ink-muted')}>{formatFileSize(size)}</span>}
      </span>
      <svg className={cn('h-4 w-4 shrink-0', isSent ? 'text-white/80' : 'text-ink-muted')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      </svg>
    </button>
  );
}

function MessageReplyCard({ data, isSent }: { data: MessageReplyData; isSent: boolean }) {
  return (
    <div className="w-full">
      <div className={cn(
        'mb-1.5 rounded-lg border-l-2 px-2.5 py-1.5',
        isSent ? 'border-white/60 bg-white/10' : 'border-brand-500 bg-surface-muted dark:bg-[#222]'
      )}>
        <p className={cn('text-[11px] font-semibold', isSent ? 'text-brand-100' : 'text-brand-600')}>{data.quoted_sender}</p>
        <p className={cn('line-clamp-2 text-[12px]', isSent ? 'text-white/80' : 'text-ink-muted')}>{data.quoted_text}</p>
      </div>
      {data.reply && <p className="whitespace-pre-wrap break-words">{data.reply}</p>}
    </div>
  );
}

// ── Swipe-to-reply + long-press actions ─────────────────────────────────────

const SWIPE_TRIGGER_PX = 46;
const SWIPE_MAX_PX = 68;
const LONG_PRESS_MS = 450;
const LONG_PRESS_MOVE_TOLERANCE = 10;

function SwipeRow({ onReply, onLongPress, disabled, children }: { onReply: () => void; onLongPress: () => void; disabled?: boolean; children: React.ReactNode }) {
  const [dx, setDx] = useState(0);
  const [pressed, setPressed] = useState(false);
  const startRef = useRef<{ x: number; y: number; dir: 'h' | 'v' | null } | null>(null);
  const triggeredRef = useRef(false);
  const longPressFiredRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  if (disabled) return <>{children}</>;

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY, dir: null };
    triggeredRef.current = false;
    longPressFiredRef.current = false;
    setPressed(true);
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      setPressed(false);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
      onLongPress();
    }, LONG_PRESS_MS);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!startRef.current) return;
    const t = e.touches[0];
    const deltaX = t.clientX - startRef.current.x;
    const deltaY = t.clientY - startRef.current.y;
    if (Math.abs(deltaX) > LONG_PRESS_MOVE_TOLERANCE || Math.abs(deltaY) > LONG_PRESS_MOVE_TOLERANCE) {
      clearLongPressTimer();
      setPressed(false);
    }
    if (startRef.current.dir === null && (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6)) {
      startRef.current.dir = Math.abs(deltaX) > Math.abs(deltaY) ? 'h' : 'v';
    }
    if (startRef.current.dir !== 'h') return;
    if (e.cancelable) e.preventDefault();
    const clamped = Math.max(0, Math.min(deltaX, SWIPE_MAX_PX));
    setDx(clamped);
    if (clamped > SWIPE_TRIGGER_PX && !triggeredRef.current) {
      triggeredRef.current = true;
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(8);
    }
  };

  const onTouchEnd = () => {
    clearLongPressTimer();
    setPressed(false);
    if (!longPressFiredRef.current && triggeredRef.current) onReply();
    setDx(0);
    startRef.current = null;
    triggeredRef.current = false;
    longPressFiredRef.current = false;
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onLongPress();
  };

  return (
    <div
      className="relative"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onContextMenu={onContextMenu}
    >
      <div
        className="pointer-events-none absolute left-0 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-brand-100 text-brand-700 transition-opacity dark:bg-brand-950 dark:text-brand-400"
        style={{ opacity: Math.min(dx / SWIPE_TRIGGER_PX, 1) }}
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 016 6v2" />
        </svg>
      </div>
      <div
        className={cn('rounded-2xl transition-[transform,filter] duration-150', pressed && 'brightness-95 dark:brightness-110')}
        style={{ transform: `translateX(${dx}px) scale(${pressed ? 0.985 : 1})`, transition: dx === 0 ? 'transform 0.2s ease' : 'none' }}
      >
        {children}
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
  const [uploadingGroupAvatar, setUploadingGroupAvatar] = useState(false);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);
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
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionActiveIdx, setMentionActiveIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [typingText, setTypingText] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<Set<number>>(new Set());

  const [msgImage, setMsgImage] = useState<File | null>(null);
  const [msgImagePreview, setMsgImagePreview] = useState<string | null>(null);
  const [msgFile, setMsgFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      socketRef.current?.emit('mark_read', { conversationId });
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

  // Group admins can set/change the group photo
  const handleGroupAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !token || !activeGroupInfo) return;
    if (!file.type.startsWith('image/')) return;
    setUploadingGroupAvatar(true);
    try {
      // Upload the image (reuses the existing message image upload endpoint)
      const fd = new FormData();
      fd.append('image', file);
      const upRes = await fetch(`${API_URL}/api/messages/upload-image`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      if (!upRes.ok) throw new Error('upload failed');
      const { url } = await upRes.json() as { url: string };

      // Save it on the group (admin-gated server-side)
      const res = await fetch(`${API_URL}/api/groups/${activeGroupInfo.id}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avatar_url: url }),
      });
      if (res.ok) {
        const data = await res.json() as { group: Group };
        setActiveGroupInfo(data.group);
        // Reflect the new avatar in the group list too
        setGroups(prev => prev.map(g => g.id === data.group.id ? { ...g, avatar_url: data.group.avatar_url } : g));
      }
    } catch { /* silently ignore; user can retry */ }
    finally { setUploadingGroupAvatar(false); }
  };


  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, groupMessages, typingText]);

  // ── Socket.io ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    const socket = io(API_URL, { autoConnect: true, auth: { token } });
    socketRef.current = socket;

    const joinCurrentRoom = () => {
      if (activeIdRef.current) socket.emit('join_conversation', activeIdRef.current);
      if (activeGroupIdRef.current) socket.emit('join_group', activeGroupIdRef.current);
    };

    socket.on('connect', () => {
      joinCurrentRoom();
    });

    socket.on('receive_message', (msg: ChatMessage) => {
      if (msg.conversation_id === activeIdRef.current) {
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        socket.emit('mark_read', { conversationId: msg.conversation_id });
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
    setReplyTo(null);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const selectGroup = (id: number) => {
    setActiveGroupId(id);
    setActiveId(null);
    setMobileShowChat(true);
    setTypingText('');
    setReplyTo(null);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const handleTypingChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;

    // Mention detection — only in group chat (tag a group member)
    if (activeGroupId) {
      const cursor = ta.selectionStart ?? e.target.value.length;
      const upToCursor = e.target.value.slice(0, cursor);
      const m = upToCursor.match(/(?:^|[^\w@])@([a-zA-Z0-9_]{0,30})$/);
      if (m) {
        setMentionStart(cursor - m[1].length - 1);
        setMentionQuery(m[1].toLowerCase());
        setMentionActiveIdx(0);
      } else {
        setMentionQuery(null);
        setMentionStart(null);
      }
    }

    if (!activeId || !token) return;
    socketRef.current?.emit('typing_start', { conversationId: activeId });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('typing_stop', { conversationId: activeId });
    }, 2500);
  };

  // Group members matching the current @mention query
  const mentionMatches = mentionQuery !== null
    ? groupMembers
        .filter(m => m.username && m.id !== user?.id && (
          m.username.toLowerCase().startsWith(mentionQuery) ||
          m.full_name.toLowerCase().includes(mentionQuery)
        ))
        .slice(0, 6)
    : [];

  const applyMention = (member: GroupMember) => {
    if (mentionStart === null || !member.username) return;
    const ta = textareaRef.current;
    const cursor = ta?.selectionStart ?? newMessage.length;
    const before = newMessage.slice(0, mentionStart);
    const after = newMessage.slice(cursor);
    const insertion = `@${member.username} `;
    const next = `${before}${insertion}${after}`;
    setNewMessage(next);
    setMentionQuery(null);
    setMentionStart(null);
    const newPos = before.length + insertion.length;
    requestAnimationFrame(() => { ta?.focus(); ta?.setSelectionRange(newPos, newPos); });
  };

  const handleImgSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsgFile(null);
    setMsgImage(file);
    const reader = new FileReader();
    reader.onloadend = () => setMsgImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const MAX_FILE_SIZE = 25 * 1024 * 1024;
  const ALLOWED_FILE_EXTENSIONS = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'csv'];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_FILE_EXTENSIONS.includes(ext)) {
      setFileError('Unsupported file type. Allowed: PDF, Word, PowerPoint, Excel, TXT, CSV.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError('File is too large. Maximum size is 25MB.');
      return;
    }
    setFileError(null);
    setMsgImage(null);
    setMsgImagePreview(null);
    setMsgFile(file);
  };

  const handleSend = async (e?: FormEvent) => {
    e?.preventDefault();
    const text = newMessage.trim();
    if (!text && !msgImage && !msgFile) return;
    if (!token || sending) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (activeId) socketRef.current?.emit('typing_stop', { conversationId: activeId });

    const capturedText = text;
    const capturedImage = msgImage;
    const capturedFile = msgFile;
    const capturedReply = replyTo;
    setNewMessage('');
    setMentionQuery(null);
    setMentionStart(null);
    setMsgImage(null);
    setMsgImagePreview(null);
    setMsgFile(null);
    setFileError(null);
    setReplyTo(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setSending(true);

    const outgoingContent = capturedReply
      ? JSON.stringify({ type: 'message_reply', quoted_sender: capturedReply.senderName, quoted_text: capturedReply.preview, reply: capturedText })
      : capturedText;

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

      // Upload document if present (direct-to-Cloudinary, same signed pattern as images/stories)
      let fileUrl: string | null = null;
      if (capturedFile) {
        const sigRes = await fetch(
          `${API_URL}/api/stories/upload-signature?folder=abukonn/files&filename=${encodeURIComponent(capturedFile.name)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!sigRes.ok) throw new Error('Failed to get upload signature');
        const { signature, timestamp, api_key, cloud_name, folder, public_id } = await sigRes.json() as {
          signature: string; timestamp: number; api_key: string; cloud_name: string; folder: string;
          public_id?: string;
        };
        fileUrl = await new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          const tid = setTimeout(() => xhr.abort(), 120000);
          xhr.onload = () => {
            clearTimeout(tid);
            if (xhr.status >= 200 && xhr.status < 300) {
              try { resolve((JSON.parse(xhr.responseText) as { secure_url: string }).secure_url); }
              catch { reject(new Error('Invalid Cloudinary response')); }
            } else {
              try { reject(new Error((JSON.parse(xhr.responseText) as { error?: { message: string } }).error?.message || 'File upload failed')); }
              catch { reject(new Error('File upload failed')); }
            }
          };
          xhr.onerror = () => { clearTimeout(tid); reject(new Error('Network error — check your connection')); };
          xhr.onabort = () => { clearTimeout(tid); reject(new Error('Upload timed out — try a smaller file')); };
          const fd = new FormData();
          fd.append('file', capturedFile);
          fd.append('api_key', api_key);
          fd.append('timestamp', String(timestamp));
          fd.append('signature', signature);
          fd.append('folder', folder);
          if (public_id) fd.append('public_id', public_id);
          xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloud_name}/raw/upload`);
          xhr.send(fd);
        });
      }
      const fileName = capturedFile?.name || null;
      const fileSize = capturedFile?.size || null;
      const filePreviewText = fileName ? `📎 ${fileName}` : null;

      if (activeId) {
        // DM send via REST
        const res = await fetch(`${API_URL}/api/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ conversation_id: activeId, content: outgoingContent, image_url: imageUrl, file_url: fileUrl, file_name: fileName, file_size: fileSize }),
        });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        setMessages(prev => prev.some(m => m.id === data.data.id) ? prev : [...prev, data.data]);
        setConversations(prev =>
          prev.map(c => c.id === activeId ? { ...c, last_message: capturedText || filePreviewText || '📷 Image', last_message_at: new Date().toISOString() } : c)
        );
      } else if (activeGroupId) {
        // Group send via REST
        const res = await fetch(`${API_URL}/api/groups/${activeGroupId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ content: outgoingContent, image_url: imageUrl, file_url: fileUrl, file_name: fileName, file_size: fileSize }),
        });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        setGroupMessages(prev => prev.some(m => m.id === data.message.id) ? prev : [...prev, data.message]);
        setGroups(prev =>
          prev.map(g => g.id === activeGroupId ? { ...g, last_message: capturedText || filePreviewText || '📷 Image', last_message_at: new Date().toISOString() } : g)
        );
      }
    } catch (err) {
      if (capturedText) setNewMessage(capturedText);
      if (capturedImage) { setMsgImage(capturedImage); setMsgImagePreview(msgImagePreview); }
      if (capturedFile) { setMsgFile(capturedFile); setFileError(err instanceof Error ? err.message : 'Failed to send file'); }
      if (capturedReply) setReplyTo(capturedReply);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Mention dropdown navigation takes priority when open
    if (mentionQuery !== null && mentionMatches.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionActiveIdx(i => Math.min(i + 1, mentionMatches.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionActiveIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); applyMention(mentionMatches[mentionActiveIdx]); return; }
      if (e.key === 'Escape') { setMentionQuery(null); setMentionStart(null); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const [deleteTarget, setDeleteTarget] = useState<{ id: number; kind: 'dm' | 'group' } | null>(null);
  const [deletingMsg, setDeletingMsg] = useState(false);
  const [imageLightbox, setImageLightbox] = useState<string | null>(null);
  const [docViewer, setDocViewer] = useState<{ url: string; name: string } | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: number; senderName: string; preview: string } | null>(null);

  const triggerReply = (msg: ChatMessage | GroupMessage, senderName: string) => {
    const preview = msg.content
      ? friendlyPreview(msg.content)
      : ('file_name' in msg && msg.file_name) ? `📎 ${msg.file_name}`
      : ('image_url' in msg && msg.image_url) ? '📷 Photo' : '';
    setReplyTo({ id: msg.id, senderName, preview });
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  // ── Press-and-hold message actions ──────────────────────────────────────
  type ActionSheetTarget = { msg: ChatMessage | GroupMessage; kind: 'dm' | 'group'; senderName: string };
  const [actionSheet, setActionSheet] = useState<ActionSheetTarget | null>(null);
  const [copyToast, setCopyToast] = useState(false);
  const [forwardMsg, setForwardMsg] = useState<ChatMessage | GroupMessage | null>(null);
  const [forwardQuery, setForwardQuery] = useState('');
  const [forwardingTo, setForwardingTo] = useState<string | null>(null);
  const [forwardedToast, setForwardedToast] = useState(false);

  const openMessageActions = (msg: ChatMessage | GroupMessage, kind: 'dm' | 'group', senderName: string) => {
    setActionSheet({ msg, kind, senderName });
  };

  const handleCopyMessage = async () => {
    if (!actionSheet) return;
    const { msg } = actionSheet;
    const text = plainMessageText(msg.content)
      || (('file_url' in msg && msg.file_url) ? msg.file_url : '')
      || (('image_url' in msg && msg.image_url) ? msg.image_url : '');
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && text) {
        await navigator.clipboard.writeText(text);
        setCopyToast(true);
        setTimeout(() => setCopyToast(false), 1800);
      }
    } catch { /* clipboard unavailable */ }
    setActionSheet(null);
  };

  const openForward = () => {
    if (!actionSheet) return;
    setForwardMsg(actionSheet.msg);
    setForwardQuery('');
    setActionSheet(null);
  };

  const sendForward = async (target: { kind: 'dm' | 'group'; id: number; key: string }) => {
    if (!forwardMsg || !token || forwardingTo) return;
    const text = plainMessageText(forwardMsg.content);
    const imageUrl = 'image_url' in forwardMsg ? (forwardMsg.image_url ?? null) : null;
    const fileUrl = 'file_url' in forwardMsg ? (forwardMsg.file_url ?? null) : null;
    const fileName = 'file_name' in forwardMsg ? (forwardMsg.file_name ?? null) : null;
    const fileSize = 'file_size' in forwardMsg ? (forwardMsg.file_size ?? null) : null;
    if (!text && !imageUrl && !fileUrl) { setForwardMsg(null); return; }
    const previewText = text || (fileName ? `📎 ${fileName}` : '📷 Image');
    setForwardingTo(target.key);
    try {
      if (target.kind === 'dm') {
        const res = await fetch(`${API_URL}/api/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ conversation_id: target.id, content: text, image_url: imageUrl, file_url: fileUrl, file_name: fileName, file_size: fileSize }),
        });
        if (res.ok) {
          const data = await res.json();
          if (target.id === activeId) setMessages(prev => prev.some(m => m.id === data.data.id) ? prev : [...prev, data.data]);
          setConversations(prev => prev.map(c => c.id === target.id ? { ...c, last_message: previewText, last_message_at: new Date().toISOString() } : c));
        }
      } else {
        const res = await fetch(`${API_URL}/api/groups/${target.id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ content: text, image_url: imageUrl, file_url: fileUrl, file_name: fileName, file_size: fileSize }),
        });
        if (res.ok) {
          const data = await res.json();
          if (target.id === activeGroupId) setGroupMessages(prev => prev.some(m => m.id === data.message.id) ? prev : [...prev, data.message]);
          setGroups(prev => prev.map(g => g.id === target.id ? { ...g, last_message: previewText, last_message_at: new Date().toISOString() } : g));
        }
      }
      setForwardedToast(true);
      setTimeout(() => setForwardedToast(false), 1800);
    } finally {
      setForwardingTo(null);
      setForwardMsg(null);
      setForwardQuery('');
    }
  };

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
        <Card className="h-[calc(100svh-8rem)]">
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
        <Card className="flex h-[calc(100svh-8rem)] overflow-hidden">
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
                        className={cn('flex w-full items-center gap-3 px-4 py-3 text-left transition', isActive ? 'border-r-2 border-brand-600 bg-brand-50 dark:bg-brand-950/40' : 'hover:bg-surface-muted dark:hover:bg-[#1a1a1a]')}>
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
                        className={cn('flex w-full items-center gap-3 px-4 py-3 text-left transition', isActive ? 'border-r-2 border-brand-600 bg-brand-50 dark:bg-brand-950/40' : 'hover:bg-surface-muted dark:hover:bg-[#1a1a1a]')}>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100">
                          {grp.avatar_url ? (
                            <img src={grp.avatar_url} alt={grp.name} className="h-full w-full object-cover" />
                          ) : (
                            <GroupIcon className="h-5 w-5 text-brand-600" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-body-sm font-medium text-ink">{grp.name}</p>
                            {grp.last_message_at && <span className="shrink-0 text-caption text-ink-muted">{timeAgo(grp.last_message_at)}</span>}
                          </div>
                          <p className="truncate text-caption text-ink-muted">
                            {grp.last_message
                              ? `${grp.last_sender_name ?? ''}: ${friendlyPreview(grp.last_message)}`
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
                <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
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
                          <SwipeRow key={msg.id} disabled={isDeleted} onReply={() => triggerReply(msg, isSent ? 'You' : activeConversation.other_user_name)} onLongPress={() => openMessageActions(msg, 'dm', isSent ? 'You' : activeConversation.other_user_name)}>
                          <div className={cn('group/msg flex items-end gap-2', isSent ? 'justify-end' : 'justify-start')}>
                            {!isSent && <div className="w-7 shrink-0">{showAvatar && <Avatar src={activeConversation.other_user_photo} name={activeConversation.other_user_name} size="sm" className="h-7 w-7" />}</div>}
                            {isSent && !isDeleted && (
                              <div className="relative shrink-0 self-center">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); openMessageActions(msg, 'dm', 'You'); }}
                                  className="flex h-6 w-6 items-center justify-center rounded-full text-ink-muted opacity-60 transition hover:bg-surface-muted hover:opacity-100 sm:opacity-0 sm:group-hover/msg:opacity-100"
                                  aria-label="Message options"
                                >
                                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                                </button>
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
                              const messageReply = !shared && !storyReply ? parseMessageReply(msg.content) : null;
                              const isCard = shared || storyReply;
                              return (
                                <div className={cn(
                                  'min-w-0 rounded-2xl px-4 py-2.5 text-body-sm',
                                  isCard || msg.file_url ? 'max-w-[85%] w-72' : 'max-w-[75%]',
                                  isSent ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md border border-border bg-white dark:bg-[#1a1a1a] dark:border-[#333] text-ink'
                                )}>
                                  {shared
                                    ? <SharedPostCard data={shared} isSent={isSent} />
                                    : storyReply
                                    ? <StoryReplyCard data={storyReply} isSent={isSent} />
                                    : messageReply
                                    ? <MessageReplyCard data={messageReply} isSent={isSent} />
                                    : <>
                                        {msg.image_url && (
                                          <button type="button" onClick={() => setImageLightbox(msg.image_url!)} className="mb-1.5 block w-full">
                                            <img src={msg.image_url} alt="Image" className="max-h-60 w-full rounded-xl object-cover" />
                                          </button>
                                        )}
                                        {msg.file_url && msg.file_name && (
                                          <div className="mb-1.5">
                                            <FileAttachmentCard url={msg.file_url} name={msg.file_name} size={msg.file_size} isSent={isSent} onView={(url, name) => setDocViewer({ url, name })} />
                                          </div>
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
                          </SwipeRow>
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
                  {replyTo && (
                    <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-muted/60 px-4 py-2 dark:border-[#222] dark:bg-[#161616]">
                      <div className="flex min-w-0 items-center gap-2 border-l-2 border-brand-500 pl-2.5">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-brand-600">Replying to {replyTo.senderName}</p>
                          <p className="truncate text-caption text-ink-muted">{replyTo.preview}</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => setReplyTo(null)} className="shrink-0 rounded-full p-1 text-ink-muted hover:bg-surface-muted dark:hover:bg-[#222]" aria-label="Cancel reply">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  )}
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
                  {msgFile && (
                    <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-border bg-surface-muted px-3 py-2 dark:border-[#333] dark:bg-[#1a1a1a]">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-[9px] font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-400">
                        {(msgFile.name.split('.').pop() || 'FILE').toUpperCase().slice(0, 4)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-ink">{msgFile.name}</span>
                        <span className="text-[11px] text-ink-muted">{formatFileSize(msgFile.size)}</span>
                      </span>
                      <button type="button" onClick={() => { setMsgFile(null); setFileError(null); }}
                        className="shrink-0 rounded-full p-1 text-ink-muted hover:bg-surface-subtle dark:hover:bg-[#222]" aria-label="Remove file">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                  {fileError && <p className="mx-4 mt-2 text-[12px] text-red-600">{fileError}</p>}
                  <form onSubmit={handleSend} className="flex items-end gap-2 p-4">
                    <input ref={imgInputRef} type="file" accept="image/*" onChange={handleImgSelect} className="hidden" />
                    <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv" onChange={handleFileSelect} className="hidden" />
                    <button type="button" onClick={() => imgInputRef.current?.click()} disabled={sending}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-muted hover:text-brand-600 disabled:opacity-40">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                    </button>
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={sending}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-muted hover:text-brand-600 disabled:opacity-40" aria-label="Attach file">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                      </svg>
                    </button>
                    <textarea ref={textareaRef} value={newMessage} onChange={handleTypingChange} onKeyDown={handleKeyDown}
                      placeholder="Type a message… (Enter to send)" rows={1} disabled={sending}
                      className="flex-1 resize-none rounded-xl border border-border bg-white dark:bg-[#1a1a1a] dark:border-[#333] px-4 py-2.5 text-body-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60"
                      style={{ maxHeight: '120px' }} />
                    <Button type="submit" size="sm" disabled={sending || (!newMessage.trim() && !msgImage && !msgFile)} loading={sending} className="shrink-0">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                    </Button>
                  </form>
                </div>
              </>
            ) : activeGroupId && activeGroupInfo ? (
              /* Group chat */
              <>
                <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
                  <button type="button" onClick={() => setMobileShowChat(false)} className="rounded-lg p-1 text-ink-secondary hover:bg-surface-subtle sm:hidden" aria-label="Back">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100">
                    {activeGroupInfo.avatar_url ? (
                      <img src={activeGroupInfo.avatar_url} alt={activeGroupInfo.name} className="h-full w-full object-cover" />
                    ) : (
                      <GroupIcon className="h-4.5 w-4.5 text-brand-600" />
                    )}
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
                          <SwipeRow key={msg.id} disabled={isDeleted} onReply={() => triggerReply(msg, isSent ? 'You' : msg.sender_name)} onLongPress={() => openMessageActions(msg, 'group', isSent ? 'You' : msg.sender_name)}>
                          <div className={cn('group/msg flex items-end gap-2', isSent ? 'justify-end' : 'justify-start')}>
                            {!isSent && (
                              <div className="w-7 shrink-0">
                                {showSenderInfo && <Avatar src={msg.sender_photo} name={msg.sender_name} size="sm" className="h-7 w-7" />}
                              </div>
                            )}
                            {isSent && !isDeleted && (
                              <div className="relative shrink-0 self-center">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); openMessageActions(msg, 'group', 'You'); }}
                                  className="flex h-6 w-6 items-center justify-center rounded-full text-ink-muted opacity-60 transition hover:bg-surface-muted hover:opacity-100 sm:opacity-0 sm:group-hover/msg:opacity-100"
                                  aria-label="Message options"
                                >
                                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                                </button>
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
                                const messageReply = !shared && !storyReply ? parseMessageReply(msg.content) : null;
                                const isCard = shared || storyReply;
                                return (
                                  <div className={cn(
                                    'rounded-2xl px-4 py-2.5 text-body-sm',
                                    isCard || msg.file_url ? 'w-72' : '',
                                    isSent ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md border border-border bg-white dark:bg-[#1a1a1a] dark:border-[#333] text-ink'
                                  )}>
                                    {shared
                                      ? <SharedPostCard data={shared} isSent={isSent} />
                                      : storyReply
                                      ? <StoryReplyCard data={storyReply} isSent={isSent} />
                                      : messageReply
                                      ? <MessageReplyCard data={messageReply} isSent={isSent} />
                                      : <>
                                          {msg.image_url && (
                                            <button type="button" onClick={() => setImageLightbox(msg.image_url!)} className="mb-1.5 block w-full">
                                              <img src={msg.image_url} alt="Image" className="max-h-60 w-full rounded-xl object-cover" />
                                            </button>
                                          )}
                                          {msg.file_url && msg.file_name && (
                                            <div className="mb-1.5">
                                              <FileAttachmentCard url={msg.file_url} name={msg.file_name} size={msg.file_size} isSent={isSent} onView={(url, name) => setDocViewer({ url, name })} />
                                            </div>
                                          )}
                                          {msg.content && <p className="whitespace-pre-wrap break-words">{renderWithMentions(msg.content)}</p>}
                                        </>
                                    }
                                    <p className={cn('mt-1 text-caption', isSent ? 'text-brand-200 text-right' : 'text-ink-muted')}>{formatTime(msg.created_at)}</p>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                          </SwipeRow>
                        );
                      })}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {replyTo && (
                  <div className="flex items-center justify-between gap-2 border-t border-border bg-surface-muted/60 px-4 py-2 dark:border-[#222] dark:bg-[#161616]">
                    <div className="flex min-w-0 items-center gap-2 border-l-2 border-brand-500 pl-2.5">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-brand-600">Replying to {replyTo.senderName}</p>
                        <p className="truncate text-caption text-ink-muted">{replyTo.preview}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => setReplyTo(null)} className="shrink-0 rounded-full p-1 text-ink-muted hover:bg-surface-muted dark:hover:bg-[#222]" aria-label="Cancel reply">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                )}
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
                {msgFile && (
                  <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-border bg-surface-muted px-3 py-2 dark:border-[#333] dark:bg-[#1a1a1a]">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-[9px] font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-400">
                      {(msgFile.name.split('.').pop() || 'FILE').toUpperCase().slice(0, 4)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink">{msgFile.name}</span>
                      <span className="text-[11px] text-ink-muted">{formatFileSize(msgFile.size)}</span>
                    </span>
                    <button type="button" onClick={() => { setMsgFile(null); setFileError(null); }}
                      className="shrink-0 rounded-full p-1 text-ink-muted hover:bg-surface-subtle dark:hover:bg-[#222]" aria-label="Remove file">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
                {fileError && <p className="mx-4 mt-2 text-[12px] text-red-600">{fileError}</p>}
                {/* @mention dropdown for group members */}
                {mentionQuery !== null && mentionMatches.length > 0 && (
                  <div className="mx-4 mb-1 overflow-hidden rounded-xl border border-border bg-white shadow-lg dark:bg-[#151515] dark:border-[#333]">
                    {mentionMatches.map((m, i) => (
                      <button
                        key={m.id}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); applyMention(m); }}
                        className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition ${
                          i === mentionActiveIdx ? 'bg-surface-muted dark:bg-[#222]' : 'hover:bg-surface-muted dark:hover:bg-[#222]'
                        }`}
                      >
                        <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-brand-100 dark:bg-brand-950">
                          {m.profile_photo_url ? (
                            <img src={m.profile_photo_url} alt={m.full_name} className="h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-[11px] font-bold text-brand-700 dark:text-brand-400">
                              {m.full_name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-ink">{m.full_name}</p>
                          {m.username && <p className="truncate text-[11px] text-ink-muted">@{m.username}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-border p-4">
                  <input ref={imgInputRef} type="file" accept="image/*" onChange={handleImgSelect} className="hidden" />
                  <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv" onChange={handleFileSelect} className="hidden" />
                  <button type="button" onClick={() => imgInputRef.current?.click()} disabled={sending}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-muted hover:text-brand-600 disabled:opacity-40">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                  </button>
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={sending}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-muted hover:text-brand-600 disabled:opacity-40" aria-label="Attach file">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                    </svg>
                  </button>
                  <textarea ref={textareaRef} value={newMessage} onChange={handleTypingChange} onKeyDown={handleKeyDown}
                    placeholder="Message group… (Enter to send)" rows={1} disabled={sending}
                    className="flex-1 resize-none rounded-xl border border-border bg-white dark:bg-[#1a1a1a] dark:border-[#333] px-4 py-2.5 text-body-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60"
                    style={{ maxHeight: '120px' }} />
                  <Button type="submit" size="sm" disabled={sending || (!newMessage.trim() && !msgImage && !msgFile)} loading={sending} className="shrink-0">
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
              <div className="mx-4 mt-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm text-brand-700 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-400">{groupInfoToast}</div>
            )}

            <div className="flex-1 overflow-y-auto">
              {/* INFO VIEW */}
              {groupInfoView === 'info' && (
                <div className="space-y-0">
                  {/* Group details */}
                  <div className="px-4 py-4 border-b border-border dark:border-[#222]">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-brand-100 text-xl dark:bg-brand-950">
                          {activeGroupInfo.avatar_url ? (
                            <img src={activeGroupInfo.avatar_url} alt={activeGroupInfo.name} className="h-full w-full object-cover" />
                          ) : (
                            <span>💬</span>
                          )}
                        </div>
                        {myGroupRole === 'admin' && (
                          <>
                            <button
                              type="button"
                              onClick={() => groupAvatarInputRef.current?.click()}
                              disabled={uploadingGroupAvatar}
                              aria-label="Change group photo"
                              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white shadow ring-2 ring-white transition hover:bg-brand-700 disabled:opacity-60 dark:ring-[#111]"
                            >
                              {uploadingGroupAvatar ? (
                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              ) : (
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                                </svg>
                              )}
                            </button>
                            <input ref={groupAvatarInputRef} type="file" accept="image/*" onChange={handleGroupAvatarChange} className="hidden" />
                          </>
                        )}
                      </div>
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

      {/* ── Image lightbox ───────────────────────────────────────────── */}
      {imageLightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setImageLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setImageLightbox(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <a
            href={imageLightbox}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12px] text-white transition hover:bg-white/20"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Save
          </a>
          <img
            src={imageLightbox}
            alt="Image"
            className="max-h-[90vh] max-w-full rounded-xl object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* ── Document viewer ──────────────────────────────────────────── */}
      {docViewer && (() => {
        const ext = (docViewer.name.split('.').pop() || '').toLowerCase();
        const isNativelyViewable = VIEWABLE_INLINE_EXTENSIONS.has(ext);
        const isOfficeDoc = OFFICE_VIEWER_EXTENSIONS.has(ext);
        // Office docs (Word/PowerPoint/Excel) can't be reliably previewed in a
        // mobile browser without a paid conversion service, so we send them
        // straight to a clean download panel instead of a flaky embedded viewer.
        // PDF/TXT/CSV render natively and reliably.
        const embedSrc = isNativelyViewable
          ? (ext === 'pdf' ? `${docViewer.url}#view=FitH&toolbar=1` : docViewer.url)
          : null;

        return (
          <div className="fixed inset-0 z-50 flex flex-col bg-black/90" style={{ height: '100dvh' }}>
            {/* Header bar */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#111] px-4 py-3">
              <p className="min-w-0 flex-1 truncate text-[14px] font-medium text-white">{docViewer.name}</p>
              <div className="flex shrink-0 items-center gap-2">
                {embedSrc && (
                  <a
                    href={embedSrc}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-white/20"
                    title="Open in a new tab for full zoom & scroll"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                    Full screen
                  </a>
                )}
                <a
                  href={docViewer.url}
                  download={docViewer.name}
                  className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-white/20"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => setDocViewer(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                  aria-label="Close"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Viewer body */}
            <div className="relative min-h-0 flex-1 overflow-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
              {embedSrc ? (
                <iframe
                  key={docViewer.url}
                  src={embedSrc}
                  title={docViewer.name}
                  scrolling="yes"
                  className="absolute inset-0 h-full w-full border-0 bg-white"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-y-auto px-6 text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-[13px] font-bold text-white">
                    {ext.toUpperCase().slice(0, 4)}
                  </span>
                  <div>
                    <p className="text-[15px] font-medium text-white">{isOfficeDoc ? 'Open this document' : 'This file can\u2019t be previewed'}</p>
                    <p className="mt-1 text-[13px] text-white/70">
                      {isOfficeDoc
                        ? 'Word and PowerPoint files open in a viewer in a new tab. Or download to open in your device\u2019s app.'
                        : 'Download it to open it on your device.'}
                    </p>
                  </div>
                  {isOfficeDoc && (
                    <a
                      href={`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(docViewer.url)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-full bg-brand-600 px-5 py-2.5 text-[14px] font-medium text-white transition hover:bg-brand-700"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                      Open in viewer
                    </a>
                  )}
                  <a
                    href={docViewer.url}
                    download={docViewer.name}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[14px] font-medium transition',
                      isOfficeDoc
                        ? 'bg-white/10 text-white hover:bg-white/20'
                        : 'bg-brand-600 text-white hover:bg-brand-700'
                    )}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Download {ext.toUpperCase()}
                  </a>
                </div>
              )}
            </div>
          </div>
        );
      })()}

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

      {/* ── Press-and-hold message action sheet ─────────────────────────── */}
      {actionSheet && (() => {
        const { msg, kind, senderName } = actionSheet;
        const isOwn = msg.sender_id === user.id;
        const hasCopyableText = !!plainMessageText(msg.content) || ('image_url' in msg && !!msg.image_url) || ('file_url' in msg && !!msg.file_url);
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={e => { if (e.target === e.currentTarget) setActionSheet(null); }}>
            <div className="w-full max-w-sm rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl dark:bg-[#161616] dark:border dark:border-[#222] sm:rounded-2xl sm:pb-0">
              <div className="flex items-center justify-between border-b border-border px-4 py-3 dark:border-[#222]">
                <p className="truncate text-caption font-medium text-ink-muted">{senderName === 'You' ? 'Your message' : `Message from ${senderName}`}</p>
                <button type="button" onClick={() => setActionSheet(null)} className="rounded-full p-1 text-ink-muted hover:bg-surface-muted dark:hover:bg-[#222]" aria-label="Close">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="py-1.5">
                <button
                  type="button"
                  onClick={() => { triggerReply(msg, senderName); setActionSheet(null); }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-body-sm font-medium text-ink hover:bg-surface-muted dark:hover:bg-[#222]"
                >
                  <svg className="h-4.5 w-4.5 text-ink-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 016 6v2" /></svg>
                  Reply
                </button>
                {hasCopyableText && (
                  <button
                    type="button"
                    onClick={handleCopyMessage}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-body-sm font-medium text-ink hover:bg-surface-muted dark:hover:bg-[#222]"
                  >
                    <svg className="h-4.5 w-4.5 text-ink-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" /></svg>
                    Copy
                  </button>
                )}
                <button
                  type="button"
                  onClick={openForward}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-body-sm font-medium text-ink hover:bg-surface-muted dark:hover:bg-[#222]"
                >
                  <svg className="h-4.5 w-4.5 text-ink-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H7.5M3 6.75v10.5" /></svg>
                  Forward
                </button>
                {isOwn && (
                  <button
                    type="button"
                    onClick={() => { setDeleteTarget({ id: msg.id, kind }); setActionSheet(null); }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-body-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                    Delete Message
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Forward message modal ───────────────────────────────────────── */}
      {forwardMsg && (() => {
        const text = plainMessageText(forwardMsg.content)
          || ('file_name' in forwardMsg && forwardMsg.file_name ? `📎 ${forwardMsg.file_name}` : '');
        const targets = [
          ...conversations.map(c => ({ kind: 'dm' as const, id: c.id, key: `dm-${c.id}`, name: c.other_user_name || 'Unknown User', photo: c.other_user_photo ?? null, isGroup: false })),
          ...groups.map(g => ({ kind: 'group' as const, id: g.id, key: `group-${g.id}`, name: g.name, photo: null, isGroup: true })),
        ].filter(t => t.name.toLowerCase().includes(forwardQuery.trim().toLowerCase()));
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={e => { if (e.target === e.currentTarget && !forwardingTo) setForwardMsg(null); }}>
            <div className="flex max-h-[80vh] w-full max-w-sm flex-col rounded-t-2xl bg-white shadow-2xl dark:bg-[#161616] dark:border dark:border-[#222] sm:rounded-2xl">
              <div className="flex items-center justify-between border-b border-border px-4 py-3 dark:border-[#222]">
                <h3 className="font-semibold text-ink">Forward message</h3>
                <button type="button" onClick={() => !forwardingTo && setForwardMsg(null)} className="rounded-full p-1 text-ink-muted hover:bg-surface-muted dark:hover:bg-[#222]" aria-label="Close">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              {text && (
                <div className="border-b border-border px-4 py-2.5 dark:border-[#222]">
                  <p className="line-clamp-2 text-caption text-ink-muted">{text}</p>
                </div>
              )}
              <div className="border-b border-border px-3 py-2.5 dark:border-[#222]">
                <input
                  type="text"
                  value={forwardQuery}
                  onChange={e => setForwardQuery(e.target.value)}
                  placeholder="Search conversations and groups..."
                  className="h-9 w-full rounded-lg border border-border bg-surface-muted px-3 text-[13px] text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-[#1a1a1a] dark:border-[#333]"
                  autoFocus
                />
              </div>
              <div className="flex-1 overflow-y-auto py-1">
                {targets.length === 0 ? (
                  <p className="px-4 py-6 text-center text-body-sm text-ink-muted">No matches found.</p>
                ) : (
                  targets.map(t => (
                    <button
                      key={t.key}
                      type="button"
                      disabled={!!forwardingTo}
                      onClick={() => sendForward(t)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-surface-muted disabled:opacity-60 dark:hover:bg-[#222]"
                    >
                      {t.isGroup ? (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-950">
                          <GroupIcon className="h-4.5 w-4.5 text-brand-600" />
                        </div>
                      ) : (
                        <Avatar src={t.photo} name={t.name} size="sm" className="h-9 w-9 shrink-0" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-body-sm font-medium text-ink">{t.name}</span>
                      {forwardingTo === t.key && (
                        <svg className="h-4 w-4 shrink-0 animate-spin text-brand-600" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Toasts ───────────────────────────────────────────────────────── */}
      {(copyToast || forwardedToast) && (
        <div className="fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-caption font-medium text-white shadow-lg sm:bottom-6 dark:bg-[#222]">
          {copyToast ? 'Copied to clipboard' : 'Message forwarded'}
        </div>
      )}
    </>
  );
}
