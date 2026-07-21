interface ImportMetaEnv {
  readonly VITE_PRESERVE_DRAWING_BUFFER?: string;
  readonly VITE_BUILD_REVISION?: string;
  readonly VITE_ENABLE_LEGACY_SHORTCUTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
