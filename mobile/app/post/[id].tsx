import { useEffect, useState, useCallback, useRef, memo } from 'react';
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
interface Comment { id: number; user_id?: number; content: string; author_name: string; created_at: string; reply_count?: number; likes_count?: number; is_liked?: boolean; edited_at?: string | null }
interface Reply { id: number; content: string; author_name: string; created_at: string }

function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'now';
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}

// -----------------------------------------------------------------------
// CommentRow / EditCommentSheet / NewCommentBar -- see feed.tsx's identical
// module comment for the full regression history (v1: Feed()-level typed
// text thrashed the whole comment list on every keystroke. v2, PR #13: moved
// typed text into local state with an inline autoFocus TextInput -- which
// regressed WORSE, because autoFocus inside a virtualized FlatList row races
// Android's view recycling and drops focus the instant the row reflows.
// Confirmed on-device: keyboard flashes open then closes, every time, on a
// never-edited comment, Android-only). v3 (this fix) gets the input OUT of
// the recycled row entirely, mirroring this screen's OWN already-safe "Edit
// post" Modal (editBackdrop/editSheet/editInput styles, below) for Edit, and
// the DM reply-preview-above-a-stable-bar pattern for Reply.
//
// CommentRow keeps memo + useCallback'd parent handlers (that part of PR #13
// was correct); it only sheds the two focus-fragile in-row TextInputs, and
// is simpler for it. WHICH comment is being edited/replied to still lives in
// SinglePost(), same as before -- CommentRow just no longer needs to know
// either one, since it renders no input at all any more.
interface CommentRowProps {
  item: Comment;
  currentUserId?: number;
  isExpanded: boolean;
  replies: Reply[];
  onStartEdit: (commentId: number) => void;
  onStartReply: (commentId: number) => void;
  onToggleReplies: (commentId: number) => void;
  onLike: (commentId: number) => void;
  onDelete: (commentId: number) => void;
  onReport: (commentId: number, authorName: string) => void;
}

const CommentRow = memo(function CommentRow({
  item, currentUserId, isExpanded, replies,
  onStartEdit, onStartReply, onToggleReplies,
  onLike, onDelete, onReport,
}: CommentRowProps) {
  const s = useThemedStyles(make_s);

  return (
    <View style={s.comment}>
      <Text style={s.commentAuthor}>{item.author_name}</Text>
      <PostContent content={item.content} style={s.commentText} />
      {item.edited_at ? <Text style={s.commentEditedTag}>edited</Text> : null}
      <View style={s.commentActions}>
        <Text style={s.commentTime}>{timeAgo(item.created_at)}</Text>
        <TouchableOpacity style={s.commentLikeBtn} onPress={() => onLike(item.id)}>
          <Ionicons name={item.is_liked ? 'heart' : 'heart-outline'} size={14} color={item.is_liked ? colors.danger : colors.textSecondary} />
          {item.likes_count ? <Text style={[s.commentLikeCount, item.is_liked ? { color: colors.danger } : null]}>{item.likes_count}</Text> : null}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onStartReply(item.id)}>
          <Text style={s.replyAction}>Reply</Text>
        </TouchableOpacity>
        {item.user_id === currentUserId ? (
          <TouchableOpacity onPress={() => onStartEdit(item.id)}>
            <Text style={s.replyAction}>Edit</Text>
          </TouchableOpacity>
        ) : null}
        {item.user_id === currentUserId ? (
          <TouchableOpacity onPress={() => onDelete(item.id)}>
            <Text style={s.deleteAction}>Delete</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => onReport(item.id, item.author_name)}>
            <Text style={s.deleteAction}>Report</Text>
          </TouchableOpacity>
        )}
        {item.reply_count ? (
          <TouchableOpacity onPress={() => onToggleReplies(item.id)}>
            <Text style={s.replyAction}>
              {isExpanded ? 'Hide' : 'View'} {item.reply_count} {item.reply_count === 1 ? 'reply' : 'replies'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Nested replies */}
      {isExpanded ? (
        <View style={s.replyThread}>
          {replies.map(r => (
            <View key={r.id} style={s.reply}>
              <Text style={s.commentAuthor}>{r.author_name}</Text>
              <Text style={s.commentText}>{r.content}</Text>
              <Text style={s.commentTime}>{timeAgo(r.created_at)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
});

// A single, shared edit-comment sheet, rendered once outside the comments
// FlatList. Copies this screen's own "Edit post" Modal (further below, in
// SinglePost()'s JSX) almost verbatim, reusing its editBackdrop/editSheet/
// editHeader/editCancel/editTitle/editSave/editSaveDisabled/editInput
// styles: that modal has never had the focus-drop problem, for the same
// reason this one won't -- it isn't inside a FlatList.
const EditCommentSheet = memo(function EditCommentSheet({ comment, onCancel, onSave }: {
  comment: Comment | null;
  onCancel: () => void;
  onSave: (commentId: number, text: string) => Promise<boolean>;
}) {
  const s = useThemedStyles(make_s);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  // Reseed whenever a DIFFERENT comment opens for editing (keyed on id, not
  // the object, so re-opening the SAME comment after Cancel still resets).
  useEffect(() => {
    if (comment) setText(comment.content);
  }, [comment?.id]);

  const handleSave = async () => {
    if (!comment) return;
    const trimmed = text.trim();
    if (!trimmed || trimmed === comment.content) { onCancel(); return; } // no-op guard
    setSaving(true);
    try {
      await onSave(comment.id, trimmed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={comment !== null} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.editBackdrop}>
        <View style={s.editSheet}>
          <View style={s.editHeader}>
            <TouchableOpacity onPress={onCancel} disabled={saving}>
              <Text style={s.editCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.editTitle}>Edit comment</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving || !text.trim()}>
              <Text style={[s.editSave, (saving || !text.trim()) && s.editSaveDisabled]}>
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={s.editInput}
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
            editable={!saving}
            placeholderTextColor={colors.muted}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

// The bottom "Add a comment" bar, now doubling as the reply composer. Own
// local state for the same reason as before -- it sits OUTSIDE the FlatList,
// never part of the recycling bug, and stays that way with reply mode folded
// in. When replyingTo is set, a small "Replying to X" strip appears above
// the input and Send routes to the reply instead of a new comment -- the
// PARENT decides that routing (handleComposerSubmit in SinglePost()); this
// bar stays unaware of "modes".
//
// autoFocus won't refire here for reply mode: this bar is always mounted,
// never remounted, and autoFocus only fires on mount. inputRef.focus()
// replaces it -- an ordinary imperative call, safe specifically because this
// is not a FlatList row and there is no recycling to race against.
const NewCommentBar = memo(function NewCommentBar({ onSubmit, replyingTo, onCancelReply }: {
  onSubmit: (text: string) => Promise<boolean>;
  replyingTo: { id: number; authorName: string } | null;
  onCancelReply: () => void;
}) {
  const s = useThemedStyles(make_s);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (replyingTo) {
      setText('');
      inputRef.current?.focus();
    }
  }, [replyingTo?.id]);

  const handleSend = async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    setSending(true);
    try {
      const ok = await onSubmit(body);
      if (!ok) setText(body); // don't lose what they typed
    } finally {
      setSending(false);
    }
  };

  return (
    <View>
      {replyingTo ? (
        <View style={s.replyingToStrip}>
          <Text style={s.replyingToText} numberOfLines={1}>Replying to {replyingTo.authorName}</Text>
          <TouchableOpacity onPress={onCancelReply} hitSlop={8}>
            <Ionicons name="close" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      ) : null}
      <View style={s.inputBar}>
        <TextInput
          ref={inputRef}
          style={s.input}
          value={text}
          onChangeText={setText}
          placeholder={replyingTo ? `Reply to ${replyingTo.authorName}...` : 'Add a comment...'}
          placeholderTextColor={colors.muted}
          multiline
        />
        <TouchableOpacity style={s.sendBtn} onPress={handleSend} disabled={sending || !text.trim()}>
          {sending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={18} color="#fff" />}
        </TouchableOpacity>
      </View>
    </View>
  );
});

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
  // "Add a comment" bar text/sending state lives in NewCommentBar now.
  // Threaded replies: which comment is expanded, its loaded replies, and the
  // comment currently being replied to.
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [repliesByComment, setRepliesByComment] = useState<Record<number, Reply[]>>({});
  // WHICH comment is being edited/replied to -- changes only on a tap, never
  // a keystroke. The actual typed text lives in CommentRow's own local state
  // now; see its module comment (mirrors feed.tsx's fix for the identical bug).
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  const loadReplies = useCallback(async (commentId: number) => {
    try {
      const d = await apiFetch<{ replies: Reply[] }>(`/api/posts/${id}/comments/${commentId}/replies`);
      setRepliesByComment(prev => ({ ...prev, [commentId]: d.replies || [] }));
    } catch {
      setRepliesByComment(prev => ({ ...prev, [commentId]: [] }));
    }
  }, [id]);

  const handleToggleReplies = useCallback((commentId: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(commentId)) { next.delete(commentId); }
      else { next.add(commentId); if (!repliesByComment[commentId]) loadReplies(commentId); }
      return next;
    });
  }, [repliesByComment, loadReplies]);

  // Toggling Reply on the same comment again closes it, same as before.
  const handleToggleReply = useCallback((commentId: number) => {
    setReplyingTo(prev => (prev === commentId ? null : commentId));
  }, []);

  const handleSendReply = useCallback(async (commentId: number, text: string): Promise<boolean> => {
    try {
      const res = await apiFetch<{ reply: Reply }>(`/api/posts/${id}/comments/${commentId}/replies`, {
        method: 'POST', body: JSON.stringify({ content: text }),
      });
      if (res.reply) {
        setRepliesByComment(prev => ({ ...prev, [commentId]: [...(prev[commentId] || []), res.reply] }));
        setComments(prev => prev.map(c => c.id === commentId ? { ...c, reply_count: (c.reply_count || 0) + 1 } : c));
        setExpanded(prev => new Set(prev).add(commentId));
      }
      setReplyingTo(null);
      return true;
    } catch {
      return false; // NewCommentBar keeps the drafted text -- nothing lost.
    }
  }, [id]);

  const handleCancelReply = useCallback(() => setReplyingTo(null), []);

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

  // Real toggle now (see feed.tsx's repost for the full root-cause writeup):
  // is_reposted is authoritative from the backend, and un-reposting is a real
  // DELETE, not just a client-side "already reposted" guard that reset to
  // false on every reload and let repeat taps create duplicate rows.
  const repost = async () => {
    if (!post) return;
    const was = post.is_reposted;
    const bump = (p: Post, liked: boolean, dir: number): Post =>
      p.is_repost && p.original_repost_count !== undefined
        ? { ...p, is_reposted: liked, original_repost_count: Math.max(0, p.original_repost_count + dir) }
        : { ...p, is_reposted: liked, reposts_count: Math.max(0, (p.reposts_count ?? 0) + dir) };
    setPost(p => p ? bump(p, !was, was ? -1 : 1) : p);
    try {
      await apiFetch(`/api/posts/${post.id}/repost`, { method: was ? 'DELETE' : 'POST' });
    } catch {
      setPost(p => p ? bump(p, was, was ? 1 : -1) : p);
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

  const handleLikeComment = useCallback(async (commentId: number) => {
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
  }, [id]);

  const handleReportComment = useCallback((commentId: number, authorName: string) => {
    setReportTarget({ type: 'comment', id: commentId, name: authorName });
  }, []);

  const handleStartEdit = useCallback((commentId: number) => setEditingCommentId(commentId), []);
  const handleCancelEdit = useCallback(() => setEditingCommentId(null), []);

  // Edit one of YOUR OWN comments. Author-gated to match the server, whose
  // UPDATE is scoped `WHERE id = $1 AND user_id = $2`. Not Pro-gated (post
  // editing is) -- fixing a typo in your own comment is table stakes.
  //
  // No-op-save guard (unchanged text) now lives in CommentRow itself, which
  // has `item.content` right there as a prop -- no need to search `comments`.
  const handleSaveEdit = useCallback(async (commentId: number, text: string): Promise<boolean> => {
    try {
      const res = await apiFetch<{ comment: Comment }>(
        `/api/posts/${id}/comments/${commentId}`,
        { method: 'PATCH', body: JSON.stringify({ content: text }) });
      setComments(cs => cs.map(c => c.id === commentId
        ? { ...c, content: res.comment.content, edited_at: res.comment.edited_at }
        : c));
      setEditingCommentId(null);
      return true;
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : '');
      return false; // CommentRow keeps its own editor open with the text intact.
    }
  }, [id]);

  const handleDeleteComment = useCallback((commentId: number) => {
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
  }, [id, load]);

  const handleSubmitNewComment = useCallback(async (text: string): Promise<boolean> => {
    if (!post) return false;
    try {
      const res = await apiFetch<{ comment: Comment }>(`/api/posts/${post.id}/comments`, {
        method: 'POST', body: JSON.stringify({ content: text }),
      });
      if (res.comment) setComments(prev => [...prev, res.comment]);
      setPost(p => {
        if (!p) return p;
        if (p.is_repost && p.original_comments_count !== undefined) {
          return { ...p, original_comments_count: p.original_comments_count + 1 };
        }
        return { ...p, comments_count: p.comments_count + 1 };
      });
      return true;
    } catch {
      return false; // NewCommentBar restores what was typed.
    }
  }, [post?.id]);

  // NewCommentBar has one onSubmit -- this decides, on the parent's side,
  // whether "Send" posts a new top-level comment or a reply, so the bar
  // itself stays unaware of "modes".
  const handleComposerSubmit = useCallback(async (text: string): Promise<boolean> => {
    if (replyingTo != null) return handleSendReply(replyingTo, text);
    return handleSubmitNewComment(text);
  }, [replyingTo, handleSendReply, handleSubmitNewComment]);

  // The comments FlatList's renderItem, useCallback'd. Dependencies no
  // longer include editingCommentId/replyingTo -- CommentRow renders no
  // input any more, so it has no need to know which comment (if any) is
  // being edited/replied to. Tapping Edit/Reply no longer changes this
  // identity at all, which means it no longer causes FlatList to re-invoke
  // renderItem for every visible row either -- removing the row-reflow that
  // used to coincide with (and, per the investigation, cause) the focus drop.
  const renderCommentItem = useCallback(({ item }: { item: Comment }) => (
    <CommentRow
      item={item}
      currentUserId={currentUserId}
      isExpanded={expanded.has(item.id)}
      replies={repliesByComment[item.id] || []}
      onStartEdit={handleStartEdit}
      onStartReply={handleToggleReply}
      onToggleReplies={handleToggleReplies}
      onLike={handleLikeComment}
      onDelete={handleDeleteComment}
      onReport={handleReportComment}
    />
  ), [
    currentUserId, expanded, repliesByComment,
    handleStartEdit, handleToggleReply, handleToggleReplies,
    handleLikeComment, handleDeleteComment, handleReportComment,
  ]);

  // Resolved once per render for EditCommentSheet/NewCommentBar -- a cheap
  // linear find over a comments array that's at most a couple dozen items,
  // and only actually re-run when SinglePost() re-renders for a reason
  // unrelated to typing (editingCommentId/replyingTo change on a tap, not a
  // keystroke, exactly like everything else in this file post-fix).
  const editingComment = editingCommentId != null
    ? comments.find(c => c.id === editingCommentId) ?? null
    : null;
  const replyingToComment = replyingTo != null
    ? comments.find(c => c.id === replyingTo) ?? null
    : null;
  const replyingToInfo = replyingToComment
    ? { id: replyingToComment.id, authorName: replyingToComment.author_name }
    : null;

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
            renderItem={renderCommentItem}
          />
          <NewCommentBar onSubmit={handleComposerSubmit} replyingTo={replyingToInfo} onCancelReply={handleCancelReply} />
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

      <EditCommentSheet comment={editingComment} onCancel={handleCancelEdit} onSave={handleSaveEdit} />
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
  commentEditedTag: { fontSize: 11, color: colors.muted, marginTop: 2 },
  // commentEditBox/commentEditInput/commentEditActions/commentEditCancel/
  // commentEditSave and replyBox/replyInput/replySend (the in-row edit/reply
  // TextInputs) are gone -- moved to EditCommentSheet and NewCommentBar. An
  // autoFocus TextInput inside a virtualized FlatList row was the actual
  // cause of the "keyboard closes immediately, can't edit/reply" regression.
  commentText: { fontSize: 15, color: colors.text, marginTop: 2, lineHeight: 20 },
  commentTime: { fontSize: 12, color: colors.muted, marginTop: 4 },
  commentActions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  commentLikeBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  commentLikeCount: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  deleteAction: { fontSize: 12, fontWeight: '700', color: colors.danger, marginTop: 4 },
  replyAction: { fontSize: 12, fontWeight: '700', color: colors.brand, marginTop: 4 },
  replyingToStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, backgroundColor: colors.surface,
  },
  replyingToText: { flex: 1, fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
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
