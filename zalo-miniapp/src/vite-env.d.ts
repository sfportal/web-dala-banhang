/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_OA_ID?: string;
  readonly VITE_HOTLINE?: string;
}
declare module '*.png' { const src: string; export default src; }
