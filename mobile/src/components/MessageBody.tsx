import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useThemedStyles } from '../theme/ThemeContext';
import type { Palette } from '../theme';

// Some messages are stored as JSON (shared posts, story/message replies) rather
// than plain text. Parse and render them like web, instead of showing raw JSON.
interface Parsed {
  kind: 'shared_post' | 'story_reply' | 'message_reply' | 'text';
  data?: any;
  text: string;
}

function parseMessage(content: string): Parsed {
  try {
    const d = JSON.parse(content);
    if (d && typeof d === 'object') {
      if (d.type === 'shared_post') return { kind: 'shared_post', data: d, text: '' };
      if (d.type === 'story_reply') return { kind: 'story_reply', data: d, text: d.reply ?? '' };
      if (d.type === 'message_reply') return { kind: 'message_reply', data: d, text: d.reply ?? '' };
    }
  } catch { /* not JSON — plain text */ }
  return { kind: 'text', text: content };
}

export function MessageBody({ content, mine }: { content: string; mine: boolean }) {
  const s = useThemedStyles(make_s);
  const router = useRouter();
  const parsed = parseMessage(content);

  if (parsed.kind === 'shared_post') {
    const d = parsed.data;
    return (
      <View style={{ width: 220 }}>
        <Text style={[s.sharedLabel, mine ? s.onDark : null]}>📌 {d.author_name} shared a post</Text>
        <View style={[s.sharedCard, mine ? s.sharedCardMine : null]}>
          {d.image_url ? <Image source={{ uri: d.image_url }} style={s.sharedImage} resizeMode="cover" /> : null}
          <View style={{ padding: 10 }}>
            {d.content ? <Text style={[s.sharedContent, mine ? s.onDark : null]} numberOfLines={3}>{d.content}</Text> : null}
            <TouchableOpacity onPress={() => router.push({ pathname: '/post/[id]', params: { id: String(d.post_id) } })}>
              <Text style={[s.viewPost, mine ? s.viewPostMine : null]}>View post →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (parsed.kind === 'story_reply') {
    return (
      <View>
        <Text style={[s.quotedLabel, mine ? s.onDark : null]}>↩ Replied to a story</Text>
        <Text style={mine ? s.mineText : s.theirsText}>{parsed.text}</Text>
      </View>
    );
  }

  if (parsed.kind === 'message_reply') {
    const d = parsed.data;
    return (
      <View>
        <View style={[s.quoteBox, mine ? s.quoteBoxMine : null]}>
          <Text style={[s.quotedSender, mine ? s.onDark : null]} numberOfLines={1}>{d.quoted_sender}</Text>
          <Text style={[s.quotedText, mine ? s.onDark : null]} numberOfLines={2}>{d.quoted_text}</Text>
        </View>
        <Text style={mine ? s.mineText : s.theirsText}>{parsed.text}</Text>
      </View>
    );
  }

  return <Text style={mine ? s.mineText : s.theirsText}>{parsed.text}</Text>;
}

const make_s = (colors: Palette) => StyleSheet.create({
  mineText: { color: '#fff', fontSize: 15 },
  theirsText: { color: colors.text, fontSize: 15 },
  onDark: { color: 'rgba(255,255,255,0.9)' },
  sharedLabel: { fontSize: 11, fontWeight: '600', color: colors.muted, marginBottom: 6 },
  sharedCard: { borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', backgroundColor: colors.surface },
  sharedCardMine: { borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.1)' },
  sharedImage: { width: '100%', height: 110, backgroundColor: 'rgba(0,0,0,0.05)' },
  sharedContent: { fontSize: 13, color: colors.text, lineHeight: 18 },
  viewPost: { marginTop: 8, fontSize: 12, fontWeight: '700', color: colors.brand },
  viewPostMine: { color: '#fff' },
  quotedLabel: { fontSize: 11, fontWeight: '600', color: colors.muted, marginBottom: 3 },
  quoteBox: { borderLeftWidth: 3, borderLeftColor: colors.brand, paddingLeft: 8, marginBottom: 5, opacity: 0.85 },
  quoteBoxMine: { borderLeftColor: 'rgba(255,255,255,0.7)' },
  quotedSender: { fontSize: 11, fontWeight: '700', color: colors.brand },
  quotedText: { fontSize: 12, color: colors.muted },
});
