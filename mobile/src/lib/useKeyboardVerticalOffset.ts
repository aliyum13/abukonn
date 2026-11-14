import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// keyboardVerticalOffset for the screens whose input bar is pinned under a
// header (chat, group chat, post comments). Pair it with ComposerBar, which
// handles the other half of the same problem (the Android navigation bar).
//
// iOS: 90 -- unchanged.
//
// Android: the status-bar inset, NOT 90. This build is edge-to-edge (Expo
// SDK 54 default), where the window is not resized for the keyboard, so these
// screens use KeyboardAvoidingView behavior='height'. In that mode RN computes
//   shrink = frame.y + frame.height - (keyboardTop - keyboardVerticalOffset)
// where frame.y is relative to the screen's SafeAreaView (whose own top sits
// statusBarInset below the screen top), so the offset that lands the input bar
// exactly on the keyboard is the status-bar inset. A hardcoded 90 over-shrinks
// the view by (90 - inset), which is the gap between the input bar and the
// keyboard (about one input-row high on a 24dp status bar).
//
// This only holds while the KeyboardAvoidingView sits directly under a
// SafeAreaView with edges={['top']}, as it does on those three screens. A
// KeyboardAvoidingView inside a Modal has its own geometry; don't reuse this
// there.
export function useKeyboardVerticalOffset(): number {
  const insets = useSafeAreaInsets();
  return Platform.OS === 'ios' ? 90 : insets.top;
}
