// Minimal ambient types for node:async_hooks (provided at runtime by the `nodejs_als` compat flag;
// not declared by @cloudflare/workers-types). Only the surface src/catalog.ts uses.
declare module 'node:async_hooks' {
  export class AsyncLocalStorage<T> {
    getStore(): T | undefined
    run<R>(store: T, callback: () => R): R
  }
}
