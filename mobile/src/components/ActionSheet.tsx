import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useThemedStyles } from '../theme/ThemeContext';
import type { Palette } from '../theme';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, BackHandler } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { colors } from '../theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface ActionSheetAction {
  label: string;
  /** Optional: rows without an icon just start at the left edge. */
  icon?: IoniconName;
  onPress: () => void;
  destructive?: boolean;
}

/**
 * The app's one "pick an action" menu: a bottom sheet with a list of actions and an
 * always-present Cancel row.
 *
 * Why this exists instead of Alert.alert: RN maps an Android alert onto AlertDialog's
 * three button slots and silently discards everything else -- Alert.js does
 * `buttons.slice(0, 3)`. A menu with four entries (Report post / Report user / Block user /
 * Cancel) therefore lost its LAST one on Android, and that last one is Cancel. On top of
 * that, Alert.alert defaults to `cancelable: false` on Android, so tapping outside or
 * pressing Back did nothing -- the menu could not be dismissed without choosing an action.
 * iOS renders every button, which is why this only ever surfaced on Android.
 *
 * A sheet has no button limit (the action list scrolls), Cancel is structurally always
 * there, and three things close it: the Cancel row, a tap on the backdrop, and the
 * hardware Back button.
 *
 * Use this for MENUS (a list of choices). A yes/no confirmation is still an Alert.alert,
 * but give it `{ cancelable: true }` so Android's Back button / outside tap dismisses it
 * like Cancel.
 *
 * Two ways to use it:
 *   - <ActionSheet visible title actions onClose /> when the screen already tracks which
 *     item the menu is for (the chat message menus);
 *   - const { show, element } = useActionSheet(); show('Post options', [...]); and render
 *     {element} once -- for menus that are just "tap, pick".
 */
export function ActionSheet({ visible, title, subtitle, actions, onClose }: {
  visible: boolean;
  title: string;
  subtitle?: string;
  actions: ActionSheetAction[];
  onClose: () => void;
}) {
  const s = useThemedStyles(make_s);

  // Explicit hardware-back handling, alongside the Modal's own onRequestClose below.
  // onRequestClose is RN's documented Android back-button hook for a Modal and should
  // already close this sheet on its own -- but the reported behaviour (for the message
  // menu this was written for) was that back did NOT dismiss it. This listener is added
  // only while visible, so on Android's LIFO dispatch it is called before any other
  // registered listener and its `return true` consumes the event -- back closes the sheet
  // instead of also popping the screen behind it. onClose must be idempotent (closing an
  // already-closed sheet is a no-op), so both firing is harmless.
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  // Dismiss first, then run. Presenting another Modal or an Alert (an edit sheet, a
  // confirmation) while this one is still on screen is unreliable on iOS -- the second can
  // silently fail to appear. The short delay lets this sheet finish sliding out; it is
  // imperceptible for actions that open nothing.
  const run = (fn: () => void) => {
    onClose();
    setTimeout(fn, 220);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Tapping the backdrop dismisses (Alert.alert ignored outside taps on Android). */}
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={s.sheet} activeOpacity={1}>
          <View style={s.handle} />
          <Text style={s.title}>{title}</Text>
          {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
          <ScrollView>
            {actions.map(a => (
              <TouchableOpacity key={a.label} style={s.row} onPress={() => run(a.onPress)}>
                {a.icon ? (
                  <Ionicons
                    name={a.icon}
                    size={21}
                    color={a.destructive ? colors.danger : colors.brand}
                    style={s.icon}
                  />
                ) : null}
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

/**
 * Imperative wrapper for menus that need no state of their own:
 *
 *   const { show, element } = useActionSheet();
 *   ... show('Post options', [{ label: 'Report post', icon: 'flag-outline', onPress }]);
 *   ... {element}   // once, anywhere in the screen's JSX
 *
 * The last config is kept while the sheet slides out so the rows don't blank mid-animation.
 */
export function useActionSheet(): {
  show: (title: string, actions: ActionSheetAction[], subtitle?: string) => void;
  element: ReactElement;
} {
  const [visible, setVisible] = useState(false);
  const [cfg, setCfg] = useState<{ title: string; subtitle?: string; actions: ActionSheetAction[] }>(
    { title: '', actions: [] },
  );
  const show = useCallback((title: string, actions: ActionSheetAction[], subtitle?: string) => {
    setCfg({ title, subtitle, actions });
    setVisible(true);
  }, []);
  const close = useCallback(() => setVisible(false), []);
  const element = (
    <ActionSheet visible={visible} title={cfg.title} subtitle={cfg.subtitle} actions={cfg.actions} onClose={close} />
  );
  return { show, element };
}

const make_s = (colors: Palette) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingBottom: 34, paddingTop: 10, maxHeight: '70%',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 10 },
  title: { fontSize: 13, fontWeight: '700', color: colors.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 4 },
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
