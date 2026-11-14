import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// The bottom input bar shared by chat, group chat and post comments, so the
// three behave identically around the system UI.
//
// Android is edge-to-edge (Expo SDK 54 default): app content draws underneath
// the navigation bar (three buttons or the gesture pill). These screens use
// SafeAreaView edges={['top']}, so nothing pads the bottom and the bar's
// buttons sat under the navigation bar whenever the keyboard was closed.
//
// So: with the keyboard closed, add the bottom safe-area inset INSIDE the bar
// (it keeps the bar's own background and border, rather than leaving an
// unstyled strip under it). With the keyboard open the inset must be dropped:
// the keyboard already covers the navigation bar, and KeyboardAvoidingView
// (see useKeyboardVerticalOffset) lands this bar exactly on the keyboard's top
// edge, so any extra padding would show up as a gap above the keyboard.
// iOS is left as it was.
function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(() => Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return visible;
}

export function ComposerBar({ style, children }: { style: StyleProp<ViewStyle>; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const flat = StyleSheet.flatten(style) ?? {};
  const base = Number(flat.paddingBottom ?? flat.padding ?? 0);
  const clearNavBar = Platform.OS === 'android' && !keyboardVisible ? insets.bottom : 0;
  return <View style={[style, { paddingBottom: base + clearNavBar }]}>{children}</View>;
}
