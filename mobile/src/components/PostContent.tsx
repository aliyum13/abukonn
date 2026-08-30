import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useThemedStyles } from '../theme/ThemeContext';
import type { Palette } from '../theme';
import { StyleSheet } from 'react-native';
import { apiFetch } from '../lib/api';

// The canonical content tokeniser. Exported so anything that needs to agree
// with what BECOMES a link -- notably the composer's live hashtag highlight --
// reuses this exact pattern instead of keeping a second copy that can drift.
// Split form keeps the delimiters; test form matches a single token.
export const CONTENT_TOKEN_RE = /(#[a-zA-Z0-9_]+|@[a-zA-Z0-9_]{2,30})/g;
export const HASHTAG_RE = /^#[a-zA-Z0-9_]+$/;

/**
 * Renders post/comment text with tappable #hashtags and @mentions, matching web.
 * - #tag  -> hashtag browse screen
 * - @name -> resolves the username to a user id, then opens their profile
 * Plain text (including newlines) renders normally.
 */
export function PostContent({ content, style, numberOfLines }: { content: string; style?: object; numberOfLines?: number }) {
  const s = useThemedStyles(make_s);
  const router = useRouter();

  const openHashtag = (tag: string) =>
    router.push({ pathname: '/hashtag/[tag]', params: { tag: tag.toLowerCase() } });

  const openMention = async (username: string) => {
    try {
      const user = await apiFetch<{ id: number }>(`/api/users/username/${encodeURIComponent(username)}`);
      if (user?.id) router.push({ pathname: '/user/[id]', params: { id: String(user.id) } });
    } catch {
      // Unknown username — do nothing rather than navigate somewhere wrong.
    }
  };

  // Split on #tag or @mention while keeping the delimiters, same regex as web.
  const parts = content.split(CONTENT_TOKEN_RE);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, i) => {
        if (HASHTAG_RE.test(part)) {
          return (
            <Text key={i} style={s.link} onPress={() => openHashtag(part.slice(1))}>
              {part}
            </Text>
          );
        }
        if (/^@[a-zA-Z0-9_]{2,30}$/.test(part)) {
          return (
            <Text key={i} style={s.link} onPress={() => openMention(part.slice(1))}>
              {part}
            </Text>
          );
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}

const make_s = (colors: Palette) => StyleSheet.create({
  link: { color: colors.brand, fontWeight: '600' },
});
