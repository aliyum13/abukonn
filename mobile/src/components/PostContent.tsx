import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useThemedStyles } from '../theme/ThemeContext';
import type { Palette } from '../theme';
import { StyleSheet } from 'react-native';
import { apiFetch } from '../lib/api';

/**
 * Renders post/comment text with tappable #hashtags and @mentions, matching web.
 * - #tag  -> hashtag browse screen
 * - @name -> resolves the username to a user id, then opens their profile
 * Plain text (including newlines) renders normally.
 */
export function PostContent({ content, style }: { content: string; style?: object }) {
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
  const parts = content.split(/(#[a-zA-Z0-9_]+|@[a-zA-Z0-9_]{2,30})/g);

  return (
    <Text style={style}>
      {parts.map((part, i) => {
        if (/^#[a-zA-Z0-9_]+$/.test(part)) {
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
