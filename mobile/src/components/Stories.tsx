import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity, Modal, Dimensions,
  ScrollView, TextInput, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator, Pressable,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { apiFetch, API_URL } from '../lib/api';
import { getToken } from '../lib/storage';
import { colors } from '../theme';

const { width: W, height: H } = Dimensions.get('window');
const STORY_MS = 5000;
const DWELL_MS = 1200; // must linger this long before it counts as seen

export interface Story {
  id: number;
  user_id: number;
  media_url: string | null;
  story_type: 'image' | 'video' | 'text';
  text_content: string | null;
  bg_color: string | null;
  caption: string | null;
  view_count: number | null;
  viewed?: boolean;
  created_at: string;
}

export interface StoryGroup {
  user_id: number;
  user_name: string;
  user_photo: string | null;
  is_own: boolean;
  muted?: boolean;
  stories: Story[];
}

// ── Story bar ────────────────────────────────────────────────────────────────
export function StoryBar() {
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [seen, setSeen] = useState<Set<number>>(new Set());
  const [viewing, setViewing] = useState<StoryGroup | null>(null);
  const [order, setOrder] = useState<StoryGroup[]>([]);
  const [composing, setComposing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ groups: StoryGroup[] }>('/api/stories');
      const gs = data.groups || [];
      setGroups(gs);
      // Seed seen-state from the server so it survives reinstalls and follows
      // you across devices.
      const s = new Set<number>();
      gs.forEach(g => g.stories.forEach(st => { if (g.is_own || st.viewed) s.add(st.id); }));
      setSeen(prev => new Set([...prev, ...s]));
    } catch {
      setGroups([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Unseen first, then already-viewed, then muted last. Own group pinned first.
  const ordered = (() => {
    const hasUnseen = (g: StoryGroup) => g.stories.some(st => !seen.has(st.id));
    const rank = (g: StoryGroup) => (g.muted ? 2 : hasUnseen(g) ? 0 : 1);
    const own = groups.filter(g => g.is_own);
    const others = groups.filter(g => !g.is_own).slice().sort((a, b) => rank(a) - rank(b));
    return [...own, ...others];
  })();

  // Snapshot the order when the viewer opens. Reading it live would let stories
  // becoming "seen" re-rank the list mid-swipe and send you somewhere random.
  const open = (g: StoryGroup) => {
    setOrder(ordered);
    setViewing(g);
  };

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.bar}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 14 }}
      >
        <TouchableOpacity style={s.item} onPress={() => setComposing(true)}>
          <View style={[s.ring, s.addRing]}><Text style={s.plus}>+</Text></View>
          <Text style={s.name}>Add</Text>
        </TouchableOpacity>

        {ordered.map(g => {
          const unseen = g.stories.some(st => !seen.has(st.id));
          return (
            <TouchableOpacity
              key={g.user_id}
              style={[s.item, g.muted ? { opacity: 0.4 } : null]}
              onPress={() => open(g)}
            >
              <View style={[s.ring, unseen ? s.unseenRing : s.seenRing]}>
                {g.user_photo ? (
                  <Image source={{ uri: g.user_photo }} style={s.avatar} />
                ) : (
                  <View style={[s.avatar, s.fallback]}>
                    <Text style={s.letter}>{g.user_name.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
              </View>
              <Text style={s.name} numberOfLines={1}>
                {g.is_own ? 'You' : g.user_name.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {viewing ? (
        <StoryViewer
          group={viewing}
          order={order}
          seen={seen}
          onSeen={id => setSeen(prev => new Set([...prev, id]))}
          onChangeGroup={setViewing}
          onClose={() => { setViewing(null); load(); }}
        />
      ) : null}

      {composing ? (
        <StoryComposer
          onClose={() => setComposing(false)}
          onPosted={() => { setComposing(false); load(); }}
        />
      ) : null}
    </>
  );
}

// ── Full-screen viewer ───────────────────────────────────────────────────────
function StoryViewer({
  group, order, seen, onSeen, onChangeGroup, onClose,
}: {
  group: StoryGroup;
  order: StoryGroup[];
  seen: Set<number>;
  onSeen: (id: number) => void;
  onChangeGroup: (g: StoryGroup) => void;
  onClose: () => void;
}) {
  const firstUnseen = group.stories.findIndex(st => !seen.has(st.id));
  const [idx, setIdx] = useState(firstUnseen >= 0 ? firstUnseen : 0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [reply, setReply] = useState('');

  const story = group.stories[idx];

  const goGroup = (dir: 1 | -1) => {
    const i = order.findIndex(g => g.user_id === group.user_id);
    let j = i + dir;
    while (j >= 0 && j < order.length && order[j].muted) j += dir; // skip muted
    if (j < 0 || j >= order.length) { onClose(); return; }
    onChangeGroup(order[j]);
    setIdx(0);
  };

  const next = () => {
    if (idx < group.stories.length - 1) setIdx(i => i + 1);
    else goGroup(1);
  };
  const prev = () => {
    if (idx > 0) setIdx(i => i - 1);
    else goGroup(-1);
  };

  // Progress + auto-advance.
  useEffect(() => {
    setProgress(0);
    if (paused || !story) return;
    const started = Date.now();
    const t = setInterval(() => {
      const p = Math.min(1, (Date.now() - started) / STORY_MS);
      setProgress(p);
      if (p >= 1) { clearInterval(t); next(); }
    }, 50);
    return () => clearInterval(t);
  }, [idx, paused, story?.id]);

  // Count as seen only after real dwell — flicking past shouldn't mark it read,
  // nor tell the author you looked.
  useEffect(() => {
    if (!story) return;
    const t = setTimeout(() => {
      onSeen(story.id);
      if (!group.is_own) {
        apiFetch(`/api/stories/${story.id}/view`, { method: 'POST' }).catch(() => {});
      }
    }, DWELL_MS);
    return () => clearTimeout(t);
  }, [story?.id]);

  const sendReply = async () => {
    const body = reply.trim();
    if (!body || !story) return;
    setReply('');
    try {
      await apiFetch(`/api/stories/${story.id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ content: body }),
      });
      Alert.alert('Sent', 'Your reply was sent as a message.');
    } catch {
      Alert.alert('Could not send reply');
    }
  };

  const react = async () => {
    if (!story) return;
    try { await apiFetch(`/api/stories/${story.id}/react`, { method: 'POST' }); } catch { /* best effort */ }
  };

  if (!story) return null;

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={v.root}>
        {/* Content sits BELOW the gesture zones and is pointerEvents="none".
            Getting this wrong is exactly what made the web viewer swallow every
            tap and swipe — the content layer must never intercept gestures. */}
        <View style={v.content} pointerEvents="none">
          {story.story_type === 'text' ? (
            <View style={[v.textStory, { backgroundColor: story.bg_color || colors.brand }]}>
              <Text style={v.storyText}>{story.text_content}</Text>
            </View>
          ) : story.media_url ? (
            <Image source={{ uri: story.media_url }} style={v.media} resizeMode="contain" />
          ) : null}
        </View>

        {/* Gesture zones: tap left = back, tap right = forward, hold = pause. */}
        <Pressable
          style={v.zoneLeft}
          onPress={prev}
          onPressIn={() => setPaused(true)}
          onPressOut={() => setPaused(false)}
        />
        <Pressable
          style={v.zoneRight}
          onPress={next}
          onPressIn={() => setPaused(true)}
          onPressOut={() => setPaused(false)}
        />

        {/* Progress bars */}
        <View style={v.bars} pointerEvents="none">
          {group.stories.map((st, i) => (
            <View key={st.id} style={v.barTrack}>
              <View
                style={[
                  v.barFill,
                  { width: i < idx ? '100%' : i === idx ? `${progress * 100}%` : '0%' },
                ]}
              />
            </View>
          ))}
        </View>

        {/* Header */}
        <View style={v.header}>
          <Text style={v.author}>{group.is_own ? 'Your story' : group.user_name}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={v.close}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={v.footerWrap}
        >
          <View style={v.footer}>
            {group.is_own ? (
              <Text style={v.views}>👁 {story.view_count ?? 0} views</Text>
            ) : (
              <>
                <TextInput
                  style={v.replyInput}
                  placeholder="Reply..."
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  value={reply}
                  onChangeText={setReply}
                  onFocus={() => setPaused(true)}
                  onBlur={() => setPaused(false)}
                />
                <TouchableOpacity onPress={sendReply} hitSlop={10}>
                  <Text style={v.send}>Send</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={react} hitSlop={10}>
                  <Text style={v.heart}>♥</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── Composer ─────────────────────────────────────────────────────────────────
const BG_COLORS = ['#16a34a', '#0ea5e9', '#8b5cf6', '#f43f5e', '#f59e0b', '#0a0a0a'];

function StoryComposer({ onClose, onPosted }: { onClose: () => void; onPosted: () => void }) {
  const [mode, setMode] = useState<'text' | 'image'>('text');
  const [text, setText] = useState('');
  const [bg, setBg] = useState(BG_COLORS[0]);
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo access to post an image story.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) {
      setImage(res.assets[0].uri);
      setMode('image');
    }
  };

  const post = async () => {
    if (mode === 'text' && !text.trim()) return;
    if (mode === 'image' && !image) return;
    setBusy(true);
    try {
      const token = await getToken();
      const form = new FormData();

      if (mode === 'text') {
        form.append('story_type', 'text');
        form.append('text_content', text.trim());
        form.append('bg_color', bg);
      } else {
        form.append('story_type', 'image');
        form.append('media', {
          uri: image as string,
          name: 'story.jpg',
          type: 'image/jpeg',
        } as unknown as Blob);
        if (text.trim()) form.append('caption', text.trim());
      }

      const res = await fetch(`${API_URL}/api/stories`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { message?: string }).message || 'Could not post story');
      }
      onPosted();
    } catch (err) {
      Alert.alert('Could not post', err instanceof Error ? err.message : '');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[c.root, mode === 'text' ? { backgroundColor: bg } : null]}>
        <View style={c.header}>
          <TouchableOpacity onPress={onClose}><Text style={c.action}>Cancel</Text></TouchableOpacity>
          <Text style={c.title}>New story</Text>
          <TouchableOpacity onPress={post} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={c.action}>Post</Text>}
          </TouchableOpacity>
        </View>

        {mode === 'image' && image ? (
          <Image source={{ uri: image }} style={c.preview} resizeMode="contain" />
        ) : (
          <TextInput
            style={c.textInput}
            placeholder="Type something..."
            placeholderTextColor="rgba(255,255,255,0.6)"
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
          />
        )}

        <View style={c.tools}>
          {mode === 'text' ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {BG_COLORS.map(col => (
                <TouchableOpacity
                  key={col}
                  onPress={() => setBg(col)}
                  style={[c.swatch, { backgroundColor: col }, bg === col ? c.swatchOn : null]}
                />
              ))}
            </ScrollView>
          ) : null}

          <TouchableOpacity onPress={pick} style={c.photoBtn}>
            <Text style={c.photoText}>{mode === 'image' ? 'Change photo' : '📷 Photo'}</Text>
          </TouchableOpacity>

          {mode === 'image' ? (
            <TouchableOpacity onPress={() => { setImage(null); setMode('text'); }}>
              <Text style={c.photoText}>Text</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  bar: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, flexGrow: 0 },
  item: { alignItems: 'center', width: 66 },
  ring: { width: 60, height: 60, borderRadius: 30, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  unseenRing: { borderColor: colors.brand },
  seenRing: { borderColor: colors.border },
  addRing: { borderColor: colors.border, borderStyle: 'dashed', backgroundColor: '#f9fafb' },
  plus: { fontSize: 26, color: colors.brand, fontWeight: '300' },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#dcfce7' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  letter: { color: colors.brand, fontWeight: '700', fontSize: 18 },
  name: { fontSize: 11, color: colors.muted, marginTop: 4, maxWidth: 62 },
});

const v = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  content: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  media: { width: W, height: H * 0.8 },
  textStory: { width: W, height: H * 0.75, alignItems: 'center', justifyContent: 'center', padding: 32 },
  storyText: { color: '#fff', fontSize: 26, fontWeight: '700', textAlign: 'center' },
  zoneLeft: { position: 'absolute', left: 0, top: 100, bottom: 100, width: W * 0.35, zIndex: 10 },
  zoneRight: { position: 'absolute', right: 0, top: 100, bottom: 100, width: W * 0.65, zIndex: 10 },
  bars: { flexDirection: 'row', gap: 4, paddingHorizontal: 10, paddingTop: 50, zIndex: 20 },
  barTrack: { flex: 1, height: 2.5, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2 },
  barFill: { height: '100%', backgroundColor: '#fff', borderRadius: 2 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, zIndex: 20 },
  author: { color: '#fff', fontWeight: '700', fontSize: 15 },
  close: { color: '#fff', fontSize: 22 },
  footerWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, paddingBottom: 34 },
  replyInput: { flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, color: '#fff' },
  send: { color: '#fff', fontWeight: '700' },
  heart: { color: '#fff', fontSize: 22 },
  views: { color: '#fff', fontSize: 14 },
});

const c = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 50 },
  action: { color: '#fff', fontWeight: '700', fontSize: 15 },
  title: { color: '#fff', fontWeight: '700', fontSize: 16 },
  textInput: { flex: 1, color: '#fff', fontSize: 24, fontWeight: '700', textAlign: 'center', padding: 24, textAlignVertical: 'center' },
  preview: { flex: 1, width: '100%' },
  tools: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, paddingBottom: 34 },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: '#fff' },
  photoBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  photoText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
