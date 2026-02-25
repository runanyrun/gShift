declare module "vitest" {
  export const describe: (...args: any[]) => any;
  export const it: (...args: any[]) => any;
  export const expect: (...args: any[]) => any;
  export const vi: {
    fn: (...args: any[]) => any;
    stubGlobal: (...args: any[]) => any;
    useFakeTimers: (...args: any[]) => any;
    setSystemTime: (...args: any[]) => any;
    useRealTimers: (...args: any[]) => any;
    restoreAllMocks: (...args: any[]) => any;
  };
  export const beforeEach: (...args: any[]) => any;
  export const afterEach: (...args: any[]) => any;
}

declare module "vitest/config" {
  export function defineConfig(config: any): any;
}
