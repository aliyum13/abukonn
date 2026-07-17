import { useEffect, useState, useCallback, useRef } from 'react';
import { useThemedStyles } from '../../src/theme/ThemeContext';
import type { Palette } from '../../src/theme';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiFetch } from '../../src/lib/api';
import { getSocket } from '../../src/lib/socket';
import type { Socket } from 'socket.io-client';
import { useAuth } from '../../src/context/AuthContext';
import { colors } from '../../src/theme';

interface Msg {
  id: number;
  sender_id: number;
  content: string;
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
  const listRef = useRef<FlatList<Msg>>(null);
  const socketRef = useRef<Socket | null>(null);

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
      const onReceive = (msg: Msg & { conversation_id?: number }) => {
        // Server broadcasts to the room; guard against cross-room bleed.
        if (msg.conversation_id && String(msg.conversation_id) !== String(id)) return;
        addMessage(msg);
      };
      socket.on('receive_message', onReceive);
      cleanup = () => socket.off('receive_message', onReceive);
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
    try {
      const socket = socketRef.current;
      if (socket?.connected) {
        // Real-time path — the server saves it and broadcasts back to the room,
        // where our receive_message handler (deduped) will add it.
        socket.emit('send_message', { conversationId: Number(id), content: body });
      } else {
        // Socket down — fall back to REST so a message is never lost.
        const res = await apiFetch<{ data: Msg }>('/api/messages', {
          method: 'POST',
          body: JSON.stringify({ conversation_id: Number(id), content: body }),
        });
        addMessage(res.data);
      }
    } catch {
      setText(body); // put it back so nothing is lost
    }
  };

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
              return (
                <View style={[s.bubble, mine ? s.mine : s.theirs]}>
                  <Text style={mine ? s.mineText : s.theirsText}>{item.content}</Text>
                </View>
              );
            }}
          />
        )}

        <View style={s.bar}>
          <TextInput
            style={s.input}
            placeholder="Message..."
            placeholderTextColor={colors.muted}
            value={text}
            onChangeText={setText}
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
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderTopWidth: 1, borderTopColor: colors.border },
  input: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: colors.text, maxHeight: 100 },
  send: { color: colors.brand, fontWeight: '700', fontSize: 15 },
});
