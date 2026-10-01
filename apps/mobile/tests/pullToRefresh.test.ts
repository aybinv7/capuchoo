import { expect, test } from "vite-plus/test";
import {
  indicatorOffset,
  isArmed,
  overpullRotation,
  pullFraction,
} from "../src/shared/utils/motion/pullToRefresh.js";

test("the pull moves the indicator at half the finger's speed up to the 80dp threshold", () => {
  expect(pullFraction(0)).toBe(0);
  expect(pullFraction(80)).toBe(0.5);
  expect(pullFraction(160)).toBe(1);
  expect(indicatorOffset(0)).toBe(-48);
  expect(indicatorOffset(1)).toBe(32);
  expect(isArmed(160)).toBe(false);
  expect(isArmed(161)).toBe(true);
});

test("past the threshold the pull meets tension and stops at twice the threshold", () => {
  const justPast = pullFraction(200) - pullFraction(160);
  const farPast = pullFraction(520) - pullFraction(480);
  expect(justPast).toBeGreaterThan(farPast);
  expect(pullFraction(10_000)).toBe(2);
  expect(overpullRotation(0.8)).toBe(0);
  expect(overpullRotation(1.5)).toBe(-90);
});
