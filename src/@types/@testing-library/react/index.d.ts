declare module "@testing-library/react" {
  export function render(ui: any): any;
  export const screen: {
    getByTestId: (...args: any[]) => any;
  };
  export function waitFor(cb: () => any): Promise<void>;
}
