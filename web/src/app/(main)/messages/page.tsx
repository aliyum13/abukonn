'use client';

import { useEffect, useState, FormEvent, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';
import { formatTime, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Skeleton,
} from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface Conversation {
  id: number;
  other_user_id: number;
  other_user_name: string;
  other_user_department: string;
  other_user_photo?: string | null;
  last_message: string | null;
  last_message_at: string | null;
}

interface ChatMessage {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  created_at: string;
  sender_name: string;
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

export default function MessagesPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newChatId, setNewChatId] = useState('');
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const activeIdRef = useRef<number | null>(null);

  activeIdRef.current = activeId;

  useEffect(() => {
    if (!authLoading && !token) router.push('/login');
  }, [authLoading, token, router]);

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

  const fetchMessages = async (conversationId: number) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/messages/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMessages(data.messages || []);
    } catch {
      setMessages([]);
    }
  };

  useEffect(() => {
    if (activeId) fetchMessages(activeId);
  }, [activeId, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const socket = io(API_URL);
    socketRef.current = socket;

    socket.on('receive_message', (msg: ChatMessage) => {
      if (msg.conversation_id === activeIdRef.current) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
      fetchConversations();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [fetchConversations]);

  useEffect(() => {
    if (socketRef.current && activeId) {
      socketRef.current.emit('join_conversation', activeId);
    }
  }, [activeId]);

  const selectConversation = (id: number) => {
    setActiveId(id);
    setNewChatId('');
    setMobileShowChat(true);
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !token) return;
    setSending(true);

    try {
      if (activeId && socketRef.current) {
        socketRef.current.emit('send_message', {
          conversationId: activeId,
          content: newMessage,
          token,
        });
        setNewMessage('');
      } else if (newChatId) {
        const res = await fetch(`${API_URL}/api/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            recipient_id: parseInt(newChatId, 10),
            content: newMessage,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setNewMessage('');
          setActiveId(data.conversation_id);
          setNewChatId('');
          setMobileShowChat(true);
          await fetchConversations();
          await fetchMessages(data.conversation_id);
        }
      }
    } finally {
      setSending(false);
    }
  };

  const activeConversation = conversations.find((c) => c.id === activeId);

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

  const showList = !mobileShowChat || !activeId;
  const showChatPanel = mobileShowChat && (activeId || newChatId);

  return (
    <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
      <Card className="flex h-[calc(100vh-8rem)] overflow-hidden">
        {/* Conversation list */}
        <div
          className={cn(
            'flex w-full flex-col border-r border-border sm:w-80 sm:shrink-0',
            showChatPanel ? 'hidden sm:flex' : 'flex'
          )}
        >
          <div className="border-b border-border p-4">
            <h2 className="font-semibold text-ink">Messages</h2>
            <div className="mt-3">
              <Input
                type="number"
                value={newChatId}
                onChange={(e) => {
                  setNewChatId(e.target.value);
                  setActiveId(null);
                  setMobileShowChat(false);
                }}
                placeholder="User ID to message"
                className="text-body-sm"
              />
            </div>
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
                title="No conversations"
                description="Enter a user ID above to start your first chat."
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
                  <Avatar name={conv.other_user_name} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-body-sm font-medium text-ink">
                        {conv.other_user_name}
                      </p>
                      {conv.last_message_at && (
                        <span className="shrink-0 text-caption text-ink-muted">
                          {timeAgo(conv.last_message_at)}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-caption text-ink-muted">
                      {conv.last_message || 'No messages yet'}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat window */}
        <div
          className={cn(
            'flex flex-1 flex-col',
            showList && !newChatId ? 'hidden sm:flex' : 'flex'
          )}
        >
          {activeId && activeConversation ? (
            <>
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <button
                  type="button"
                  onClick={() => setMobileShowChat(false)}
                  className="rounded-lg p-1 text-ink-secondary hover:bg-surface-subtle sm:hidden"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <Avatar name={activeConversation.other_user_name} size="sm" />
                <div>
                  <p className="font-medium text-ink">{activeConversation.other_user_name}</p>
                  <p className="text-caption text-ink-muted">{activeConversation.other_user_department}</p>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto bg-surface-muted/50 p-4">
                {messages.map((msg) => {
                  const isSent = msg.sender_id === user.id;
                  return (
                    <div key={msg.id} className={cn('flex', isSent ? 'justify-end' : 'justify-start')}>
                      <div
                        className={cn(
                          'max-w-[75%] rounded-2xl px-4 py-2.5 text-body-sm',
                          isSent
                            ? 'rounded-br-md bg-brand-600 text-white'
                            : 'rounded-bl-md border border-border bg-white text-ink'
                        )}
                      >
                        <p>{msg.content}</p>
                        <p className={cn('mt-1 text-caption', isSent ? 'text-brand-200' : 'text-ink-muted')}>
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSend} className="flex gap-2 border-t border-border p-4">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1"
                />
                <Button type="submit" disabled={sending || !newMessage.trim()} loading={sending}>
                  Send
                </Button>
              </form>
            </>
          ) : newChatId ? (
            <>
              <div className="flex flex-1 flex-col items-center justify-center bg-surface-muted/50 p-6 text-center">
                <Badge variant="brand" className="mb-3">New conversation</Badge>
                <p className="text-body-sm text-ink-secondary">
                  Start chatting with User #{newChatId}
                </p>
              </div>
              <form onSubmit={handleSend} className="flex gap-2 border-t border-border p-4">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your first message..."
                  className="flex-1"
                />
                <Button type="submit" disabled={sending || !newMessage.trim()} loading={sending}>
                  Send
                </Button>
              </form>
            </>
          ) : (
            <EmptyState
              title="Select a conversation"
              description="Choose a chat from the list or start a new one with a user ID."
              className="flex-1"
              icon={
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75-.375.375.375 0 01.375.375m0 12.75a.375.375 0 11-.75-.375.375.375 0 01.375.375m0 12.75a.375.375 0 11-.75-.375.375.375 0 01.375.375m0 12.75a.375.375 0 11-.75-.375.375.375 0 01.375.375M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
          )}
        </div>
      </Card>
    </div>
  );
}
