import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, FlatList,
  ActivityIndicator, Image, Alert, Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles } from '../theme/ThemeContext';
import type { Palette } from '../theme';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface Follower {
  id: number;
  full_name: string;
  profile_photo_url: string | null;
}

interface SharePost {
  id: number;
  author_name: string;
  content: string | null;
  image_url: string | null;
}

/**
 * Share sheet — mirrors web: copy the post link, or send the post to a follower
 * as a DM (shared_post message). Follower list from /api/follows/:id/following.
 */
export function ShareSheet({ post, onClose }: { post: SharePost | null; onClose: () => void }) {
  const s = useThemedStyles(make_s);
  const { user } = useAuth();
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [sentIds, setSentIds] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!post || !user) return;
    setQuery(''); setSentIds(new Set()); setCopied(false);
    setLoading(true);
    apiFetch<{ following: Follower[] }>(`/api/follows/${user.id}/following`)
      .then(d => setFollowers(d.following || []))
      .catch(() => setFollowers([]))
      .finally(() => setLoading(false));
  }, [post, user]);

  const copyLink = () => {
    if (!post) return;
    Clipboard.setString(`https://abukonn.com/feed#post-${post.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareToUser = async (recipientId: number) => {
    if (!post || sendingId !== null) return;
    setSendingId(recipientId);
    try {
      const { conversation } = await apiFetch<{ conversation: { id: number } }>('/api/messages/start', {
        method: 'POST',
        body: JSON.stringify({ recipient_id: recipientId }),
      });
      const content = JSON.stringify({
        type: 'shared_post',
        post_id: post.id,
        author_name: post.author_name,
        content: post.content,
        image_url: post.image_url ?? null,
      });
      await apiFetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify({ conversation_id: conversation.id, content }),
      });
      setSentIds(prev => new Set([...prev, recipientId]));
    } catch (err) {
      Alert.alert('Could not share', err instanceof Error ? err.message : '');
    } finally {
      setSendingId(null);
    }
  };

  const filtered = followers.filter(f => f.full_name.toLowerCase().includes(query.toLowerCase()));

  return (
    <Modal visible={post !== null} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.header}>
            <Text style={s.title}>Share</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}><Text style={s.close}>✕</Text></TouchableOpacity>
          </View>

          <TouchableOpacity style={s.copyRow} onPress={copyLink}>
            <Ionicons name={copied ? 'checkmark-circle' : 'link-outline'} size={22} color={copied ? '#22c55e' : undefined} />
            <Text style={s.copyText}>{copied ? 'Link copied!' : 'Copy link'}</Text>
          </TouchableOpacity>

          <TextInput
            style={s.search}
            placeholder="Search people you follow"
            value={query}
            onChangeText={setQuery}
          />

          {loading ? (
            <ActivityIndicator style={{ marginTop: 24 }} />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={i => String(i.id)}
              style={{ maxHeight: 320 }}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={s.empty}>No one to share with yet.</Text>}
              renderItem={({ item }) => {
                const sent = sentIds.has(item.id);
                return (
                  <View style={s.personRow}>
                    {item.profile_photo_url
                      ? <Image source={{ uri: item.profile_photo_url }} style={s.avatar} />
                      : <View style={[s.avatar, s.avatarStub]}><Text style={s.avatarInit}>{item.full_name.charAt(0)}</Text></View>}
                    <Text style={s.personName} numberOfLines={1}>{item.full_name}</Text>
                    <TouchableOpacity
                      style={[s.sendBtn, sent ? s.sentBtn : null]}
                      onPress={() => shareToUser(item.id)}
                      disabled={sent || sendingId === item.id}
                    >
                      {sendingId === item.id
                        ? <ActivityIndicator size="small" />
                        : <Text style={sent ? s.sentText : s.sendText}>{sent ? 'Sent' : 'Send'}</Text>}
                    </TouchableOpacity>
                  </View>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const make_s = (colors: Palette) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  close: { fontSize: 20, color: colors.muted },
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  copyText: { fontSize: 15, fontWeight: '600', color: colors.text },
  search: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: colors.text, marginTop: 14, marginBottom: 8 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.border },
  avatarStub: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  avatarInit: { color: '#fff', fontWeight: '700', fontSize: 16 },
  personName: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  sendBtn: { borderWidth: 1, borderColor: colors.brand, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 7 },
  sendText: { color: colors.brand, fontWeight: '700', fontSize: 14 },
  sentBtn: { borderColor: colors.border },
  sentText: { color: colors.muted, fontWeight: '700', fontSize: 14 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 24, fontSize: 14 },
});
