import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';

/**
 * In a release build an unhandled JS error goes straight to RCTFatal, which
 * aborts the process — the user just sees the app vanish, and the crash report
 * only shows the native abort, never the JS message.
 *
 * This catches those errors and shows them instead, so a failure is diagnosable
 * from the device rather than needing a symbolicated crash log.
 */

type Props = { children: React.ReactNode };
type State = { error: Error | null; info: string | null };

function ErrorScreen({ error, info, onRetry }: { error: Error; info: string | null; onRetry: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#fff', paddingTop: Platform.OS === 'ios' ? 60 : 30 }}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: '#b91c1c' }}>Something broke</Text>
        <Text style={{ marginTop: 4, fontSize: 13, color: '#666' }}>
          Please screenshot this and send it to the ABUkonn team.
        </Text>
      </View>
      <ScrollView style={{ flex: 1, paddingHorizontal: 20 }}>
        <Text selectable style={{ fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 6 }}>
          {error.name}: {error.message}
        </Text>
        {error.stack ? (
          <Text selectable style={{ fontSize: 11, color: '#444', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
            {error.stack}
          </Text>
        ) : null}
        {info ? (
          <Text selectable style={{ fontSize: 11, color: '#666', marginTop: 12 }}>
            {info}
          </Text>
        ) : null}
        <View style={{ height: 40 }} />
      </ScrollView>
      <TouchableOpacity
        onPress={onRetry}
        style={{ margin: 20, backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
      >
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack?: string }) {
    this.setState({ info: errorInfo?.componentStack ?? null });
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorScreen
          error={this.state.error}
          info={this.state.info}
          onRetry={() => this.setState({ error: null, info: null })}
        />
      );
    }
    return this.props.children;
  }
}

/**
 * Render errors are caught by the boundary above, but errors thrown outside
 * React (in a promise, a timer, a native callback) bypass it and abort the app.
 * Routing those into the same screen means we see the message instead of a
 * silent close.
 */
let installed = false;
export function installGlobalErrorHandler(onError: (error: Error, isFatal: boolean) => void) {
  if (installed) return;
  installed = true;

  const globalAny = global as unknown as {
    ErrorUtils?: {
      getGlobalHandler: () => (error: Error, isFatal?: boolean) => void;
      setGlobalHandler: (h: (error: Error, isFatal?: boolean) => void) => void;
    };
  };

  const ErrorUtils = globalAny.ErrorUtils;
  if (!ErrorUtils) return;

  const previous = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    try {
      onError(error, !!isFatal);
    } catch {
      /* never let the reporter itself crash the app */
    }
    // Keep the default behaviour for non-fatal errors so dev logging still works.
    if (!isFatal && typeof previous === 'function') previous(error, isFatal);
  });
}
