export {};

declare global {
  interface Window {
    molty?: {
      getApiBase: () => Promise<string>;
      getLoginItemSettings?: () => Promise<{ openAtLogin: boolean; status?: string }>;
      setLoginItemSettings?: (
        openAtLogin: boolean
      ) => Promise<{ openAtLogin: boolean; status?: string }>;
      setTrayTitle?: (title: string) => Promise<{ ok: boolean }>;
      onWindowOpen?: (callback: () => void) => () => void;
      checkForUpdates?: () => Promise<{ status: string; error?: string }>;
    };
  }
}
