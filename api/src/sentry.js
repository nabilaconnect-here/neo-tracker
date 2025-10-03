import * as Sentry from '@sentry/node';
export function initSentry(dsn){ if(!dsn) return null; Sentry.init({dsn,tracesSampleRate:1.0}); return Sentry; }
