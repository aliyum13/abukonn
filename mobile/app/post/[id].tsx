import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Image, FlatList,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useThemedStyles } from '../../src/theme/ThemeContext';
import type { Palette } from '../../src/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../src/lib/api';
import { PostContent } from '../../src/components/PostContent';
import { colors } from '../../src/theme';

interface Post {
  id: number; user_id: number; content: string; image_url: string | null;
  author_name: string; author_department: string | null; author_photo: string | null;
  likes_count: number; comments_count: number; is_liked: boolean; created_at: string;
  discussion_title?: string | null;
}
interface Comment { id: number; content: string; author_name: string; created_at: string; reply_count?: number }
interface Reply { id: number; content: string; author_name: string; created_at: string }

function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'now';
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}

export default function SinglePost() {
  const s = useThemedStyles(make_s);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  // Threaded replies: which comment is expanded, its loaded replies, and the
  // comment currently being replied to.
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [repliesByComment, setRepliesByComment] = useState<Record<number, Reply[]>>({});
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');

  const loadReplies = useCallback(async (commentId: number) => {
    try {
      const d = await apiFetch<{ replies: Reply[] }>(`/api/posts/${id}/comments/${commentId}/replies`);
      setRepliesByComment(prev => ({ ...prev, [commentId]: d.replies || [] }));
    } catch {
      setRepliesByComment(prev => ({ ...prev, [commentId]: [] }));
    }
  }, [id]);

  const toggleReplies = (commentId: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(commentId)) { next.delete(commentId); }
      else { next.add(commentId); if (!repliesByComment[commentId]) loadReplies(commentId); }
      return next;
    });
  };

  const sendReply = async (commentId: number) => {
    const body = replyText.trim();
    if (!body) return;
    setReplyText('');
    try {
      const res = await apiFetch<{ reply: Reply }>(`/api/posts/${id}/comments/${commentId}/replies`, {
        method: 'POST', body: JSON.stringify({ content: body }),
      });
      if (res.reply) {
        setRepliesByComment(prev => ({ ...prev, [commentId]: [...(prev[commentId] || []), res.reply] }));
        setComments(prev => prev.map(c => c.id === commentId ? { ...c, reply_count: (c.reply_count || 0) + 1 } : c));
        setExpanded(prev => new Set(prev).add(commentId));
      }
      setReplyingTo(null);
    } catch {
      setReplyText(body);
    }
  };

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([
        apiFetch<{ post: Post }>(`/api/posts/${id}`),
        apiFetch<{ comments: Comment[] }>(`/api/posts/${id}/comments`).catch(() => ({ comments: [] })),
      ]);
      setPost(p.post);
      setComments(c.comments || []);
    } catch {
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const toggleLike = async () => {
    if (!post) return;
    const was = post.is_liked;
    setPost({ ...post, is_liked: !was, likes_count: post.likes_count + (was ? -1 : 1) });
    try {
      const res = await apiFetch<{ is_liked: boolean; post: Post }>(`/api/posts/${post.id}/like`, { method: 'POST' });
      setPost(p => p ? { ...p, is_liked: res.is_liked, likes_count: res.post.likes_count } : p);
    } catch {
      setPost(p => p ? { ...p, is_liked: was, likes_count: p.likes_count + (was ? 1 : -1) } : p);
    }
  };

  const addComment = async () => {
    const body = text.trim();
    if (!body || !post) return;
    setText('');
    setSending(true);
    try {
      const res = await apiFetch<{ comment: Comment }>(`/api/posts/${post.id}/comments`, {
        method: 'POST', body: JSON.stringify({ content: body }),
      });
      if (res.comment) setComments(prev => [...prev, res.comment]);
      setPost(p => p ? { ...p, comments_count: p.comments_count + 1 } : p);
    } catch {
      setText(body);
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={{ width: 60 }}>
          <Text style={s.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Post</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.brand} /></View>
      ) : !post ? (
        <View style={s.center}><Text style={s.muted}>Post not found</Text></View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
          <FlatList
            data={comments}
            keyExtractor={c => String(c.id)}
            ListHeaderComponent={
              <View style={s.postCard}>
                <View style={s.authorRow}>
                  {post.author_photo ? (
                    <Image source={{ uri: post.author_photo }} style={s.avatar} />
                  ) : (
                    <View style={[s.avatar, s.fallback]}><Text style={s.letter}>{post.author_name?.charAt(0).toUpperCase()}</Text></View>
                  )}
                  <View>
                    <Text style={s.author}>{post.author_name}</Text>
                    <Text style={s.muted}>{post.author_department} · {timeAgo(post.created_at)}</Text>
                  </View>
                </View>
                {post.discussion_title ? <Text style={s.postTitle}>{post.discussion_title}</Text> : null}
                {post.content ? <PostContent content={post.content} style={s.content} /> : null}
                {post.image_url ? <Image source={{ uri: post.image_url }} style={s.image} resizeMode="contain" /> : null}
                <View style={s.actions}>
                  <TouchableOpacity style={s.action} onPress={toggleLike}>
                    <Ionicons name={post.is_liked ? 'heart' : 'heart-outline'} size={20} color={post.is_liked ? colors.danger : colors.textSecondary} />
                    <Text style={s.actionText}>{post.likes_count}</Text>
                  </TouchableOpacity>
                  <View style={s.action}>
                    <Ionicons name="chatbubble-outline" size={19} color={colors.textSecondary} />
                    <Text style={s.actionText}>{post.comments_count}</Text>
                  </View>
                </View>
                <Text style={s.commentsHeading}>Comments</Text>
              </View>
            }
            ListEmptyComponent={<View style={s.center}><Text style={s.muted}>No comments yet</Text></View>}
            renderItem={({ item }) => (
              <View style={s.comment}>
                <Text style={s.commentAuthor}>{item.author_name}</Text>
                <PostContent content={item.content} style={s.commentText} />
                <View style={s.commentActions}>
                  <Text style={s.commentTime}>{timeAgo(item.created_at)}</Text>
                  <TouchableOpacity onPress={() => { setReplyingTo(replyingTo === item.id ? null : item.id); setReplyText(''); }}>
                    <Text style={s.replyAction}>Reply</Text>
                  </TouchableOpacity>
                  {item.reply_count ? (
                    <TouchableOpacity onPress={() => toggleReplies(item.id)}>
                      <Text style={s.replyAction}>
                        {expanded.has(item.id) ? 'Hide' : 'View'} {item.reply_count} {item.reply_count === 1 ? 'reply' : 'replies'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Reply composer for this comment */}
                {replyingTo === item.id ? (
                  <View style={s.replyBox}>
                    <TextInput
                      style={s.replyInput}
                      value={replyText}
                      onChangeText={setReplyText}
                      placeholder={`Reply to ${item.author_name}...`}
                      placeholderTextColor={colors.muted}
                      autoFocus
                      multiline
                    />
                    <TouchableOpacity style={s.replySend} onPress={() => sendReply(item.id)} disabled={!replyText.trim()}>
                      <Ionicons name="send" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ) : null}

                {/* Nested replies */}
                {expanded.has(item.id) ? (
                  <View style={s.replyThread}>
                    {(repliesByComment[item.id] || []).map(r => (
                      <View key={r.id} style={s.reply}>
                        <Text style={s.commentAuthor}>{r.author_name}</Text>
                        <Text style={s.commentText}>{r.content}</Text>
                        <Text style={s.commentTime}>{timeAgo(r.created_at)}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            )}
          />
          <View style={s.inputBar}>
            <TextInput
              style={s.input}
              value={text}
              onChangeText={setText}
              placeholder="Add a comment..."
              placeholderTextColor={colors.muted}
              multiline
            />
            <TouchableOpacity style={s.sendBtn} onPress={addComment} disabled={sending || !text.trim()}>
              {sending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const make_s = (colors: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface,
  },
  backText: { color: colors.brand, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  center: { paddingVertical: 48, alignItems: 'center' },
  muted: { fontSize: 13, color: colors.muted },
  postCard: { backgroundColor: colors.surface, padding: 16, borderBottomWidth: 8, borderBottomColor: colors.bg },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brand100 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  letter: { fontSize: 18, fontWeight: '800', color: colors.brand },
  author: { fontSize: 15, fontWeight: '700', color: colors.text },
  postTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 6 },
  content: { fontSize: 15, color: colors.text, lineHeight: 22 },
  image: { width: '100%', height: 300, borderRadius: 12, marginTop: 10, backgroundColor: colors.surfaceSubtle },
  actions: { flexDirection: 'row', gap: 24, marginTop: 14 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontSize: 14, color: colors.textSecondary },
  commentsHeading: { fontSize: 14, fontWeight: '800', color: colors.textSecondary, marginTop: 18, textTransform: 'uppercase', letterSpacing: 0.5 },
  comment: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  commentAuthor: { fontSize: 14, fontWeight: '700', color: colors.text },
  commentText: { fontSize: 15, color: colors.text, marginTop: 2, lineHeight: 20 },
  commentTime: { fontSize: 12, color: colors.muted, marginTop: 4 },
  commentActions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  replyAction: { fontSize: 12, fontWeight: '700', color: colors.brand, marginTop: 4 },
  replyBox: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 10 },
  replyInput: {
    flex: 1, backgroundColor: colors.bg, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: colors.text, maxHeight: 90,
  },
  replySend: { backgroundColor: colors.brand, borderRadius: 16, width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  replyThread: { marginTop: 10, marginLeft: 16, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.border, gap: 12 },
  reply: {},
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface,
  },
  input: {
    flex: 1, backgroundColor: colors.bg, borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 9, fontSize: 15, color: colors.text, maxHeight: 100,
  },
  sendBtn: { backgroundColor: colors.brand, borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
