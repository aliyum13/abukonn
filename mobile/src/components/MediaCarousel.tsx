import { useState, useRef } from 'react';
import {
  View, ScrollView, Image, TouchableOpacity, StyleSheet,
  useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { optimizedImage } from '../lib/image';
import { useThemedStyles } from '../theme/ThemeContext';
import type { Palette } from '../theme';

export interface MediaItem {
  id: number;
  media_url: string;
  media_type: 'image' | 'video';
  thumbnail_url: string | null;
  duration_seconds: number | null;
  position: number;
}

// One video in the carousel. Each video owns its own player instance via the
// useVideoPlayer hook -- which is why this is a separate component rather than
// an inline branch in the map(): hooks can't be called conditionally or in a
// loop body, so each video item gets its own component so the hook is called
// unconditionally at that component's top level. Doesn't autoplay (bad for
// mobile data); shows native controls, tap to play.
function VideoItem({ item, width }: { item: MediaItem; width: number }) {
  const player = useVideoPlayer(item.media_url, p => {
    p.loop = false;
  });
  return (
    <VideoView
      player={player}
      style={{ width, height: width }}
      contentFit="contain"
      nativeControls
      allowsFullscreen
    />
  );
}

// Renders a post's media[] (Pro multi-media: 1-3 images/video, any mix).
// Shared across the feed, post detail, and profile screens -- mirrors web's
// MediaCarousel. A horizontally-paged ScrollView with dot indicators; images
// tap out to the caller's lightbox, videos play inline via expo-video.
export function MediaCarousel({
  items, onOpenImage,
}: {
  items: MediaItem[] | null | undefined;
  onOpenImage: (url: string) => void;
}) {
  const s = useThemedStyles(makeStyles);
  const { width: screenWidth } = useWindowDimensions();
  // The carousel sits inside the post card, which has horizontal padding; the
  // media area is the screen width minus that. 32 = 16px padding each side,
  // matching the card's existing content insets.
  const itemWidth = screenWidth - 32;
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  if (!items || items.length === 0) return null;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / itemWidth);
    setActiveIdx(Math.max(0, Math.min(items.length - 1, idx)));
  };

  return (
    <View style={s.wrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        scrollEnabled={items.length > 1}
      >
        {items.map(item => (
          <View key={item.id} style={{ width: itemWidth, height: itemWidth }}>
            {item.media_type === 'video' ? (
              <VideoItem item={item} width={itemWidth} />
            ) : (
              <TouchableOpacity activeOpacity={0.9} onPress={() => onOpenImage(item.media_url)}>
                <Image
                  source={{ uri: optimizedImage(item.media_url) }}
                  style={{ width: itemWidth, height: itemWidth }}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>

      {items.length > 1 ? (
        <View style={s.dots}>
          {items.map((item, i) => (
            <View key={item.id} style={[s.dot, i === activeIdx ? s.dotActive : null]} />
          ))}
        </View>
      ) : null}

      {items.length > 1 ? (
        <View style={s.counter}>
          <Ionicons name="images-outline" size={12} color="#fff" />
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  wrap: { marginTop: 10, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.surface, position: 'relative' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, paddingVertical: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { width: 16, backgroundColor: colors.brand },
  counter: {
    position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3,
  },
});
