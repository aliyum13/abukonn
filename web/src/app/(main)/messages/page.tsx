'use client';

import { useEffect, useState, useRef, useCallback, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';
import { formatTime, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Avatar, Button, Card, EmptyState, Skeleton } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

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

interface ChatMessage {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  created_at: string;
  sender_name: string;
  is_read: boolean;
}

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
      <div className="flex justify-end"><Skeleton className="h-10 w-40 rounded-2xl" /></div>
    </div>
  );
}

export default function MessagesPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
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
  const conversationsRef = useRef<Conversation[]>([]);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep refs in sync with state so socket closures always see fresh values
  activeIdRef.current = activeId;
  conversationsRef.current = conversations;

  // ── Auth guard ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !token) router.push('/login');
  }, [authLoading, token, router]);

  // ── Conversations ────────────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchConversations();
  }, [token, fetchConversations]);

  // ── Auto-open conversation from ?userId param ────────────────────────
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
        setConversations((prev) => {
          if (prev.some((c) => c.id === conv.id)) return prev;
          return [conv, ...prev];
        });
        setActiveId(conv.id);
        setMobileShowChat(true);
        window.history.replaceState({}, '', '/messages');
      } catch {
        /* ignore */
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Messages for active conversation ────────────────────────────────
  const fetchMessages = useCallback(
    async (conversationId: number) => {
      if (!token) return;
      setMessagesLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/messages/${conversationId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setMessages(data.messages || []);
        // Clear unread badge
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c))
        );
        // Notify sender their messages were read
        socketRef.current?.emit('mark_read', { conversationId, token });
      } catch {
        setMessages([]);
      } finally {
        setMessagesLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (activeId) fetchMessages(activeId);
  }, [activeId, fetchMessages]);

  // ── Auto-scroll ──────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingText]);

  // ── Socket.io ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    const socket = io(API_URL, { autoConnect: true });
    socketRef.current = socket;

    const joinCurrentRoom = () => {
      if (activeIdRef.current) {
        socket.emit('join_conversation', activeIdRef.current);
      }
    };

    socket.on('connect', () => {
      socket.emit('user_online', token);
      joinCurrentRoom(); // rejoin on reconnect
    });

    // Real-time message from another user (or echo of own message sent via socket path)
    socket.on('receive_message', (msg: ChatMessage) => {
      if (msg.conversation_id === activeIdRef.current) {
        setMessages((prev) => {
          // Deduplicate — own message already added from REST response
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        // Mark as read since we're viewing this conversation
        socket.emit('mark_read', { conversationId: msg.conversation_id, token });
      }
      // Always refresh conversation list for last message preview + unread counts
      fetchConversations();
    });

    socket.on('user_typing', ({ conversationId }: { conversationId: number }) => {
      if (conversationId === activeIdRef.current) {
        // Use the ref so we always get the current conversation list
        const conv = conversationsRef.current.find((c) => c.id === conversationId);
        setTypingText(`${conv?.other_user_name ?? 'Someone'} is typing…`);
      }
    });

    socket.on('user_stopped_typing', ({ conversationId }: { conversationId: number }) => {
      if (conversationId === activeIdRef.current) {
        setTypingText('');
      }
    });

    socket.on('user_status', ({ userId, online }: { userId: number; online: boolean }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (online) next.add(userId);
        else next.delete(userId);
        return next;
      });
    });

    socket.on('messages_read', ({ conversationId }: { conversationId: number }) => {
      if (conversationId === activeIdRef.current) {
        setMessages((prev) => prev.map((m) => ({ ...m, is_read: true })));
      }
    });

    socket.on('connect_error', (err) => {
      console.warn('Socket connection error:', err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, fetchConversations]);

  // Join room when active conversation changes
  useEffect(() => {
    if (socketRef.current?.connected && activeId) {
      socketRef.current.emit('join_conversation', activeId);
      setTypingText('');
    }
  }, [activeId]);

  // Request initial online status for all conversation partners
  useEffect(() => {
    if (!conversations.length || !socketRef.current?.connected) return;
    const ids = conversations.map((c) => c.other_user_id);
    socketRef.current.emit(
      'get_online_status',
      ids,
      (statuses: { userId: number; online: boolean }[]) => {
        const online = new Set(statuses.filter((s) => s.online).map((s) => s.userId));
        setOnlineUsers(online);
      }
    );
  }, [conversations]);

  // ── Handlers ─────────────────────────────────────────────────────────
  const selectConversation = (id: number) => {
    setActiveId(id);
    setMobileShowChat(true);
    setTypingText('');
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const handleTypingChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);

    // Auto-resize textarea
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

  /**
   * Primary send path: REST API (guaranteed delivery).
   * The backend also emits receive_message via Socket.io to broadcast to others.
   * We add the message immediately from the REST response so the sender
   * sees it without waiting for the socket echo.
   */
  const handleSend = async (e?: FormEvent) => {
    e?.preventDefault();
    const text = newMessage.trim();
    if (!text || !token || !activeId || sending) return;

    // Stop typing indicator immediately
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socketRef.current?.emit('typing_stop', { conversationId: activeId, token });

    setNewMessage('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setSending(true);

    try {
      const res = await fetch(`${API_URL}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ conversation_id: activeId, content: text }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to send message');
      }

      const data = await res.json();
      const sentMsg: ChatMessage = data.data;

      // Add immediately from REST response — deduplication handles socket echo
      setMessages((prev) => {
        if (prev.some((m) => m.id === sentMsg.id)) return prev;
        return [...prev, sentMsg];
      });

      // Optimistically update conversation preview
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? { ...c, last_message: text, last_message_at: new Date().toISOString() }
            : c
        )
      );
    } catch (err) {
      console.error('Send failed:', err);
      // Restore input so the user can retry
      setNewMessage(text);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Derived state ────────────────────────────────────────────────────
  const activeConversation = conversations.find((c) => c.id === activeId);
  const isOtherOnline = activeConversation
    ? onlineUsers.has(activeConversation.other_user_id)
    : false;
  const lastSentMsg = [...messages].reverse().find((m) => m.sender_id === user?.id);
  const showList = !mobileShowChat || !activeId;

  if (authLoading || !user) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
        <Card className="h-[calc(100vh-8rem)]">
          <div className="flex h-full">
            <div className="w-full max-w-sm border-r border-border p-4 space-y-2">
              <ConversationSkeleton />
              <ConversationSkeleton />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
      <Card className="flex h-[calc(100vh-8rem)] overflow-hidden">
        {/* ── Conversation list ──────────────────────────────────── */}
        <div
          className={cn(
            'flex w-full flex-col border-r border-border sm:w-80 sm:shrink-0',
            mobileShowChat && activeId ? 'hidden sm:flex' : 'flex'
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
            <h2 className="font-semibold text-ink">Messages</h2>
            <Link href="/search">
              <Button variant="ghost" size="sm" className="text-caption text-ink-muted">
                Find people
              </Button>
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="py-2">
                <ConversationSkeleton />
                <ConversationSkeleton />
                <ConversationSkeleton />
              </div>
            ) : conversations.length === 0 ? (
              <EmptyState
                title="No conversations yet"
                description="Find students to message via Search."
                className="py-12"
                icon={
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                }
              />
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => selectConversation(conv.id)}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-3 text-left transition',
                    activeId === conv.id
                      ? 'border-r-2 border-brand-600 bg-brand-50'
                      : 'hover:bg-surface-muted'
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar src={conv.other_user_photo} name={conv.other_user_name} size="md" />
                    {onlineUsers.has(conv.other_user_id) && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-brand-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn('truncate text-body-sm', conv.unread_count > 0 ? 'font-semibold text-ink' : 'font-medium text-ink')}>
                        {conv.other_user_name}
                      </p>
                      {conv.last_message_at && (
                        <span className="shrink-0 text-caption text-ink-muted">
                          {timeAgo(conv.last_message_at)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn('truncate text-caption', conv.unread_count > 0 ? 'font-medium text-ink' : 'text-ink-muted')}>
                        {conv.last_message || 'No messages yet'}
                      </p>
                      {conv.unread_count > 0 && (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                          {conv.unread_count > 9 ? '9+' : conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Chat window ────────────────────────────────────────── */}
        <div
          className={cn(
            'flex flex-1 flex-col',
            showList ? 'hidden sm:flex' : 'flex'
          )}
        >
          {activeId && activeConversation ? (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <button
                  type="button"
                  onClick={() => { setMobileShowChat(false); setTypingText(''); }}
                  className="rounded-lg p-1 text-ink-secondary hover:bg-surface-subtle sm:hidden"
                  aria-label="Back"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="relative shrink-0">
                  <Avatar src={activeConversation.other_user_photo} name={activeConversation.other_user_name} size="sm" />
                  {isOtherOnline && (
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/profile/${activeConversation.other_user_id}`} className="font-medium text-ink transition hover:text-brand-600">
                    {activeConversation.other_user_name}
                  </Link>
                  <p className="text-caption text-ink-muted">
                    {isOtherOnline ? (
                      <span className="font-medium text-brand-600">Online</span>
                    ) : (
                      activeConversation.other_user_department
                    )}
                  </p>
                </div>
              </div>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto bg-surface-muted/40 p-4">
                {messagesLoading ? (
                  <MessageSkeleton />
                ) : messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-surface-muted">
                      <svg className="h-7 w-7 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                      </svg>
                    </div>
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
                          {!isSent && (
                            <div className="w-7 shrink-0">
                              {showAvatar && (
                                <Avatar src={activeConversation.other_user_photo} name={activeConversation.other_user_name} size="xs" />
                              )}
                            </div>
                          )}
                          <div className={cn('flex flex-col', isSent ? 'items-end' : 'items-start')}>
                            <div
                              className={cn(
                                'max-w-[75%] rounded-2xl px-4 py-2.5 text-body-sm',
                                isSent
                                  ? 'rounded-br-md bg-brand-600 text-white'
                                  : 'rounded-bl-md border border-border bg-white text-ink'
                              )}
                            >
                              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                              <p className={cn('mt-1 text-caption', isSent ? 'text-brand-200' : 'text-ink-muted')}>
                                {formatTime(msg.created_at)}
                              </p>
                            </div>
                            {isLastSent && (
                              <p className="mt-0.5 text-[10px] text-ink-muted">
                                {msg.is_read ? '✓✓ Read' : '✓ Delivered'}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Typing indicator */}
                    {typingText && (
                      <div className="flex items-end gap-2">
                        <div className="w-7 shrink-0" />
                        <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-border bg-white px-4 py-2.5">
                          <span className="flex gap-1">
                            {[0, 1, 2].map((i) => (
                              <span
                                key={i}
                                className="h-2 w-2 animate-bounce rounded-full bg-ink-muted"
                                style={{ animationDelay: `${i * 0.15}s` }}
                              />
                            ))}
                          </span>
                          <span className="text-caption text-ink-muted">{typingText}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Compose */}
              <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-border p-4">
                <textarea
                  ref={textareaRef}
                  value={newMessage}
                  onChange={handleTypingChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message… (Enter to send)"
                  rows={1}
                  disabled={sending}
                  className="flex-1 resize-none rounded-xl border border-border bg-white px-4 py-2.5 text-body-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60"
                  style={{ maxHeight: '120px' }}
                />
                <Button type="submit" size="sm" disabled={sending || !newMessage.trim()} loading={sending} className="shrink-0">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </Button>
              </form>
            </>
          ) : (
            <EmptyState
              title="Select a conversation"
              description="Choose a chat from the list or find someone to message."
              className="flex-1"
              icon={
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              }
            />
          )}
        </div>
      </Card>
    </div>
  );
}
