import { useEffect, useState, useCallback, memo } from 'react';
import { useThemedStyles } from '../../src/theme/ThemeContext';
import type { Palette } from '../../src/theme';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl,
  Image, TouchableOpacity, Modal, ScrollView, Share,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../src/lib/api';
import { optimizedImage } from '../../src/lib/image';
import { ImageLightbox } from '../../src/components/ImageLightbox';
import { colors, radius, shadow } from '../../src/theme';
import { useTabScrollToTop } from '../../src/lib/useScrollToTop';

interface Article {
  id: number;
  title: string;
  content: string;
  category: string;
  image_url: string | null;
  author_name: string | null;
  created_at: string;
  likes_count: number;
  is_liked: boolean;
}

// Same set the web News page uses.
const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'admission', label: 'Admission' },
  { key: 'examination', label: 'Examination' },
  { key: 'faculty', label: 'Faculty' },
  { key: 'sports', label: 'Sports' },
  { key: 'events', label: 'Events' },
  { key: 'general', label: 'General' },
];

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// Same category -> color associations as web's CATEGORY_PILL, using the same
// rgba-background/solid-foreground technique feed.tsx's own CATEGORY_CHIP
// already uses elsewhere in this app (adapts reasonably across light/dark
// since the alpha-blended background sits on whatever the card provides).
const CATEGORY_PILL: Record<string, { bg: string; fg: string }> = {
  admission:   { bg: 'rgba(59,130,246,0.12)',  fg: '#2563eb' },
  examination: { bg: 'rgba(249,115,22,0.12)',  fg: '#ea580c' },
  faculty:     { bg: 'rgba(168,85,247,0.12)',  fg: '#9333ea' },
  sports:      { bg: 'rgba(234,179,8,0.14)',   fg: '#a16207' },
  events:      { bg: 'rgba(219,39,119,0.12)',  fg: '#db2777' },
  academic:    { bg: 'rgba(22,163,74,0.12)',   fg: '#16a34a' },
};

function initials(name: string | null) {
  return (name || 'ABUkonn News')
    .split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

const PREVIEW_CHARS = 200;

// Extracted (rather than inlined in renderItem) so each card can hold its
// own expanded state via hooks, same reason feed.tsx's PostCard is its own
// memoized component. Structure mirrors web's NewsItem in order: author row
// -> title -> expandable preview -> image -> category pill + actions.
//
// liked/likeCount are no longer local state here -- they read straight off
// `item` now that likes are persisted (news_likes table + POST /:id/like).
// The News() component owns the actual news array and the optimistic
// toggle (toggleNewsLike below), the same split PostCard/Feed() already use
// for post likes, so this card and the detail modal both reflect the SAME
// underlying state instead of drifting apart.
const NewsCard = memo(function NewsCard({
  item, onOpen, onShare, onOpenImage, onLike, s,
}: {
  item: Article;
  onOpen: (a: Article) => void;
  onShare: (a: Article) => void;
  onOpenImage: (url: string) => void;
  onLike: (a: Article) => void;
  s: ReturnType<typeof make_s>;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = item.content.length > PREVIEW_CHARS;
  const pill = CATEGORY_PILL[item.category?.toLowerCase()] || { bg: colors.surfaceSubtle, fg: colors.textSecondary };

  return (
    <View style={s.card}>
      {/* Author row */}
      <TouchableOpacity style={s.authorRow} activeOpacity={0.8} onPress={() => onOpen(item)}>
        <View style={s.avatar}><Text style={s.avatarText}>{initials(item.author_name)}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.authorName} numberOfLines={1}>{item.author_name || 'ABUkonn News'}</Text>
          <Text style={s.authorTime}>{timeAgo(item.created_at)}</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity activeOpacity={0.8} onPress={() => onOpen(item)}>
        <Text style={s.cardTitle}>{item.title}</Text>
      </TouchableOpacity>

      <Text style={s.preview}>
        {expanded || !isLong ? item.content : `${item.content.slice(0, PREVIEW_CHARS).trim()}...`}
      </Text>
      {isLong ? (
        <TouchableOpacity onPress={() => setExpanded(v => !v)} hitSlop={6}>
          <Text style={s.showMore}>{expanded ? 'show less' : 'show more'}</Text>
        </TouchableOpacity>
      ) : null}

      {item.image_url ? (
        <TouchableOpacity activeOpacity={0.9} onPress={() => onOpenImage(item.image_url!)} style={{ marginTop: 10 }}>
          <Image source={{ uri: optimizedImage(item.image_url, 500) }} style={s.cardImg} resizeMode="cover" />
        </TouchableOpacity>
      ) : null}

      <View style={s.footerRow}>
        <View style={[s.pill, { backgroundColor: pill.bg }]}>
          <Text style={[s.pillText, { color: pill.fg }]}>{item.category || 'general'}</Text>
        </View>
        <View style={s.actionsRow}>
          <TouchableOpacity style={s.actionBtn} onPress={() => onLike(item)}>
            <Ionicons name={item.is_liked ? 'heart' : 'heart-outline'} size={17} color={item.is_liked ? '#ef4444' : colors.textSecondary} />
            {item.likes_count > 0 ? <Text style={s.actionCount}>{item.likes_count}</Text> : null}
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={() => onOpen(item)}>
            <Ionicons name="chatbubble-outline" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={() => onShare(item)}>
            <Ionicons name="share-outline" size={17} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

export default function News() {
  const insets = useSafeAreaInsets();
  const s = useThemedStyles(make_s);
  const { ref: listRef, setRefresh } = useTabScrollToTop<Article>();
  const [news, setNews] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cat, setCat] = useState('all');
  const [open, setOpen] = useState<Article | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // Sends the token now (withAuth defaults to true; this used to
      // explicitly opt OUT with `false`) so is_liked reflects the signed-in
      // user. The endpoint itself is still reachable without one
      // (optionalAuth on the backend) -- this is additive, not a new login
      // requirement for the News tab.
      const data = await apiFetch<{ news: Article[] }>('/api/news');
      setNews(data.news || []);
    } catch {
      setNews([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); setRefresh(load); }, [load, setRefresh]);

  // Optimistic like/unlike against POST /api/news/:id/like, mirroring
  // feed.tsx's post-like pattern. Updates the LIST item and the currently-
  // open detail modal (if it's the same article) together -- `open` holds
  // its own object reference, not a lookup into `news`, so liking from
  // either surface would otherwise leave the other one stale until the next
  // full reload.
  const toggleNewsLike = useCallback((article: Article) => {
    const wasLiked = article.is_liked;
    const apply = (a: Article): Article => (a.id === article.id
      ? { ...a, is_liked: !wasLiked, likes_count: Math.max(0, a.likes_count + (wasLiked ? -1 : 1)) }
      : a);
    setNews(prev => prev.map(apply));
    setOpen(prev => (prev ? apply(prev) : prev));

    apiFetch(`/api/news/${article.id}/like`, { method: 'POST' }).catch(() => {
      const revert = (a: Article): Article => (a.id === article.id
        ? { ...a, is_liked: wasLiked, likes_count: article.likes_count }
        : a);
      setNews(prev => prev.map(revert));
      setOpen(prev => (prev ? revert(prev) : prev));
    });
  }, []);

  const filtered = cat === 'all' ? news : news.filter(n => n.category === cat);

  const shareArticle = async (article: Article) => {
    try {
      await Share.share({
        title: article.title,
        message: `${article.title}\n\nhttps://abukonn.com/news/${article.id}`,
      });
    } catch {
      /* user dismissed */
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}><Text style={s.title}>News</Text></View>

      <View style={s.filterRow}>
        <FlatList
          data={CATEGORIES}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={c => c.key}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.chip, cat === item.key ? s.chipOn : null]}
              onPress={() => setCat(item.key)}
            >
              <Text style={cat === item.key ? s.chipTextOn : s.chipText}>{item.label}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.brand} /></View>
      ) : (
        <FlatList
          ref={listRef}
          data={filtered}
          keyExtractor={n => String(n.id)}
          refreshControl={
            <RefreshControl refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.brand} />
          }
          ListEmptyComponent={
            <View style={s.center}><Text style={s.muted}>No news yet</Text></View>
          }
          renderItem={({ item }) => (
            <NewsCard item={item} onOpen={setOpen} onShare={shareArticle} onOpenImage={setLightboxUrl} onLike={toggleNewsLike} s={s} />
          )}
        />
      )}

      {/* Full article */}
      <Modal visible={!!open} animationType="slide" onRequestClose={() => setOpen(null)}>
        <SafeAreaView style={s.safe} edges={['bottom']}>
          <View style={[s.modalHeader, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity onPress={() => setOpen(null)} hitSlop={10}>
              <Text style={s.back}>‹ Back</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>News</Text>
            <TouchableOpacity onPress={() => open && shareArticle(open)} hitSlop={10} style={{ width: 50, alignItems: 'flex-end' }}>
              <Ionicons name="share-outline" size={22} color={colors.brand} />
            </TouchableOpacity>
          </View>
          {open ? (
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {open.image_url ? (
                <TouchableOpacity activeOpacity={0.9} onPress={() => setLightboxUrl(open.image_url)}>
                  <Image source={{ uri: optimizedImage(open.image_url) }} style={s.fullImg} resizeMode="contain" />
                </TouchableOpacity>
              ) : null}
              <Text style={s.cat}>{open.category.toUpperCase()}</Text>
              <Text style={s.fullTitle}>{open.title}</Text>
              <Text style={s.meta}>
                {open.author_name ? `${open.author_name} · ` : ''}{timeAgo(open.created_at)}
              </Text>
              {/* The detail modal never had a like button at all -- only the
                  card did. Closes that gap while persistence is being added;
                  toggleNewsLike keeps this and the list card's own row in
                  sync since both read off the same underlying state. */}
              <TouchableOpacity style={s.detailLikeBtn} onPress={() => toggleNewsLike(open)} hitSlop={6}>
                <Ionicons name={open.is_liked ? 'heart' : 'heart-outline'} size={18} color={open.is_liked ? '#ef4444' : colors.textSecondary} />
                <Text style={s.detailLikeText}>{open.likes_count > 0 ? open.likes_count : 'Like'}</Text>
              </TouchableOpacity>
              <Text style={s.fullBody}>{open.content}</Text>
            </ScrollView>
          ) : null}
        </SafeAreaView>
      </Modal>
      <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </SafeAreaView>
  );
}

const make_s = (colors: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, backgroundColor: colors.surface },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  filterRow: { marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  chipTextOn: { fontSize: 13, color: '#fff', fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  muted: { color: colors.muted, fontSize: 15 },
  card: {
    backgroundColor: colors.surface, marginHorizontal: 12, marginTop: 10, padding: 14,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, ...shadow.card,
  },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  authorName: { fontSize: 13, fontWeight: '700', color: colors.text },
  authorTime: { fontSize: 11, color: colors.muted, marginTop: 1 },
  cardImg: { width: '100%', height: 190, borderRadius: 10, backgroundColor: colors.surfaceSubtle },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text, lineHeight: 21, marginBottom: 4 },
  preview: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  showMore: { fontSize: 13, fontWeight: '700', color: colors.brand, marginTop: 4 },
  footerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12,
  },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionCount: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  // Still used by the full-article modal below, which wasn't part of this
  // list-card redesign.
  cat: { fontSize: 11, fontWeight: '800', color: colors.brand, letterSpacing: 0.5 },
  meta: { fontSize: 12, color: colors.muted, marginTop: 8 },
  detailLikeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14,
    paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, alignSelf: 'flex-start',
  },
  detailLikeText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  back: { color: colors.brand, fontSize: 16, fontWeight: '600' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  fullImg: { width: '100%', height: 260, borderRadius: 12, marginBottom: 16, backgroundColor: colors.surfaceSubtle },
  fullTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4 },
  fullBody: { fontSize: 16, color: colors.text, lineHeight: 26, marginTop: 16 },
});
