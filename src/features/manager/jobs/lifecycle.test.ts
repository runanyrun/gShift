import { describe, expect, it } from "vitest";
import { canTransitionJobStatus } from "./lifecycle";

describe("manager job lifecycle transitions", () => {
  it("allows open to close and cancel", () => {
    expect(canTransitionJobStatus("open", "close")).toBe(true);
    expect(canTransitionJobStatus("open", "cancel")).toBe(true);
  });

  it("allows closed to reopen and cancel but not close", () => {
    expect(canTransitionJobStatus("closed", "reopen")).toBe(true);
    expect(canTransitionJobStatus("closed", "cancel")).toBe(true);
    expect(canTransitionJobStatus("closed", "close")).toBe(false);
  });

  it("treats cancelled as terminal", () => {
    expect(canTransitionJobStatus("cancelled", "close")).toBe(false);
    expect(canTransitionJobStatus("cancelled", "cancel")).toBe(false);
    expect(canTransitionJobStatus("cancelled", "reopen")).toBe(false);
  });
});
