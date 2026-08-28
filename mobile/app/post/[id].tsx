import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Image, FlatList,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Linking, Modal,
} from 'react-native';
import { MediaCarousel } from '../../src/components/MediaCarousel';
import { useThemedStyles } from '../../src/theme/ThemeContext';
import type { Palette } from '../../src/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../src/lib/api';
import { PostContent } from '../../src/components/PostContent';
import { ShareSheet } from '../../src/components/ShareSheet';
import { ReportModal, type ReportTarget } from '../../src/components/ReportModal';
import { useAuth } from '../../src/context/AuthContext';
import { colors } from '../../src/theme';

const CATEGORY_CHIP: Record<string, { bg: string; fg: string; label: string }> = {
  EXAMINATION:  { bg: 'rgba(239,68,68,0.12)',  fg: '#dc2626', label: 'Examination' },
  REGISTRATION: { bg: 'rgba(249,115,22,0.12)', fg: '#ea580c', label: 'Registration' },
  ACADEMIC:     { bg: 'rgba(59,130,246,0.12)', fg: '#2563eb', label: 'Academic' },
  SPORTS:       { bg: 'rgba(234,179,8,0.12)',  fg: '#a16207', label: 'Sports' },
  EVENTS:       { bg: 'rgba(168,85,247,0.12)', fg: '#9333ea', label: 'Events' },
  CAMPUS_LIFE:  { bg: 'rgba(22,163,74,0.12)',  fg: '#16a34a', label: 'Campus Life' },
};

interface PollOption { id: number; option_text: string; vote_count: number }
interface Post {
  id: number; user_id: number; content: string; image_url: string | null;
  edited_at?: string | null;
  media?: Array<{ id: number; media_url: string; media_type: 'image' | 'video'; thumbnail_url: string | null; duration_seconds: number | null; position: number }>;
  author_name: string; author_department: string | null; author_photo: string | null;
  author_is_verified?: boolean; author_is_content_creator?: boolean;
  likes_count: number; comments_count: number; reposts_count?: number;
  is_liked: boolean; is_reposted?: boolean; created_at: string;
  discussion_title?: string | null; post_subtype?: string; category?: string;
  poll_options?: PollOption[] | null; voted_option_id?: number | null; poll_ends_at?: string | null;
  event_title?: string | null; event_date?: string | null; event_location?: string | null;
  event_rsvp_count?: number; is_attending?: boolean;
  is_repost?: boolean; original_author_name?: string | null;
  original_author_full_name?: string | null; original_author_photo?: string | null; original_author_id?: number | null;
  original_likes_count?: number; original_comments_count?: number; original_repost_count?: number;
}
interface Comment { id: number; user_id?: number; content: string; author_name: string; created_at: string; reply_count?: number; likes_count?: number; is_liked?: boolean }
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
  const { user } = useAuth();
  const currentUserId = user?.id;

  const [post, setPost] = useState<Post | null>(null);
  // Edit-after-publish (modal, matching the feed).
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  // Threaded replies: which comment is expanded, its loaded replies, and the
  // comment currently being replied to.
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [repliesByComment, setRepliesByComment] = useState<Record<number, Reply[]>>({});
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

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
    // Reposts display original_likes_count, not their own -- same pattern as
    // feed.tsx. Server write is redirected to the original either way.
    const bump = (p: Post, dir: number): Post =>
      p.is_repost && p.original_likes_count !== undefined
        ? { ...p, original_likes_count: p.original_likes_count + dir }
        : { ...p, likes_count: p.likes_count + dir };
    setPost({ ...bump(post, was ? -1 : 1), is_liked: !was });
    try {
      const res = await apiFetch<{ is_liked: boolean; post: Post }>(`/api/posts/${post.id}/like`, { method: 'POST' });
      // res.post is the canonical (original) post -- authoritative count.
      setPost(p => {
        if (!p) return p;
        if (p.is_repost && p.original_likes_count !== undefined) {
          return { ...p, is_liked: res.is_liked, original_likes_count: res.post.likes_count };
        }
        return { ...p, is_liked: res.is_liked, likes_count: res.post.likes_count };
      });
    } catch {
      setPost(p => p ? { ...bump(p, was ? 1 : -1), is_liked: was } : p);
    }
  };

  const startEdit = () => { if (post) { setEditDraft(post.content || ''); setEditing(true); } };
  const saveEdit = async () => {
    if (!post) return;
    const content = editDraft.trim();
    if (!content) { Alert.alert('Empty post', 'Post text cannot be empty.'); return; }
    setEditSaving(true);
    try {
      await apiFetch(`/api/posts/${post.id}`, { method: 'PUT', body: JSON.stringify({ content }) });
      setPost(p => p ? { ...p, content, edited_at: new Date().toISOString() } : p);
      setEditing(false);
      setEditDraft('');
    } catch (err) {
      Alert.alert('Could not edit', err instanceof Error ? err.message : '');
    } finally {
      setEditSaving(false);
    }
  };

  // post/[id].tsx previously had no way to delete the post it's showing --
  // only the inline "Edit post" link existed here, so anyone who reached a
  // post via this detail page (notification tap, shared link, the feed
  // comment-modal's "open" icon, search/hashtag results) had no delete
  // option even though feed.tsx's own post menu has always had one. Mirrors
  // web's post-detail "Delete post" (handleDelete) including navigating
  // away afterward, since the post being shown no longer exists.
  const deletePost = () => {
    if (!post) return;
    Alert.alert('Delete post', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/api/posts/${post.id}`, { method: 'DELETE' });
            // Feed's tab screen stays mounted (React Navigation keeps tabs
            // alive for instant switching) and only reloads its post list on
            // mount or explicit refresh -- not on focus -- so without this,
            // the just-deleted post stayed visible until a manual
            // pull-to-refresh. Pass the id so Feed can remove it locally
            // instead of a full refetch (would undo the query-cost work).
            router.replace({ pathname: '/(tabs)/feed', params: { deletedPostId: String(post.id) } });
          } catch (err) {
            Alert.alert('Could not delete', err instanceof Error ? err.message : '');
          }
        },
      },
    ]);
  };

  const repost = async () => {
    if (!post || post.is_reposted) return;
    setPost(p => p ? { ...p, is_reposted: true, reposts_count: (p.reposts_count ?? 0) + 1 } : p);
    try {
      await apiFetch(`/api/posts/${post.id}/repost`, { method: 'POST' });
    } catch {
      setPost(p => p ? { ...p, is_reposted: false, reposts_count: Math.max(0, (p.reposts_count ?? 1) - 1) } : p);
    }
  };

  const voteOnPoll = async (optionId: number) => {
    if (!post || post.voted_option_id) return;
    try {
      await apiFetch(`/api/posts/${post.id}/vote`, { method: 'POST', body: JSON.stringify({ option_id: optionId }) });
      setPost(p => p ? {
        ...p,
        voted_option_id: optionId,
        poll_options: p.poll_options?.map(o => o.id === optionId ? { ...o, vote_count: o.vote_count + 1 } : o) ?? null,
      } : p);
    } catch { /* ignore */ }
  };

  const toggleRSVP = async () => {
    if (!post) return;
    try {
      const res = await apiFetch<{ attending: boolean }>(`/api/posts/${post.id}/rsvp`, { method: 'POST' });
      setPost(p => p ? {
        ...p,
        is_attending: res.attending,
        event_rsvp_count: (p.event_rsvp_count ?? 0) + (res.attending ? 1 : -1),
      } : p);
    } catch { /* ignore */ }
  };

  const renderPoll = () => {
    if (post?.post_subtype !== 'poll' || !post.poll_options) return null;
    const total = post.poll_options.reduce((s, o) => s + o.vote_count, 0);
    const voted = post.voted_option_id != null;
    const ended = post.poll_ends_at ? new Date(post.poll_ends_at).getTime() < Date.now() : false;
    return (
      <View style={s.poll}>
        {post.poll_options.map(o => {
          const pct = total > 0 ? Math.round((o.vote_count / total) * 100) : 0;
          const mine = post.voted_option_id === o.id;
          return (
            <TouchableOpacity key={o.id} style={s.pollOpt} disabled={voted || ended} onPress={() => voteOnPoll(o.id)} activeOpacity={0.7}>
              {(voted || ended) ? <View style={[s.pollBar, { width: `${pct}%` }, mine ? s.pollBarMine : null]} /> : null}
              <View style={s.pollOptInner}>
                <Text style={[s.pollOptText, mine ? s.pollOptTextMine : null]} numberOfLines={2}>{o.option_text}</Text>
                {(voted || ended) ? <Text style={s.pollPct}>{pct}%</Text> : null}
              </View>
            </TouchableOpacity>
          );
        })}
        <Text style={s.pollMeta}>{total} {total === 1 ? 'vote' : 'votes'}{ended ? ' · Ended' : ''}</Text>
      </View>
    );
  };

  const renderEvent = () => {
    if (post?.post_subtype !== 'event' || !post.event_title) return null;
    return (
      <View style={s.event}>
        <Text style={s.eventTitle}>{post.event_title}</Text>
        {post.event_date ? <Text style={s.eventMeta}>📅 {new Date(post.event_date).toLocaleString()}</Text> : null}
        {post.event_location ? <Text style={s.eventMeta}>📍 {post.event_location}</Text> : null}
        <View style={s.eventFooter}>
          <TouchableOpacity style={[s.rsvpBtn, post.is_attending ? s.rsvpBtnOn : null]} onPress={toggleRSVP}>
            <Text style={[s.rsvpText, post.is_attending ? s.rsvpTextOn : null]}>{post.is_attending ? '✓ Going' : 'RSVP'}</Text>
          </TouchableOpacity>
          <Text style={s.eventMeta}>{post.event_rsvp_count ?? 0} going</Text>
        </View>
      </View>
    );
  };

  const likeComment = async (commentId: number) => {
    setComments(prev => prev.map(c => c.id === commentId
      ? { ...c, is_liked: !c.is_liked, likes_count: (c.likes_count ?? 0) + (c.is_liked ? -1 : 1) }
      : c));
    try {
      await apiFetch(`/api/posts/${id}/comments/${commentId}/like`, { method: 'POST' });
    } catch {
      setComments(prev => prev.map(c => c.id === commentId
        ? { ...c, is_liked: !c.is_liked, likes_count: (c.likes_count ?? 0) + (c.is_liked ? 1 : -1) }
        : c));
    }
  };

  const deleteComment = (commentId: number) => {
    Alert.alert('Delete comment', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setComments(prev => prev.filter(c => c.id !== commentId));
          setPost(p => {
            if (!p) return p;
            if (p.is_repost && p.original_comments_count !== undefined) {
              return { ...p, original_comments_count: Math.max(0, p.original_comments_count - 1) };
            }
            return { ...p, comments_count: Math.max(0, p.comments_count - 1) };
          });
          try {
            await apiFetch(`/api/posts/${id}/comments/${commentId}`, { method: 'DELETE' });
          } catch {
            load(); // restore on failure
          }
        },
      },
    ]);
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
      setPost(p => {
        if (!p) return p;
        if (p.is_repost && p.original_comments_count !== undefined) {
          return { ...p, original_comments_count: p.original_comments_count + 1 };
        }
        return { ...p, comments_count: p.comments_count + 1 };
      });
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
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
          <FlatList
            data={comments}
            keyExtractor={c => String(c.id)}
            ListHeaderComponent={
              <View style={s.postCard}>
                {post.is_repost ? (
                  <View style={s.repostBanner}>
                    <Ionicons name="repeat" size={14} color={colors.textSecondary} />
                    <Text style={s.repostBannerText}>{post.author_name} reposted</Text>
                  </View>
                ) : null}
                <View style={s.authorRow}>
                  {(() => {
                    const dPhoto = post.is_repost && post.original_author_photo ? post.original_author_photo : post.author_photo;
                    const dName = post.is_repost && post.original_author_full_name ? post.original_author_full_name : post.author_name;
                    return dPhoto ? (
                      <Image source={{ uri: dPhoto }} style={s.avatar} />
                    ) : (
                      <View style={[s.avatar, s.fallback]}><Text style={s.letter}>{dName?.charAt(0).toUpperCase()}</Text></View>
                    );
                  })()}
                  <View style={{ flex: 1 }}>
                    <View style={s.nameRow}>
                      <Text style={s.author} numberOfLines={1}>
                        {post.is_repost && post.original_author_full_name ? post.original_author_full_name : post.author_name}
                      </Text>
                      {post.author_is_verified ? <Ionicons name="checkmark-circle" size={15} color="#3b82f6" style={{ marginLeft: 3 }} /> : null}
                      {post.author_is_content_creator ? <View style={s.creatorBadge}><Text style={s.creatorBadgeText}>✎</Text></View> : null}
                      {post.category && post.category !== 'GENERAL' && CATEGORY_CHIP[post.category] ? (
                        <View style={[s.catChip, { backgroundColor: CATEGORY_CHIP[post.category].bg }]}>
                          <Text style={[s.catChipText, { color: CATEGORY_CHIP[post.category].fg }]}>{CATEGORY_CHIP[post.category].label}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={s.muted}>{post.author_department} · {timeAgo(post.created_at)}</Text>
                  </View>
                </View>
                {post.discussion_title ? <Text style={s.postTitle}>{post.discussion_title}</Text> : null}
                {post.content ? <PostContent content={post.content} style={s.content} /> : null}
                {post.edited_at ? <Text style={s.editedTag}>edited</Text> : null}
                {post.user_id === currentUserId ? (
                  <View style={s.ownPostLinks}>
                    <TouchableOpacity onPress={startEdit} style={s.editLink}>
                      <Text style={s.editLinkText}>Edit post</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={deletePost} style={s.editLink}>
                      <Text style={s.deletePostLinkText}>Delete post</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                {post.media && post.media.length > 0 ? (
                  <MediaCarousel items={post.media} onOpenImage={(url) => Linking.openURL(url)} />
                ) : post.image_url ? <Image source={{ uri: post.image_url }} style={s.image} resizeMode="contain" /> : null}
                {renderPoll()}
                {renderEvent()}
                <View style={s.actions}>
                  <TouchableOpacity style={s.action} onPress={toggleLike}>
                    <Ionicons name={post.is_liked ? 'heart' : 'heart-outline'} size={20} color={post.is_liked ? colors.danger : colors.textSecondary} />
                    <Text style={s.actionText}>{post.is_repost && post.original_likes_count !== undefined ? post.original_likes_count : post.likes_count}</Text>
                  </TouchableOpacity>
                  <View style={s.action}>
                    <Ionicons name="chatbubble-outline" size={19} color={colors.textSecondary} />
                    <Text style={s.actionText}>{post.is_repost && post.original_comments_count !== undefined ? post.original_comments_count : post.comments_count}</Text>
                  </View>
                  <TouchableOpacity style={s.action} onPress={repost}>
                    <Ionicons name="repeat-outline" size={20} color={post.is_reposted ? colors.brand : colors.textSecondary} />
                    {(() => {
                      const r = post.is_repost && post.original_repost_count !== undefined ? post.original_repost_count : post.reposts_count;
                      return r ? <Text style={[s.actionText, post.is_reposted ? { color: colors.brand } : null]}>{r}</Text> : null;
                    })()}
                  </TouchableOpacity>
                  <TouchableOpacity style={s.action} onPress={() => setShareOpen(true)}>
                    <Ionicons name="paper-plane-outline" size={19} color={colors.textSecondary} />
                  </TouchableOpacity>
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
                  <TouchableOpacity style={s.commentLikeBtn} onPress={() => likeComment(item.id)}>
                    <Ionicons name={item.is_liked ? 'heart' : 'heart-outline'} size={14} color={item.is_liked ? colors.danger : colors.textSecondary} />
                    {item.likes_count ? <Text style={[s.commentLikeCount, item.is_liked ? { color: colors.danger } : null]}>{item.likes_count}</Text> : null}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setReplyingTo(replyingTo === item.id ? null : item.id); setReplyText(''); }}>
                    <Text style={s.replyAction}>Reply</Text>
                  </TouchableOpacity>
                  {item.user_id === currentUserId ? (
                    <TouchableOpacity onPress={() => deleteComment(item.id)}>
                      <Text style={s.deleteAction}>Delete</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={() => setReportTarget({ type: 'comment', id: item.id, name: item.author_name })}>
                      <Text style={s.deleteAction}>Report</Text>
                    </TouchableOpacity>
                  )}
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
      {post ? (
        <ShareSheet
          post={shareOpen ? { id: post.id, author_name: post.author_name, content: post.content, image_url: post.image_url } : null}
          onClose={() => setShareOpen(false)}
        />
      ) : null}
      <ReportModal target={reportTarget} onClose={() => setReportTarget(null)} />
      <Modal visible={editing} transparent animationType="slide" onRequestClose={() => setEditing(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.editBackdrop}>
          <View style={s.editSheet}>
            <View style={s.editHeader}>
              <TouchableOpacity onPress={() => { setEditing(false); setEditDraft(''); }} disabled={editSaving}>
                <Text style={s.editCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={s.editTitle}>Edit post</Text>
              <TouchableOpacity onPress={saveEdit} disabled={editSaving || !editDraft.trim()}>
                <Text style={[s.editSave, (editSaving || !editDraft.trim()) && s.editSaveDisabled]}>
                  {editSaving ? 'Saving…' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={s.editInput}
              value={editDraft}
              onChangeText={setEditDraft}
              multiline
              autoFocus
              placeholder="What's on your mind?"
              placeholderTextColor={colors.muted}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const make_s = (colors: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  editedTag: { fontSize: 12, color: colors.textSecondary, marginTop: 2, fontStyle: 'italic' },
  ownPostLinks: { flexDirection: 'row', gap: 16 },
  editLink: { marginTop: 6, alignSelf: 'flex-start' },
  editLinkText: { fontSize: 13, fontWeight: '600', color: colors.brand },
  deletePostLinkText: { fontSize: 13, fontWeight: '600', color: colors.danger },
  editBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  editSheet: { backgroundColor: colors.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingBottom: 24, minHeight: 240 },
  editHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  editTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  editCancel: { fontSize: 15, color: colors.textSecondary },
  editSave: { fontSize: 15, fontWeight: '700', color: colors.brand },
  editSaveDisabled: { opacity: 0.4 },
  editInput: { paddingHorizontal: 16, paddingTop: 14, fontSize: 16, color: colors.text, minHeight: 140, textAlignVertical: 'top' },
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
  author: { fontSize: 15, fontWeight: '700', color: colors.text, flexShrink: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  creatorBadge: { marginLeft: 4, width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(217,119,6,0.15)', alignItems: 'center', justifyContent: 'center' },
  creatorBadgeText: { fontSize: 10, color: '#d97706', fontWeight: '800' },
  catChip: { marginLeft: 6, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  catChipText: { fontSize: 10, fontWeight: '700' },
  repostBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  repostBannerText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  poll: { marginTop: 12, gap: 8 },
  pollOpt: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden', justifyContent: 'center', minHeight: 44 },
  pollBar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.surface },
  pollBarMine: { backgroundColor: 'rgba(22,163,74,0.18)' },
  pollOptInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 11 },
  pollOptText: { fontSize: 14, color: colors.text, flex: 1 },
  pollOptTextMine: { fontWeight: '700' },
  pollPct: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginLeft: 8 },
  pollMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  event: { marginTop: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, gap: 6 },
  eventTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  eventMeta: { fontSize: 13, color: colors.textSecondary },
  eventFooter: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  rsvpBtn: { borderWidth: 1, borderColor: colors.brand, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 7 },
  rsvpBtnOn: { backgroundColor: colors.brand },
  rsvpText: { color: colors.brand, fontWeight: '700', fontSize: 14 },
  rsvpTextOn: { color: '#fff' },
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
  commentLikeBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  commentLikeCount: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  deleteAction: { fontSize: 12, fontWeight: '700', color: colors.danger, marginTop: 4 },
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
