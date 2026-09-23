import { createContext } from 'react';

/**
 * The context object alone, in its own file.
 *
 * Three files for one concern looks fussy, and there are two reasons for it. Fast
 * refresh can only hot-replace a module that exports components and nothing else,
 * so mixing the provider with the context object would remount the tree — and
 * remounting AuthProvider re-runs the boot refresh and loses the in-memory token
 * on every save. The second reason is duller: AuthProvider.jsx and authContext.js
 * differ by more than a capital letter, because Windows and macOS filesystems are
 * case-insensitive and `AuthContext.jsx` beside `authContext.js` is the same name
 * to them.
 */
export const AuthContext = createContext(null);
