/**
 * React Router v7 behaviour, opted into now.
 *
 * Both of these are default in v7. Turning them on while the app is four screens
 * big means the upgrade is a version bump rather than a debugging session, and it
 * keeps the router's deprecation warnings out of the test output — where a real
 * warning would otherwise be lost among them.
 */
export const ROUTER_FUTURE = Object.freeze({
  v7_startTransition: true,
  v7_relativeSplatPath: true,
});
