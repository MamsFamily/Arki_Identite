import { AsyncLocalStorage } from "node:async_hooks";

// Request-local preview only. Never change the stored account or its grants.
const view = new AsyncLocalStorage<string>();
export function isPlayerView(userId: string) { return view.getStore() === userId; }
export function runInPlayerView(userId: string, callback: () => void) { view.run(userId, callback); }