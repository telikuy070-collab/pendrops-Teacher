/**
 * Deprecated compatibility shim.
 *
 * This file was an early draft of centralized configuration. All configuration
 * has been consolidated into `src/config/admin.js` (which uses JSDoc-typed
 * JavaScript and is not type-checked via `tsc`).
 *
 * Existing imports should use `ADMIN_CONFIG` from `./admin.js` directly.
 */
export { ADMIN_CONFIG } from './admin.js';
