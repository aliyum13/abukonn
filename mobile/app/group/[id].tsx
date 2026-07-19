import { useEffect, useState, useCallback, useRef } from 'react';
import { useThemedStyles } from '../../src/theme/ThemeContext';
import type { Palette } from '../../src/theme';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { apiFetch } from '../../src/lib/api';
import { uploadImage } from '../../src/lib/upload';
import { useAuth } from '../../src/context/AuthContext';
import { colors } from '../../src/theme';

interface GroupMsg {
  id: number;
  sender_id: number;
  sender_name: string;
  sender_photo: string | null;
  content: string;
  image_url: string | null;
  created_at: string;
  is_deleted?: boolean;
}

export default function GroupChat() {
  const s = useThemedStyles(make_s);
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [messages, setMessages] = useState<GroupMsg[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sendingImage, setSendingImage] = useState(false);
  const listRef = useRef<FlatList<GroupMsg>>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ messages: GroupMsg[]; members: unknown[] }>(
        `/api/groups/${id}/messages`);
      setMessages(data.messages || []);
      setMemberCount(data.members?.length || 0);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Poll while open. Sockets would be nicer, but this is simple and reliable.
  useEffect(() => {
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    try {
      // NOTE: send returns { message } (singular), unlike the list's { messages }.
      const res = await apiFetch<{ message: GroupMsg }>(`/api/groups/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: body }),
      });
      setMessages(prev => [...prev, res.message]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch {
      setText(body); // put it back
    }
  };

  const sendImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo access to send an image.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    setSendingImage(true);
    try {
      const url = await uploadImage(result.assets[0].uri, 'abukonn/groups');
      const res = await apiFetch<{ message: GroupMsg }>(`/api/groups/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ image_url: url, content: '' }),
      });
      setMessages(prev => [...prev, res.message]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (err) {
      Alert.alert('Could not send image', err instanceof Error ? err.message : '');
    } finally {
      setSendingImage(false);
    }
  };


  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text style={s.back}>‹ Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.title} numberOfLines={1}>{name}</Text>
          {memberCount > 0 ? <Text style={s.sub}>{memberCount} members</Text> : null}
        </View>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/group-info', params: { id: String(id), name } })}
          hitSlop={10}
          style={{ width: 50, alignItems: 'flex-end' }}
        >
          <Ionicons name="information-circle-outline" size={24} color={colors.text} />
        </TouchableOpacity>
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
            data={messages.filter(m => !m.is_deleted)}
            keyExtractor={m => String(m.id)}
            contentContainerStyle={{ padding: 12 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              const mine = item.sender_id === user?.id;
              return (
                <View style={[s.msgRow, mine ? s.msgRowMine : null]}>
                  {!mine ? (
                    item.sender_photo ? (
                      <Image source={{ uri: item.sender_photo }} style={s.msgAvatar} />
                    ) : (
                      <View style={[s.msgAvatar, s.fallback]}>
                        <Text style={s.avatarLetter}>
                          {item.sender_name?.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )
                  ) : null}
                  <View style={[s.bubble, mine ? s.mine : s.theirs]}>
                    {!mine ? <Text style={s.senderName}>{item.sender_name}</Text> : null}
                    {item.image_url ? (
                      <Image source={{ uri: item.image_url }} style={s.msgImage} resizeMode="contain" />
                    ) : null}
                    {item.content ? (
                      <Text style={mine ? s.mineText : s.theirsText}>{item.content}</Text>
                    ) : null}
                  </View>
                </View>
              );
            }}
          />
        )}

        <View style={s.bar}>
          <TouchableOpacity onPress={sendImage} disabled={sendingImage} hitSlop={8}>
            {sendingImage
              ? <ActivityIndicator color={colors.brand} size="small" />
              : <Ionicons name="image-outline" size={26} color={colors.brand} />}
          </TouchableOpacity>
          <TextInput
            style={s.input}
            placeholder="Message the group..."
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
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  back: { color: colors.brand, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  sub: { fontSize: 12, color: colors.muted, marginTop: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 10 },
  msgRowMine: { justifyContent: 'flex-end' },
  msgAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#dcfce7' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: colors.brand, fontWeight: '700', fontSize: 12 },
  bubble: { maxWidth: '76%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.brand },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#f3f4f6' },
  senderName: { fontSize: 12, fontWeight: '700', color: colors.brand, marginBottom: 2 },
  mineText: { color: '#fff', fontSize: 15 },
  theirsText: { color: colors.text, fontSize: 15 },
  msgImage: { width: 200, height: 200, borderRadius: 10, marginBottom: 4 },
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  input: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, color: colors.text, maxHeight: 100,
  },
  send: { color: colors.brand, fontWeight: '700', fontSize: 15 },
});
