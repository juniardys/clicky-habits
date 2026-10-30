import { describe, expect, test } from "bun:test";
import { isSparse } from "./chart";

const days = (counts: number[]) => counts.map((count) => ({ count }));

describe("isSparse", () => {
  test("fewer than 3 active days is sparse", () => {
    expect(isSparse(days([0, 0, 0]))).toBe(true);
    expect(isSparse(days([0, 4, 0, 1]))).toBe(true);
  });

  test("3 or more active days is not sparse", () => {
    expect(isSparse(days([1, 0, 2, 0, 5]))).toBe(false);
  });
});
