/** Photo limits (spec section 3): constants, not env vars, so every client fork behaves the same. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MiB, shown as "10 MB"; nginx allows 11m on the upload route
export const MAX_PHOTOS = 6;
export const MIN_SHORTER_SIDE = 480;
export const MAX_PIXELS = 40_000_000;
export const MAX_WEBP_SIDE = 16383;
export const WEBP_QUALITY = 80;
export const TARGET_LADDER = [480, 960, 1600] as const;
export const ALT_MAX = 125;
export const UPLOAD_LIMIT = 20;
export const UPLOAD_WINDOW_MS = 600_000;
export const LIMITER_JOBS = 2;
export const LIMITER_WAIT_MS = 10_000;
export const FILENAME_AUDIT_MAX = 120;
