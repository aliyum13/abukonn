import { useEffect, useState, useRef, useCallback } from 'react';
import { useThemedStyles } from '../theme/ThemeContext';
import type { Palette } from '../theme';
import {
  View, Text, Image, StyleSheet, TouchableOpacity, Modal, Dimensions,
  ScrollView, TextInput, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator, Pressable, FlatList,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { apiFetch } from '../lib/api';
import { uploadImage } from '../lib/upload';
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
  font_style?: string | null;
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
  const s = useThemedStyles(make_s);
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
          onDeleted={() => { setViewing(null); load(); }}
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
  group, order, seen, onSeen, onChangeGroup, onClose, onDeleted,
}: {
  group: StoryGroup;
  order: StoryGroup[];
  seen: Set<number>;
  onSeen: (id: number) => void;
  onChangeGroup: (g: StoryGroup) => void;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const s = useThemedStyles(make_s);
  const v = useThemedStyles(make_v);
  const firstUnseen = group.stories.findIndex(st => !seen.has(st.id));
  const [idx, setIdx] = useState(firstUnseen >= 0 ? firstUnseen : 0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [reply, setReply] = useState('');

  const story = group.stories[idx];

  const deleteStory = () => {
    if (!story) return;
    Alert.alert('Delete story', 'This story will be permanently removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/api/stories/${story.id}`, { method: 'DELETE' });
            onDeleted();
            onClose();
          } catch (err) {
            Alert.alert('Could not delete', err instanceof Error ? err.message : '');
          }
        },
      },
    ]);
  };

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
              <Text style={[v.storyText, storyFontStyle(story.font_style)]}>{story.text_content}</Text>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
            {group.is_own ? (
              <TouchableOpacity onPress={deleteStory} hitSlop={12}>
                <Text style={v.close}>🗑</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Text style={v.close}>✕</Text>
            </TouchableOpacity>
          </View>
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

// Text-story fonts — keys match the backend whitelist (STORY_FONTS). Mapped to
// React Native text styles (RN has no CSS classes).
const STORY_FONTS: { key: string; label: string; style: object }[] = [
  { key: 'classic', label: 'Aa', style: {} },
  { key: 'bold', label: 'Aa', style: { fontWeight: '800' as const } },
  { key: 'serif', label: 'Aa', style: { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' } },
  { key: 'mono', label: 'Aa', style: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' } },
  { key: 'script', label: 'Aa', style: { fontStyle: 'italic' as const, fontFamily: Platform.OS === 'ios' ? 'Snell Roundhand' : 'sans-serif' } },
];

function storyFontStyle(fontKey: string | null | undefined): object {
  return STORY_FONTS.find(f => f.key === fontKey)?.style ?? {};
}

function StoryComposer({ onClose, onPosted }: { onClose: () => void; onPosted: () => void }) {
  const s = useThemedStyles(make_s);
  const c = useThemedStyles(make_c);
  const [mode, setMode] = useState<'text' | 'image'>('text');
  const [text, setText] = useState('');
  const [bg, setBg] = useState(BG_COLORS[0]);
  const [font, setFont] = useState('classic');
  const [image, setImage] = useState<string | null>(null);
  const [linkPreview, setLinkPreview] = useState<{ title: string | null; description: string | null; image: string | null; site_name: string | null } | null>(null);
  const [audience, setAudience] = useState<'all' | 'only' | 'except'>('all');
  const [picking, setPicking] = useState(false);
  const [following, setFollowing] = useState<{ id: number; full_name: string; profile_photo_url: string | null }[]>([]);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  // Detect a URL in the text story and fetch a preview (composer courtesy — the
  // preview isn't saved with the story, mirroring web).
  useEffect(() => {
    if (mode !== 'text') { setLinkPreview(null); return; }
    const match = text.match(/https?:\/\/[^\s]+/);
    if (!match) { setLinkPreview(null); return; }
    const url = match[0];
    let live = true;
    const t = setTimeout(async () => {
      try {
        const res = await apiFetch<{ title: string | null; description: string | null; image: string | null; site_name: string | null }>(
          `/api/stories/link-preview?url=${encodeURIComponent(url)}`);
        if (live) setLinkPreview(res);
      } catch {
        if (live) setLinkPreview(null);
      }
    }, 600);
    return () => { live = false; clearTimeout(t); };
  }, [text, mode]);

  // Load who you follow, so 'only'/'except' can name specific people.
  const loadFollowing = async () => {
    try {
      const d = await apiFetch<{ following: { id: number; full_name: string; profile_photo_url: string | null }[] }>(
        '/api/follows/following');
      setFollowing(d.following || []);
    } catch {
      setFollowing([]);
    }
  };

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
      // Audience: 'all' = every follower; 'only'/'except' name specific people,
      // snapshotted server-side at post time. The values must match the backend
      // whitelist exactly ('all' | 'only' | 'except') — anything else is silently
      // ignored and the last saved preference is used instead.
      const audienceIds = audience === 'all' ? [] : Array.from(chosen);

      if (mode === 'text') {
        // Text stories carry no file, so send JSON — exactly like the web client.
        // This matters: audience_user_ids reaches the backend as a real array,
        // which a multipart form can't reliably produce.
        await apiFetch('/api/stories', {
          method: 'POST',
          body: JSON.stringify({
            story_type: 'text',
            text_content: text.trim(),
            bg_color: bg,
            font_style: font,
            audience,
            audience_user_ids: audienceIds,
          }),
        });
      } else {
        // Upload the photo to Cloudinary first, then post the URL as JSON —
        // exactly like text stories and like the web client. Sending the file
        // through the backend hangs on Railway's timeout, which is why photo
        // stories never completed.
        const mediaUrl = await uploadImage(image as string, 'abukonn/stories');
        await apiFetch('/api/stories', {
          method: 'POST',
          body: JSON.stringify({
            story_type: 'image',
            direct_upload: true,
            media_url: mediaUrl,
            caption: text.trim() || undefined,
            audience,
            audience_user_ids: audienceIds,
          }),
        });
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
            style={[c.textInput, storyFontStyle(font)]}
            placeholder="Type something..."
            placeholderTextColor="rgba(255,255,255,0.6)"
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
          />
        )}

        {mode === 'text' && linkPreview && (linkPreview.title || linkPreview.image) ? (
          <View style={c.linkCard}>
            {linkPreview.image ? (
              <Image source={{ uri: linkPreview.image }} style={c.linkImage} resizeMode="cover" />
            ) : null}
            <View style={{ flex: 1 }}>
              {linkPreview.site_name ? <Text style={c.linkSite}>{linkPreview.site_name}</Text> : null}
              {linkPreview.title ? <Text style={c.linkTitle} numberOfLines={2}>{linkPreview.title}</Text> : null}
            </View>
          </View>
        ) : null}

        <View style={c.audienceRow}>
          <TouchableOpacity
            style={[c.audChip, audience === 'all' ? c.audChipOn : null]}
            onPress={() => setAudience('all')}
          >
            <Text style={audience === 'all' ? c.audTextOn : c.audText}>🌍 Everyone</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[c.audChip, audience === 'only' ? c.audChipOn : null]}
            onPress={() => {
              setAudience('only');
              if (following.length === 0) loadFollowing();
              setPicking(true);
            }}
          >
            <Text style={audience === 'only' ? c.audTextOn : c.audText}>
              ✅ Only{audience === 'only' && chosen.size ? ` (${chosen.size})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[c.audChip, audience === 'except' ? c.audChipOn : null]}
            onPress={() => {
              setAudience('except');
              if (following.length === 0) loadFollowing();
              setPicking(true);
            }}
          >
            <Text style={audience === 'except' ? c.audTextOn : c.audText}>
              🚫 Except{audience === 'except' && chosen.size ? ` (${chosen.size})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

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

          {mode === 'text' ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 10 }}>
              {STORY_FONTS.map(f => (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => setFont(f.key)}
                  style={[c.fontChip, font === f.key ? c.fontChipOn : null]}
                >
                  <Text style={[{ color: '#fff', fontSize: 16 }, f.style]}>{f.label}</Text>
                </TouchableOpacity>
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

      {/* Follower picker for 'only' / 'except' audiences */}
      <Modal visible={picking} animationType="slide" onRequestClose={() => setPicking(false)}>
        <View style={c.pickerRoot}>
          <View style={c.pickerHeader}>
            <TouchableOpacity onPress={() => setPicking(false)}>
              <Text style={c.action}>Cancel</Text>
            </TouchableOpacity>
            <Text style={c.title}>
              {audience === 'only' ? 'Show only to' : 'Hide from'}
            </Text>
            <TouchableOpacity onPress={() => setPicking(false)}>
              <Text style={c.action}>Done</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={following}
            keyExtractor={u => String(u.id)}
            ListEmptyComponent={
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Text style={{ color: 'rgba(255,255,255,0.6)' }}>You're not following anyone yet</Text>
              </View>
            }
            renderItem={({ item }) => {
              const on = chosen.has(item.id);
              return (
                <TouchableOpacity
                  style={c.pickRow}
                  onPress={() => setChosen(prev => {
                    const n = new Set(prev);
                    if (n.has(item.id)) n.delete(item.id); else n.add(item.id);
                    return n;
                  })}
                >
                  {item.profile_photo_url ? (
                    <Image source={{ uri: item.profile_photo_url }} style={c.pickAvatar} />
                  ) : (
                    <View style={[c.pickAvatar, { backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ color: '#fff', fontWeight: '700' }}>
                        {item.full_name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={c.pickName}>{item.full_name}</Text>
                  <View style={[c.check, on ? c.checkOn : null]}>
                    {on ? <Text style={c.checkMark}>✓</Text> : null}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </Modal>
  );
}

const make_s = (colors: Palette) => StyleSheet.create({
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

const make_v = (colors: Palette) => StyleSheet.create({
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

const make_c = (colors: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 50 },
  action: { color: '#fff', fontWeight: '700', fontSize: 15 },
  title: { color: '#fff', fontWeight: '700', fontSize: 16 },
  textInput: { flex: 1, color: '#fff', fontSize: 24, fontWeight: '700', textAlign: 'center', padding: 24, textAlignVertical: 'center' },
  preview: { flex: 1, width: '100%' },
  tools: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, paddingBottom: 34 },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: '#fff' },
  fontChip: {
    minWidth: 40, height: 34, borderRadius: 8, paddingHorizontal: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.1)',
  },
  fontChipOn: { borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.25)' },
  linkCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 8,
  },
  linkImage: { width: 48, height: 48, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)' },
  linkSite: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },
  linkTitle: { color: '#fff', fontSize: 13, fontWeight: '700' },
  photoBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  photoText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  pickerRoot: { flex: 1, backgroundColor: '#0a0a0a' },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: '#222',
  },
  pickRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  pickAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#333' },
  pickName: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600' },
  check: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#555',
    alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  checkMark: { color: '#fff', fontSize: 13, fontWeight: '800' },
  audienceRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 6 },
  audChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
  },
  audChipOn: { backgroundColor: 'rgba(255,255,255,0.25)', borderColor: '#fff' },
  audText: { color: 'rgba(255,255,255,0.7)', fontWeight: '600', fontSize: 13 },
  audTextOn: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
