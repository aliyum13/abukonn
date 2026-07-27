import { Modal, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Full-screen image viewer — tap anywhere (or the X) to close. Originally
 * built inline in feed.tsx for post images; extracted here once news.tsx
 * needed the exact same thing rather than duplicating the modal a second
 * time. Always pass the raw, un-optimized image URL — this is specifically
 * the "see it clearly at full resolution" view, as distinct from whatever
 * cropped/optimizedImage() thumbnail led here.
 */
export function ImageLightbox({ url, onClose }: { url: string | null; onClose: () => void }) {
  return (
    <Modal visible={!!url} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={s.close} onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
        {url ? <Image source={{ uri: url }} style={s.image} resizeMode="contain" /> : null}
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center',
  },
  close: {
    position: 'absolute', top: 56, right: 20, zIndex: 1,
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  image: { width: '100%', height: '80%' },
});
