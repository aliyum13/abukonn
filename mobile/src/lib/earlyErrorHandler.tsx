/**
 * The first thing the app runs — before expo-router, before any screen, before
 * React mounts.
 *
 * Why this has to be here and not in a component: in a release build an
 * uncaught JS error is handed to RCTExceptionsManager, which calls RCTFatal and
 * raises an Obj-C exception, so the process aborts with SIGABRT. The crash
 * report then shows only the native abort (`abort() called`, faulting queue
 * com.facebook.react.ExceptionsManagerQueue) and never the JS message.
 *
 * Crucially, that can happen while modules are still being *evaluated* — a
 * missing native module, a bad import — which is before any ErrorBoundary
 * inside app/_layout.tsx exists. An in-tree boundary cannot catch it. Hence two
 * guards, both installed from the entry file:
 *
 *   1. A global ErrorUtils handler that swallows fatal errors instead of
 *      letting them reach RCTFatal.
 *   2. A fallback root component, registered when the entry itself throws while
 *      loading, so a module-evaluation failure renders a readable screen rather
 *      than aborting the process.
 */
import React from 'react';
import { AppRegistry, Platform, ScrollView, Text, View } from 'react-native';

type FatalListener = (error: Error) => void;

let installed = false;
let capturedFatal: Error | null = null;
const listeners = new Set<FatalListener>();

function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  if (typeof value === 'string') return new Error(value);
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(String(value));
  }
}

/** The error already captured before anything mounted, if there was one. */
export function getCapturedFatal(): Error | null {
  return capturedFatal;
}

/**
 * Let the mounted tree take over reporting. Once a listener exists the in-app
 * ErrorBoundary renders the error, which looks better and keeps navigation.
 */
export function subscribeToFatal(listener: FatalListener): () => void {
  listeners.add(listener);
  if (capturedFatal) listener(capturedFatal);
  return () => {
    listeners.delete(listener);
  };
}

function FatalScreen({ error }: { error: Error }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#fff', paddingTop: Platform.OS === 'ios' ? 60 : 30 }}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: '#b91c1c' }}>ABUkonn couldn&apos;t start</Text>
        <Text style={{ marginTop: 4, fontSize: 13, color: '#666' }}>
          Please screenshot this and send it to the ABUkonn team.
        </Text>
      </View>
      <ScrollView style={{ flex: 1, paddingHorizontal: 20 }}>
        <Text selectable style={{ fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 6 }}>
          {error.name}: {error.message}
        </Text>
        {error.stack ? (
          <Text
            selectable
            style={{ fontSize: 11, color: '#444', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}
          >
            {error.stack}
          </Text>
        ) : null}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

/**
 * Replace the root component with the error screen. Safe to call while the
 * bundle is still executing: on iOS the native side calls runApplication only
 * once the bundle has finished, so a registration made here is the one used.
 */
export function showFatal(value: unknown) {
  const error = toError(value);
  capturedFatal = error;
  console.log('[ABUkonn] startup failure:', error.message, error.stack);
  try {
    AppRegistry.registerComponent('main', () => function FatalRoot() {
      return <FatalScreen error={error} />;
    });
  } catch {
    /* nothing else we can do — at least the log above went out */
  }
}

export function install() {
  if (installed) return;
  installed = true;

  const globalAny = global as unknown as {
    ErrorUtils?: {
      getGlobalHandler?: () => (error: unknown, isFatal?: boolean) => void;
      setGlobalHandler?: (h: (error: unknown, isFatal?: boolean) => void) => void;
    };
  };

  const ErrorUtils = globalAny.ErrorUtils;
  if (!ErrorUtils?.setGlobalHandler) return;

  const previous = ErrorUtils.getGlobalHandler?.();

  ErrorUtils.setGlobalHandler((value: unknown, isFatal?: boolean) => {
    // Non-fatal errors keep the default behaviour so dev logging still works.
    if (!isFatal) {
      if (typeof previous === 'function') previous(value, isFatal);
      return;
    }

    const error = toError(value);
    capturedFatal = error;
    console.log('[ABUkonn] fatal JS error:', error.message, error.stack);

    // If the tree is up, let it render the error in context.
    if (listeners.size > 0) {
      for (const listener of [...listeners]) {
        try {
          listener(error);
        } catch {
          /* never let the reporter itself crash the app */
        }
      }
      return;
    }

    // Nothing mounted yet — swap in the fallback root instead of aborting.
    showFatal(error);
  });
}
