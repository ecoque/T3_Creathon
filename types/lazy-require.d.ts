// Ambient declaration for Metro's runtime-injected CommonJS `require`.
//
// This project has no expo-env.d.ts, so TypeScript otherwise has no idea
// `require` exists (there is no @types/node here either). We deliberately use
// `require('expo-print')` / `require('expo-sharing')` / `require('expo-camera')`
// INSIDE functions (never as a top-level `import`) to lazily load optional
// native modules — see lib/certificateExport usage in app/(tabs)/profile.tsx
// and app/profile/scan-badge.tsx. A top-level static import of these modules
// previously crashed the whole app on a Dev Client build that predates them
// (bkz. components/admin/AdminMapManagement.tsx için ilgili not) because
// Expo Router eagerly requires every file under app/ to build its route
// table at boot. Calling require() lazily inside a handler/effect defers
// module evaluation until the feature is actually used, so a stale Dev
// Client just fails that one action instead of crashing on launch.
declare function require(id: string): any;
