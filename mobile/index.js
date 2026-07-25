// Custom entry point.
//
// package.json previously pointed `main` straight at `expo-router/entry`. That
// left no place to run anything before the router's module graph is evaluated —
// and evaluating that graph is exactly when the iOS launch crash happened, so
// there was nothing to catch it and no message to read.
//
// Order matters here: install the handler, THEN load the router. require() is
// used rather than import so the sequencing is explicit and not subject to
// hoisting.
const early = require('./src/lib/earlyErrorHandler');

early.install();

try {
  require('expo-router/entry');
} catch (error) {
  // A module in the router graph threw while loading. Without this the process
  // aborts (SIGABRT) with no readable cause; instead we register a root
  // component that prints the error on the device.
  early.showFatal(error);
}
