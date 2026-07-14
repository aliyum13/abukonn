import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiFetch } from '../../src/lib/api';
import { useAuth } from '../../src/context/AuthContext';
import { colors } from '../../src/theme';

interface Msg {
  id: number;
  sender_id: number;
  content: string;
  created_at: string;
}

export default function Chat() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const listRef = useRef<FlatList<Msg>>(null);

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

  useEffect(() => { load(); }, [load]);

  // Polling, not sockets. Less elegant, but simple and reliable — and worth
  // revisiting once the app is proven.
  useEffect(() => {
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    try {
      const res = await apiFetch<{ data: Msg }>('/api/messages', {
        method: 'POST',
        body: JSON.stringify({ conversation_id: Number(id), content: body }),
      });
      setMessages(prev => [...prev, res.data]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
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

const s = StyleSheet.create({
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
