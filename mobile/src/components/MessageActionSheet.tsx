import { useEffect } from 'react';
import { useThemedStyles } from '../theme/ThemeContext';
import type { Palette } from '../theme';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, BackHandler } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { colors } from '../theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface MessageAction {
  label: string;
  icon: IoniconName;
  onPress: () => void;
  destructive?: boolean;
}

/**
 * The long-press menu for a chat message.
 *
 * Why this exists instead of Alert.alert: RN maps an Android alert onto
 * AlertDialog's three button slots and silently discards everything else --
 * Alert.js does `buttons.slice(0, 3)`. The message menus had grown to six
 * entries (Reply / Forward / Copy / Edit / Delete / Cancel), so on Android
 * every option from index 3 onward simply never rendered: Edit and Delete were
 * unreachable, and Cancel disappeared with them. iOS renders all buttons, which
 * is why this only ever surfaced on Android.
 *
 * A sheet has no such limit -- the action list scrolls -- so the menu can hold
 * as many actions as it needs and adding one more can never silently push
 * another off the end. Follows MenuSheet's Modal/backdrop pattern so it matches
 * the rest of the app.
 *
 * Deliberately scoped to message menus. The app-wide confirm/alert component is
 * separate, larger work; this is not that, and it can absorb or replace this
 * later.
 */
export function MessageActionSheet({ visible, title, actions, onClose }: {
  visible: boolean;
  title: string;
  actions: MessageAction[];
  onClose: () => void;
}) {
  const s = useThemedStyles(make_s);

  // Explicit hardware-back handling, alongside the Modal's own onRequestClose
  // below. onRequestClose is RN's documented Android back-button hook for a
  // Modal and should already close this sheet on its own -- but the reported
  // behaviour was that back did NOT dismiss it, only tapping an option did.
  // This listener is added only while visible, so on Android's LIFO dispatch
  // it is called before any other registered listener and its `return true`
  // consumes the event -- back closes the sheet instead of also popping the
  // screen behind it. Costs nothing to keep alongside onRequestClose: onClose
  // is idempotent (setMenuMsg(null) when it's already null is a no-op), so
  // having both fire is harmless if onRequestClose turns out fine after all.
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  // Dismiss first, then run. Presenting another Modal (the edit sheet, the
  // forward sheet) while this one is still on screen is unreliable on iOS --
  // the second can silently fail to appear. The short delay lets this sheet
  // finish sliding out; it is imperceptible for actions that open nothing.
  const run = (fn: () => void) => {
    onClose();
    setTimeout(fn, 220);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Tapping the backdrop dismisses. Alert.alert defaults to
          cancelable:false, so on Android the dialog ignored outside taps --
          and once Cancel was truncated away, the hardware back button was the
          only way out of it at all. */}
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={s.sheet} activeOpacity={1}>
          <View style={s.handle} />
          <Text style={s.title}>{title}</Text>
          <ScrollView>
            {actions.map(a => (
              <TouchableOpacity key={a.label} style={s.row} onPress={() => run(a.onPress)}>
                <Ionicons
                  name={a.icon}
                  size={21}
                  color={a.destructive ? colors.danger : colors.brand}
                  style={s.icon}
                />
                <Text style={[s.label, a.destructive ? s.labelDestructive : null]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {/* Always present, and structurally impossible to truncate here. */}
          <TouchableOpacity style={s.cancel} onPress={onClose}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const make_s = (colors: Palette) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingBottom: 34, paddingTop: 10, maxHeight: '70%',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 10 },
  title: { fontSize: 13, fontWeight: '700', color: colors.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  icon: { width: 24, textAlign: 'center' },
  label: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
  labelDestructive: { color: colors.danger },
  cancel: { marginTop: 12, paddingVertical: 14, alignItems: 'center', borderRadius: 12, backgroundColor: colors.surfaceSubtle },
  cancelText: { fontSize: 16, fontWeight: '700', color: colors.textSecondary },
});
