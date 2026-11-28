import { describe, expect, it } from "vitest";
import {
  MIN_FRACTION,
  balanceLabel,
  radarInsight,
  radarPoint,
  radarPoints,
  toPointsAttr,
  weakestIndex,
} from "@/components/report/radar";

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe("radarPoint", () => {
  it("puts the first axis straight up", () => {
    const [x, y] = radarPoint(0, 5, 1, 100, 0, 0);
    close(x, 0);
    close(y, -100);
  });

  it("goes clockwise", () => {
    const [x] = radarPoint(1, 5, 1, 100, 0, 0);
    expect(x).toBeGreaterThan(0);
  });
});

describe("radarPoints", () => {
  it("scales 100 to the full radius and clamps out-of-range values", () => {
    const [, top] = radarPoints([100], 100, 0, 0)[0];
    close(top, -100);
    const [, over] = radarPoints([150], 100, 0, 0)[0];
    close(over, -100);
  });

  it("keeps a zero just off the centre", () => {
    const [, y] = radarPoints([0], 100, 0, 0)[0];
    close(y, -100 * MIN_FRACTION);
    const [, neg] = radarPoints([-20], 100, 0, 0)[0];
    close(neg, -100 * MIN_FRACTION);
  });
});

it("formats SVG points", () => {
  expect(toPointsAttr([[1, 2.345], [3.05, 4]])).toBe("1.0,2.3 3.0,4.0");
});

describe("balance", () => {
  it("labels by spread", () => {
    expect(balanceLabel([80, 80, 60, 80, 70])).toBe("even");
    expect(balanceLabel([80, 80, 50, 80, 70])).toBe("a bit uneven");
    expect(balanceLabel([90, 80, 20, 80, 70])).toBe("uneven");
  });

  it("highlights the weakest only when uneven", () => {
    expect(weakestIndex([80, 80, 60, 80, 70])).toBeNull();
    expect(weakestIndex([82, 80, 40, 60, 60])).toBe(2);
  });

  it("names strongest and weakest skills", () => {
    const axes = ["answers", "clarity", "pace"].map((label, i) => ({ label, value: [82, 80, 40][i] }));
    expect(radarInsight(axes)).toEqual({ strongest: "answers", weakest: "pace" });
    expect(radarInsight(axes.map((a) => ({ ...a, value: 70 })))).toEqual({ even: 70 });
  });
});
