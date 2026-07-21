// MINIMAL DIAGNOSTIC LAYOUT — temporary.
// Strips out every provider, notification handler, socket, and auth so we can
// tell whether the launch crash is in app code or the SDK/Hermes toolchain.
// The real layout is backed up at mobile/_backup/_layout.tsx.
import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
