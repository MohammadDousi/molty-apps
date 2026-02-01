export {};

declare global {
  interface Window {
    molty: {
      getApiBase: () => Promise<string>;
    };
  }
}
