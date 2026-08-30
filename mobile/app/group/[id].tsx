import { useEffect, useState, useCallback, useRef } from 'react';
import { useThemedStyles } from '../../src/theme/ThemeContext';
import type { Palette } from '../../src/theme';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, Image, Alert, Modal, Clipboard, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { apiFetch } from '../../src/lib/api';
import { uploadImage } from '../../src/lib/upload';
import { useAuth } from '../../src/context/AuthContext';
import { plainText, editableText, withEditedText } from '../../src/lib/messagePreview';
import { MessageBody } from '../../src/components/MessageBody';
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
  edited_at?: string | null;
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
  // Edit sheet state, same shape as chat/[id].tsx (Modal, not Alert.prompt —
  // prompt is iOS-only). This screen polls rather than holding a socket, so
  // other members pick edits up on the next 5s reconcile, exactly as they
  // already do for deletes.
  const [editMsg, setEditMsg] = useState<GroupMsg | null>(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [forwardMsg, setForwardMsg] = useState<GroupMsg | null>(null);
  const [forwardConvos, setForwardConvos] = useState<{ id: number; other_user_name: string; other_user_id: number }[]>([]);
  const [forwardingTo, setForwardingTo] = useState<number | null>(null);
  const [forwardedTo, setForwardedTo] = useState<Set<number>>(new Set());
  const listRef = useRef<FlatList<GroupMsg>>(null);
  // Older-history pagination, same fix shape as chat/[id].tsx (item 4) --
  // group history had the identical unbounded-fetch bug, just never reported
  // separately since it was found while fixing the DM one.
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const pinScrollRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ messages: GroupMsg[]; members: unknown[]; hasMore?: boolean }>(
        `/api/groups/${id}/messages`);
      setMessages(data.messages || []);
      setMemberCount(data.members?.length || 0);
      setHasMoreOlder(!!data.hasMore);
    } catch {
      setMessages([]);
      setHasMoreOlder(false);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadOlder = useCallback(async () => {
    if (loadingOlder || !hasMoreOlder || messages.length === 0) return;
    const oldestId = messages[0].id;
    setLoadingOlder(true);
    pinScrollRef.current = true;
    try {
      const data = await apiFetch<{ messages: GroupMsg[]; hasMore?: boolean }>(
        `/api/groups/${id}/messages?before=${oldestId}`
      );
      const older = data.messages || [];
      setMessages(prev => {
        const existing = new Set(prev.map(m => m.id));
        const deduped = older.filter(m => !existing.has(m.id));
        return deduped.length > 0 ? [...deduped, ...prev] : prev;
      });
      setHasMoreOlder(!!data.hasMore);
    } catch {
      // leave existing messages untouched; user can tap again to retry
    } finally {
      setLoadingOlder(false);
      setTimeout(() => { pinScrollRef.current = false; }, 300);
    }
  }, [id, loadingOlder, hasMoreOlder, messages]);

  useEffect(() => { load(); }, [load]);

  // Same gap as chat/[id].tsx: the input-visibility fix keeps the input bar
  // above the keyboard, but doesn't force the latest message into view if
  // you were scrolled up reading older messages when you tapped the input.
  // Scroll to the latest message whenever the keyboard shows.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      if (pinScrollRef.current) return; // mid load-older; don't yank away from it
      listRef.current?.scrollToEnd({ animated: true });
    });
    return () => sub.remove();
  }, []);

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

  const deleteMessage = (m: GroupMsg) => {
    Alert.alert('Delete message', 'This message will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          // Tombstone rather than remove — the server soft-deletes, so the 5s
          // poll brings the row straight back as "This message was deleted".
          // Dropping it locally made it flicker out and reappear.
          setMessages(prev => prev.map(x => (
            x.id === m.id ? { ...x, is_deleted: true, content: '', image_url: null } : x
          )));
          try {
            await apiFetch(`/api/groups/${id}/messages/${m.id}`, { method: 'DELETE' });
          } catch {
            setMessages(prev => prev.map(x => (x.id === m.id ? m : x)));
            Alert.alert('Could not delete', 'The message could not be removed.');
          }
        },
      },
    ]);
  };

  const startEdit = (m: GroupMsg) => {
    setEditMsg(m);
    setEditText(editableText(m.content));
  };

  const saveEdit = async () => {
    if (!editMsg) return;
    const body = editText.trim();
    if (!body) { Alert.alert('Message cannot be empty'); return; }
    const content = withEditedText(editMsg.content, body);
    if (content === editMsg.content) { setEditMsg(null); return; } // nothing changed
    const target = editMsg;
    setSavingEdit(true);
    try {
      const res = await apiFetch<{ data: GroupMsg }>(`/api/groups/${id}/messages/${target.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ content }),
      });
      const editedAt = res.data?.edited_at ?? new Date().toISOString();
      setMessages(prev => prev.map(m => (
        m.id === target.id ? { ...m, content, edited_at: editedAt } : m
      )));
      setEditMsg(null);
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'The edit was not saved.');
    } finally {
      setSavingEdit(false);
    }
  };

  const openMessageMenu = (m: GroupMsg) => {
    const mine = m.sender_id === user?.id;
    const options: { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }[] = [
      { text: 'Forward', onPress: () => setForwardMsg(m) },
    ];
    if (m.content) options.push({ text: 'Copy', onPress: () => Clipboard.setString(plainText(m.content)) });
    // Only where there is text of the sender's own to change — shared-post
    // cards and image-only messages have none.
    if (mine && !m.is_deleted && editableText(m.content)) {
      options.push({ text: 'Edit', onPress: () => startEdit(m) });
    }
    if (mine) options.push({ text: 'Delete', style: 'destructive', onPress: () => deleteMessage(m) });
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Message', undefined, options);
  };

  useEffect(() => {
    if (!forwardMsg) return;
    setForwardedTo(new Set());
    apiFetch<{ conversations: { id: number; other_user_name: string; other_user_id: number }[] }>('/api/messages/conversations')
      .then(d => setForwardConvos(d.conversations || []))
      .catch(() => setForwardConvos([]));
  }, [forwardMsg]);

  const forwardToConversation = async (conversationId: number) => {
    if (!forwardMsg || forwardingTo !== null) return;
    setForwardingTo(conversationId);
    try {
      await apiFetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          conversation_id: conversationId,
          content: plainText(forwardMsg.content),
          image_url: forwardMsg.image_url ?? undefined,
        }),
      });
      setForwardedTo(prev => new Set([...prev, conversationId]));
    } catch (err) {
      Alert.alert('Could not forward', err instanceof Error ? err.message : '');
    } finally {
      setForwardingTo(null);
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
            onContentSizeChange={() => {
              if (pinScrollRef.current) return; // prepending older history — stay put
              listRef.current?.scrollToEnd({ animated: false });
            }}
            ListHeaderComponent={
              hasMoreOlder ? (
                <TouchableOpacity style={s.loadOlderBtn} onPress={loadOlder} disabled={loadingOlder} activeOpacity={0.7}>
                  {loadingOlder
                    ? <ActivityIndicator size="small" color={colors.brand} />
                    : <Text style={s.loadOlderText}>Load earlier messages</Text>}
                </TouchableOpacity>
              ) : null
            }
            renderItem={({ item }) => {
              const mine = item.sender_id === user?.id;
              const isDeleted = !!item.is_deleted;
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
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onLongPress={isDeleted ? undefined : () => openMessageMenu(item)}
                    delayLongPress={250}
                    style={[s.bubble, mine ? s.mine : s.theirs]}
                  >
                    {!mine ? <Text style={s.senderName}>{item.sender_name}</Text> : null}
                    {isDeleted ? (
                      <Text style={[s.deletedText, mine ? s.deletedTextMine : null]}>This message was deleted</Text>
                    ) : (
                      <>
                        {item.image_url ? (
                          <Image source={{ uri: item.image_url }} style={s.msgImage} resizeMode="contain" />
                        ) : null}
                        {item.content ? (
                          <MessageBody content={item.content} mine={mine} />
                        ) : null}
                        {item.edited_at ? (
                          <Text style={[s.editedTag, mine ? s.editedTagMine : null]}>edited</Text>
                        ) : null}
                      </>
                    )}
                  </TouchableOpacity>
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

      {/* Edit sheet */}
      <Modal visible={editMsg !== null} animationType="slide" transparent onRequestClose={() => setEditMsg(null)}>
        <View style={s.fwdBackdrop}>
          <View style={s.fwdSheet}>
            <View style={s.fwdHeader}>
              <Text style={s.fwdTitle}>Edit message</Text>
              <TouchableOpacity onPress={() => setEditMsg(null)} hitSlop={12}><Text style={s.fwdClose}>✕</Text></TouchableOpacity>
            </View>
            <TextInput
              style={s.editInput}
              value={editText}
              onChangeText={setEditText}
              placeholder="Message..."
              placeholderTextColor={colors.muted}
              multiline
              autoFocus
              editable={!savingEdit}
            />
            <TouchableOpacity
              style={[s.editSave, (!editText.trim() || savingEdit) ? { opacity: 0.5 } : null]}
              onPress={saveEdit}
              disabled={!editText.trim() || savingEdit}
            >
              {savingEdit ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.editSaveText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Forward sheet */}
      <Modal visible={forwardMsg !== null} animationType="slide" transparent onRequestClose={() => setForwardMsg(null)}>
        <View style={s.fwdBackdrop}>
          <View style={s.fwdSheet}>
            <View style={s.fwdHeader}>
              <Text style={s.fwdTitle}>Forward to</Text>
              <TouchableOpacity onPress={() => setForwardMsg(null)} hitSlop={12}><Text style={s.fwdClose}>✕</Text></TouchableOpacity>
            </View>
            <FlatList
              data={forwardConvos}
              keyExtractor={c => String(c.id)}
              style={{ maxHeight: 360 }}
              ListEmptyComponent={<Text style={s.fwdEmpty}>No conversations yet.</Text>}
              renderItem={({ item }) => {
                const done = forwardedTo.has(item.id);
                return (
                  <View style={s.fwdRow}>
                    <View style={s.fwdAvatar}><Text style={s.fwdInit}>{item.other_user_name.charAt(0)}</Text></View>
                    <Text style={s.fwdName} numberOfLines={1}>{item.other_user_name}</Text>
                    <TouchableOpacity
                      style={[s.fwdBtn, done ? s.fwdBtnDone : null]}
                      onPress={() => forwardToConversation(item.id)}
                      disabled={done || forwardingTo === item.id}
                    >
                      {forwardingTo === item.id
                        ? <ActivityIndicator size="small" />
                        : <Text style={done ? s.fwdBtnDoneText : s.fwdBtnText}>{done ? 'Sent' : 'Send'}</Text>}
                    </TouchableOpacity>
                  </View>
                );
              }}
            />
          </View>
        </View>
      </Modal>
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
  // Same bug as chat/[id].tsx had before 031455d: a hardcoded background that
  // never changed with theme, paired with theme-reactive text that turns
  // near-white in dark mode. Never actually fixed here even though it's the
  // same screen shape -- found while fixing the deleted-message gap below.
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surfaceSubtle },
  senderName: { fontSize: 12, fontWeight: '700', color: colors.brand, marginBottom: 2 },
  mineText: { color: '#fff', fontSize: 15 },
  theirsText: { color: colors.text, fontSize: 15 },
  editedTag: { fontSize: 11, color: colors.muted, marginTop: 2 },
  editedTagMine: { color: 'rgba(255,255,255,0.75)' },
  editInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, color: colors.text,
    fontSize: 15, minHeight: 80, maxHeight: 180, textAlignVertical: 'top',
  },
  editSave: { marginTop: 14, backgroundColor: colors.brand, borderRadius: 20, paddingVertical: 12, alignItems: 'center' },
  editSaveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  deletedText: { fontSize: 15, fontStyle: 'italic', color: colors.muted },
  deletedTextMine: { color: 'rgba(255,255,255,0.85)' },
  loadOlderBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12, marginBottom: 4 },
  loadOlderText: { fontSize: 13, fontWeight: '700', color: colors.brand },
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
  fwdBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  fwdSheet: { backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  fwdHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  fwdTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  fwdClose: { fontSize: 20, color: colors.muted },
  fwdEmpty: { textAlign: 'center', color: colors.muted, marginTop: 24, fontSize: 14 },
  fwdRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  fwdAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  fwdInit: { color: '#fff', fontWeight: '700', fontSize: 16 },
  fwdName: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  fwdBtn: { borderWidth: 1, borderColor: colors.brand, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 7 },
  fwdBtnText: { color: colors.brand, fontWeight: '700', fontSize: 14 },
  fwdBtnDone: { borderColor: colors.border },
  fwdBtnDoneText: { color: colors.muted, fontWeight: '700', fontSize: 14 },
});
