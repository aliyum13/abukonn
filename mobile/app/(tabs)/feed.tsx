import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, Image,
  TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '../../src/lib/upload';
import { apiFetch, API_URL } from '../../src/lib/api';
import { getToken } from '../../src/lib/storage';
import { colors } from '../../src/theme';
import { StoryBar } from '../../src/components/Stories';

interface Post {
  id: number;
  user_id: number;
  content: string;
  image_url: string | null;
  author_name: string;
  author_department: string | null;
  author_photo: string | null;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  created_at: string;
  post_subtype?: string | null;
  discussion_title?: string | null;
}

interface Comment {
  id: number;
  content: string;
  author_name: string;
  created_at: string;
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function Feed() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [composeOpen, setComposeOpen] = useState(false);
  const [newPost, setNewPost] = useState('');
  const [newImage, setNewImage] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const [commentsFor, setCommentsFor] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ posts: Post[] }>('/api/posts');
      setPosts(data.posts || []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load posts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Optimistic: flip immediately, roll back if the server disagrees.
  const toggleLike = async (post: Post) => {
    const was = post.is_liked;
    setPosts(prev => prev.map(p => p.id === post.id
      ? { ...p, is_liked: !was, likes_count: p.likes_count + (was ? -1 : 1) } : p));
    try {
      const res = await apiFetch<{ is_liked: boolean; post: Post }>(
        `/api/posts/${post.id}/like`, { method: 'POST' });
      setPosts(prev => prev.map(p => p.id === post.id
        ? { ...p, is_liked: res.is_liked, likes_count: res.post.likes_count } : p));
    } catch {
      setPosts(prev => prev.map(p => p.id === post.id
        ? { ...p, is_liked: was, likes_count: p.likes_count + (was ? 1 : -1) } : p));
    }
  };

  const openComments = async (post: Post) => {
    setCommentsFor(post);
    setComments([]);
    setCommentsLoading(true);
    try {
      const data = await apiFetch<{ comments: Comment[] }>(`/api/posts/${post.id}/comments`);
      setComments(data.comments || []);
    } catch {
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  };

  const sendComment = async () => {
    if (!commentText.trim() || !commentsFor) return;
    const body = commentText.trim();
    setCommentText('');
    try {
      const res = await apiFetch<{ comment: Comment }>(
        `/api/posts/${commentsFor.id}/comments`,
        { method: 'POST', body: JSON.stringify({ content: body }) });
      setComments(prev => [...prev, res.comment]);
      setPosts(prev => prev.map(p => p.id === commentsFor.id
        ? { ...p, comments_count: p.comments_count + 1 } : p));
    } catch (err) {
      Alert.alert('Could not post comment', err instanceof Error ? err.message : '');
      setCommentText(body); // don't lose what they typed
    }
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to add an image.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) setNewImage(res.assets[0].uri);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow camera access to take a photo.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!res.canceled && res.assets[0]) setNewImage(res.assets[0].uri);
  };

  const submitPost = async () => {
    // An image on its own is a perfectly good post — don't require text.
    if (!newPost.trim() && !newImage) return;
    setPosting(true);
    try {
      // If there's a photo, upload it to Cloudinary FIRST and post only the URL.
      // Sending the file through the backend hangs on Railway's timeout — this is
      // exactly what web does, and why text posts worked but image posts didn't.
      let imageUrl: string | null = null;
      if (newImage) imageUrl = await uploadImage(newImage, 'abukonn/posts');

      await apiFetch('/api/posts', {
        method: 'POST',
        body: JSON.stringify({
          content: newPost.trim(),
          category: 'GENERAL',
          ...(imageUrl ? { image_url: imageUrl } : {}),
        }),
      });

      setNewPost('');
      setNewImage(null);
      setComposeOpen(false);
      load();
    } catch (err) {
      Alert.alert('Could not post', err instanceof Error ? err.message : '');
    } finally {
      setPosting(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.logo}>ABUkonn</Text>
        <TouchableOpacity style={s.newBtn} onPress={() => setComposeOpen(true)}>
          <Text style={s.newBtnText}>+ Post</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.brand} /></View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.error}>{error}</Text>
          <Text style={s.muted}>Pull down to retry</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={p => String(p.id)}
          ListHeaderComponent={<StoryBar />}
          refreshControl={
            <RefreshControl refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.brand} />
          }
          ListEmptyComponent={<View style={s.center}><Text style={s.muted}>No posts yet</Text></View>}
          renderItem={({ item }) => (
            <View style={s.card}>
              <TouchableOpacity
                style={s.row}
                activeOpacity={0.7}
                onPress={() => router.push({ pathname: '/user/[id]', params: { id: String(item.user_id) } })}
              >
                {item.author_photo ? (
                  <Image source={{ uri: item.author_photo }} style={s.avatar} />
                ) : (
                  <View style={[s.avatar, s.fallback]}>
                    <Text style={s.letter}>{item.author_name?.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.author}>{item.author_name}</Text>
                  <Text style={s.muted}>{item.author_department} · {timeAgo(item.created_at)}</Text>
                </View>
              </TouchableOpacity>

              {/* Questions keep their title in discussion_title, same as
                  discussions — rendering only 'discussion' is what made
                  title-only questions come out blank on the web. */}
              {(item.post_subtype === 'question' || item.post_subtype === 'discussion')
                && item.discussion_title ? (
                  <Text style={s.title}>{item.discussion_title}</Text>
                ) : null}

              {item.content ? <Text style={s.content}>{item.content}</Text> : null}
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={s.image} resizeMode="cover" />
              ) : null}

              <View style={s.actions}>
                <TouchableOpacity style={s.action} onPress={() => toggleLike(item)}>
                  <Text style={[s.actionText, item.is_liked ? s.liked : null]}>
                    {item.is_liked ? '♥' : '♡'}  {item.likes_count}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.action} onPress={() => openComments(item)}>
                  <Text style={s.actionText}>💬  {item.comments_count}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* Compose */}
      <Modal visible={composeOpen} animationType="slide" onRequestClose={() => setComposeOpen(false)}>
        <SafeAreaView style={s.safe} edges={['top']}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setComposeOpen(false)}>
                <Text style={s.muted}>Cancel</Text>
              </TouchableOpacity>
              <Text style={s.modalTitle}>New post</Text>
              <TouchableOpacity
                onPress={submitPost}
                disabled={posting || (!newPost.trim() && !newImage)}
              >
                {posting ? <ActivityIndicator color={colors.brand} />
                  : (
                    <Text style={[s.post, (!newPost.trim() && !newImage) ? { opacity: 0.4 } : null]}>
                      Post
                    </Text>
                  )}
              </TouchableOpacity>
            </View>

            <TextInput
              style={s.composeInput}
              placeholder="What's happening on campus?"
              placeholderTextColor={colors.muted}
              value={newPost}
              onChangeText={setNewPost}
              multiline
              autoFocus
            />

            {newImage ? (
              <View style={s.previewWrap}>
                <Image source={{ uri: newImage }} style={s.preview} resizeMode="cover" />
                <TouchableOpacity style={s.removeImg} onPress={() => setNewImage(null)}>
                  <Text style={s.removeImgText}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={s.composeTools}>
              <TouchableOpacity style={s.tool} onPress={pickImage}>
                <Text style={s.toolText}>🖼  Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.tool} onPress={takePhoto}>
                <Text style={s.toolText}>📷  Camera</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Comments */}
      <Modal visible={!!commentsFor} animationType="slide" onRequestClose={() => setCommentsFor(null)}>
        <SafeAreaView style={s.safe} edges={['top']}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setCommentsFor(null)}>
                <Text style={s.muted}>Close</Text>
              </TouchableOpacity>
              <Text style={s.modalTitle}>Comments</Text>
              <View style={{ width: 50 }} />
            </View>

            {commentsLoading ? (
              <View style={s.center}><ActivityIndicator color={colors.brand} /></View>
            ) : (
              <FlatList
                data={comments}
                keyExtractor={c => String(c.id)}
                ListEmptyComponent={<View style={s.center}><Text style={s.muted}>No comments yet</Text></View>}
                renderItem={({ item }) => (
                  <View style={s.commentRow}>
                    <Text style={s.author}>{item.author_name}</Text>
                    <Text style={s.content}>{item.content}</Text>
                    <Text style={s.muted}>{timeAgo(item.created_at)}</Text>
                  </View>
                )}
              />
            )}

            <View style={s.commentBar}>
              <TextInput
                style={s.commentInput}
                placeholder="Add a comment..."
                placeholderTextColor={colors.muted}
                value={commentText}
                onChangeText={setCommentText}
              />
              <TouchableOpacity onPress={sendComment} disabled={!commentText.trim()}>
                <Text style={[s.post, !commentText.trim() ? { opacity: 0.4 } : null]}>Send</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  logo: { fontSize: 20, fontWeight: '800', color: colors.brand },
  newBtn: { backgroundColor: colors.brand, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  newBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  error: { color: colors.danger, fontSize: 15, textAlign: 'center', marginBottom: 6 },
  muted: { color: colors.muted, fontSize: 12 },
  card: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  row: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#dcfce7' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  letter: { color: colors.brand, fontWeight: '700', fontSize: 15 },
  author: { fontSize: 14, fontWeight: '700', color: colors.text },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  content: { fontSize: 15, color: colors.text, lineHeight: 22 },
  image: { width: '100%', height: 220, borderRadius: 12, marginTop: 10, backgroundColor: '#f3f4f6' },
  actions: { flexDirection: 'row', gap: 24, marginTop: 12 },
  action: { paddingVertical: 4 },
  actionText: { fontSize: 14, color: colors.muted },
  liked: { color: colors.danger, fontWeight: '700' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  post: { color: colors.brand, fontWeight: '700', fontSize: 15 },
  composeInput: { flex: 1, padding: 16, fontSize: 16, color: colors.text, textAlignVertical: 'top' },
  previewWrap: { marginHorizontal: 16, marginBottom: 12 },
  preview: { width: '100%', height: 220, borderRadius: 12, backgroundColor: '#f3f4f6' },
  removeImg: {
    position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  removeImgText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  composeTools: {
    flexDirection: 'row', gap: 10, padding: 12,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  tool: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border,
  },
  toolText: { fontSize: 13, fontWeight: '600', color: colors.text },
  commentRow: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  commentBar: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderTopWidth: 1, borderTopColor: colors.border },
  commentInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: colors.text },
});
