import { useEffect, useState, useCallback, useRef } from 'react';
import { useThemedStyles } from '../../src/theme/ThemeContext';
import type { Palette } from '../../src/theme';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, Image, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { apiFetch } from '../../src/lib/api';
import { uploadImage } from '../../src/lib/upload';
import { MessageBody } from '../../src/components/MessageBody';
import { friendlyPreview } from '../../src/lib/messagePreview';
import { getSocket } from '../../src/lib/socket';
import type { Socket } from 'socket.io-client';
import { useAuth } from '../../src/context/AuthContext';
import { colors } from '../../src/theme';

interface Msg {
  id: number;
  sender_id: number;
  content: string;
  image_url?: string | null;
  is_read?: boolean;
  created_at: string;
}

export default function Chat() {
  const s = useThemedStyles(make_s);
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [theyreTyping, setTheyreTyping] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: number; senderName: string; preview: string } | null>(null);
  const [sendingImage, setSendingImage] = useState(false);
  const listRef = useRef<FlatList<Msg>>(null);
  const socketRef = useRef<Socket | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const theyStopTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ messages: Msg[] }>(`/api/messages/${id}`);
      setMessages(data.messages || []);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Append a message unless we already have it (the socket echoes back messages
  // we sent, and load() may overlap) — dedupe by id.
  const addMessage = useCallback((m: Msg) => {
    setMessages(prev => (prev.some(x => x.id === m.id) ? prev : [...prev, m]));
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Real-time: join this conversation's room and receive messages instantly.
  useEffect(() => {
    let live = true;
    let cleanup: (() => void) | null = null;
    (async () => {
      const socket = await getSocket();
      if (!socket || !live) return;
      socketRef.current = socket;
      socket.emit('join_conversation', Number(id));
      // Mark the other person's messages as read now that we're viewing.
      socket.emit('mark_read', { conversationId: Number(id) });
      const onReceive = (msg: Msg & { conversation_id?: number }) => {
        // Server broadcasts to the room; guard against cross-room bleed.
        if (msg.conversation_id && String(msg.conversation_id) !== String(id)) return;
        addMessage(msg);
        // A new incoming message while we're here is immediately read.
        socket.emit('mark_read', { conversationId: Number(id) });
      };
      socket.on('receive_message', onReceive);

      // When the other side reads, mark our sent messages as read (✓✓).
      const onRead = ({ conversationId }: { conversationId: number }) => {
        if (String(conversationId) !== String(id)) return;
        setMessages(prev => prev.map(m => ({ ...m, is_read: true })));
      };
      socket.on('messages_read', onRead);

      // Typing indicator — the server broadcasts these to everyone else in the
      // room, so anything we receive is the OTHER person typing.
      const onTyping = ({ conversationId }: { conversationId: number }) => {
        if (String(conversationId) !== String(id)) return;
        setTheyreTyping(true);
        if (theyStopTimeout.current) clearTimeout(theyStopTimeout.current);
        // Auto-clear in case we miss the stop event.
        theyStopTimeout.current = setTimeout(() => setTheyreTyping(false), 4000);
      };
      const onStopTyping = ({ conversationId }: { conversationId: number }) => {
        if (String(conversationId) !== String(id)) return;
        setTheyreTyping(false);
      };
      socket.on('user_typing', onTyping);
      socket.on('user_stopped_typing', onStopTyping);

      cleanup = () => {
        socket.off('receive_message', onReceive);
        socket.off('messages_read', onRead);
        socket.off('user_typing', onTyping);
        socket.off('user_stopped_typing', onStopTyping);
      };
    })();
    return () => {
      live = false;
      cleanup?.();
    };
  }, [id, addMessage]);

  // Safety net only: sockets deliver messages in real time now, but if the
  // connection briefly drops we still reconcile every 20s so nothing is lost.
  useEffect(() => {
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    // If replying, wrap as a message_reply payload (rendered by MessageBody).
    const outgoing = replyTo
      ? JSON.stringify({ type: 'message_reply', quoted_sender: replyTo.senderName, quoted_text: replyTo.preview, reply: body })
      : body;
    setReplyTo(null);
    try {
      const socket = socketRef.current;
      if (socket?.connected) {
        // Real-time path — the server saves it and broadcasts back to the room,
        // where our receive_message handler (deduped) will add it.
        socket.emit('send_message', { conversationId: Number(id), content: outgoing });
      } else {
        // Socket down — fall back to REST so a message is never lost.
        const res = await apiFetch<{ data: Msg }>('/api/messages', {
          method: 'POST',
          body: JSON.stringify({ conversation_id: Number(id), content: outgoing }),
        });
        addMessage(res.data);
      }
    } catch {
      setText(body); // put it back so nothing is lost
    }
  };

  const startReply = (m: Msg) => {
    const senderName = m.sender_id === user?.id ? 'You' : (name || 'Them');
    const preview = m.content ? friendlyPreview(m.content) : (m.image_url ? '📷 Photo' : '');
    setReplyTo({ id: m.id, senderName, preview });
  };

  // Emit typing_start as the user types, and typing_stop after a short pause.
  const onChangeText = (v: string) => {
    setText(v);
    const socket = socketRef.current;
    if (!socket?.connected) return;
    socket.emit('typing_start', { conversationId: Number(id) });
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit('typing_stop', { conversationId: Number(id) });
    }, 1500);
  };

  const sendImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo access to send an image.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    setSendingImage(true);
    try {
      const url = await uploadImage(result.assets[0].uri, 'abukonn/messages');
      // Images go via REST — the socket send_message handler only carries text.
      const res = await apiFetch<{ data: Msg }>('/api/messages', {
        method: 'POST',
        body: JSON.stringify({ conversation_id: Number(id), image_url: url, content: '' }),
      });
      addMessage(res.data);
    } catch (err) {
      Alert.alert('Could not send image', err instanceof Error ? err.message : '');
    } finally {
      setSendingImage(false);
    }
  };

  // The read receipt shows only under the most recent message I sent.
  const lastSentId = [...messages].reverse().find(m => m.sender_id === user?.id)?.id;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text style={s.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>{name}</Text>
        <View style={{ width: 50 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {loading ? (
          <View style={s.center}><ActivityIndicator color={colors.brand} /></View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={m => String(m.id)}
            contentContainerStyle={{ padding: 12 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              const mine = item.sender_id === user?.id;
              const showReceipt = mine && item.id === lastSentId;
              return (
                <View style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                  <TouchableOpacity activeOpacity={0.8} onLongPress={() => startReply(item)} delayLongPress={250}>
                    <View style={[s.bubble, mine ? s.mine : s.theirs]}>
                      {item.image_url ? (
                        <Image source={{ uri: item.image_url }} style={s.msgImage} resizeMode="contain" />
                      ) : null}
                      {item.content ? (
                        <MessageBody content={item.content} mine={mine} />
                      ) : null}
                    </View>
                  </TouchableOpacity>
                  {showReceipt ? (
                    <Text style={s.receipt}>{item.is_read ? '✓✓ Read' : '✓ Delivered'}</Text>
                  ) : null}
                </View>
              );
            }}
          />
        )}

        {theyreTyping ? (
          <Text style={s.typing}>{name} is typing…</Text>
        ) : null}

        {replyTo ? (
          <View style={s.replyPreview}>
            <View style={{ flex: 1 }}>
              <Text style={s.replyPreviewSender} numberOfLines={1}>Replying to {replyTo.senderName}</Text>
              <Text style={s.replyPreviewText} numberOfLines={1}>{replyTo.preview}</Text>
            </View>
            <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={10}>
              <Ionicons name="close" size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={s.bar}>
          <TouchableOpacity onPress={sendImage} disabled={sendingImage} hitSlop={8}>
            {sendingImage
              ? <ActivityIndicator color={colors.brand} size="small" />
              : <Ionicons name="image-outline" size={26} color={colors.brand} />}
          </TouchableOpacity>
          <TextInput
            style={s.input}
            placeholder="Message..."
            placeholderTextColor={colors.muted}
            value={text}
            onChangeText={onChangeText}
            multiline
          />
          <TouchableOpacity onPress={send} disabled={!text.trim()}>
            <Text style={[s.send, !text.trim() ? { opacity: 0.4 } : null]}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const make_s = (colors: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { color: colors.brand, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 8 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.brand },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#f3f4f6' },
  mineText: { color: '#fff', fontSize: 15 },
  theirsText: { color: colors.text, fontSize: 15 },
  msgImage: { width: 200, height: 200, borderRadius: 12, marginBottom: 4, backgroundColor: 'rgba(0,0,0,0.05)' },
  typing: { fontSize: 13, color: colors.muted, fontStyle: 'italic', paddingHorizontal: 16, paddingBottom: 4 },
  receipt: { fontSize: 11, color: colors.muted, marginTop: 2, marginBottom: 4, marginRight: 4 },
  replyPreview: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  replyPreviewSender: { fontSize: 12, fontWeight: '700', color: colors.brand },
  replyPreviewText: { fontSize: 13, color: colors.muted },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderTopWidth: 1, borderTopColor: colors.border },
  input: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: colors.text, maxHeight: 100 },
  send: { color: colors.brand, fontWeight: '700', fontSize: 15 },
});
