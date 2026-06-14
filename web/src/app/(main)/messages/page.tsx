'use client';

import { useEffect, useState, FormEvent, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface Conversation {
  id: number;
  other_user_id: number;
  other_user_name: string;
  other_user_department: string;
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

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
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

  // Socket.io connection
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

    socket.on('error_message', (err: { message: string }) => {
      console.error('Socket error:', err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [fetchConversations]);

  // Join conversation room when selected
  useEffect(() => {
    if (socketRef.current && activeId) {
      socketRef.current.emit('join_conversation', activeId);
    }
  }, [activeId]);

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
    return <div className="flex items-center justify-center min-h-[60vh] text-gray-400">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 h-[calc(100vh-7rem)]">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex h-full overflow-hidden">
        {/* Conversation List */}
        <div className="w-80 border-r border-gray-200 flex flex-col shrink-0">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Messages</h2>
            <div className="mt-2 flex gap-1">
              <input
                type="number"
                value={newChatId}
                onChange={(e) => { setNewChatId(e.target.value); setActiveId(null); }}
                placeholder="User ID to message"
                className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#16a34a] outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="text-gray-400 text-sm text-center py-8">Loading...</p>
            ) : conversations.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8 px-4">No conversations yet. Enter a user ID above to start chatting.</p>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => { setActiveId(conv.id); setNewChatId(''); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left ${
                    activeId === conv.id ? 'bg-green-50 border-r-2 border-[#16a34a]' : ''
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-green-100 text-[#16a34a] flex items-center justify-center text-sm font-semibold shrink-0">
                    {getInitials(conv.other_user_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{conv.other_user_name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {conv.last_message || 'No messages yet'}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Window */}
        <div className="flex-1 flex flex-col">
          {activeId && activeConversation ? (
            <>
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="font-medium text-gray-900">{activeConversation.other_user_name}</p>
                <p className="text-xs text-gray-400">{activeConversation.other_user_department}</p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg) => {
                  const isSent = msg.sender_id === user.id;
                  return (
                    <div key={msg.id} className={`flex ${isSent ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm ${
                          isSent
                            ? 'bg-[#16a34a] text-white rounded-br-md'
                            : 'bg-gray-100 text-gray-800 rounded-bl-md'
                        }`}
                      >
                        <p>{msg.content}</p>
                        <p className={`text-[10px] mt-1 ${isSent ? 'text-green-200' : 'text-gray-400'}`}>
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSend} className="p-4 border-t border-gray-100 flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-full focus:ring-2 focus:ring-[#16a34a] focus:border-transparent outline-none text-sm"
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="px-5 py-2 bg-[#16a34a] hover:bg-green-700 text-white text-sm font-medium rounded-full transition disabled:opacity-50"
                >
                  Send
                </button>
              </form>
            </>
          ) : newChatId ? (
            <>
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                Start a conversation with User #{newChatId}
              </div>
              <form onSubmit={handleSend} className="p-4 border-t border-gray-100 flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your first message..."
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-full focus:ring-2 focus:ring-[#16a34a] focus:border-transparent outline-none text-sm"
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="px-5 py-2 bg-[#16a34a] hover:bg-green-700 text-white text-sm font-medium rounded-full transition disabled:opacity-50"
                >
                  Send
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              Select a conversation to start chatting
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
