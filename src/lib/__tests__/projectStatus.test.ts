import { describe, expect, it } from "vitest";
import { computeAdvancedStatus } from "@/lib/projectStatus";

describe("computeAdvancedStatus", () => {
  it("見込みの現場は見積受注で「受注」まで進める", () => {
    expect(computeAdvancedStatus("LEAD", "CONTRACTED")).toBe("CONTRACTED");
    expect(computeAdvancedStatus("ESTIMATING", "CONTRACTED")).toBe("CONTRACTED");
  });

  it("契約確定で「施工中」まで進める", () => {
    expect(computeAdvancedStatus("CONTRACTED", "IN_PROGRESS")).toBe("IN_PROGRESS");
  });

  it("既により先のステータスにある場合は後退させない", () => {
    expect(computeAdvancedStatus("IN_PROGRESS", "CONTRACTED")).toBeNull();
    expect(computeAdvancedStatus("COMPLETED", "IN_PROGRESS")).toBeNull();
  });

  it("失注(LOST)の現場は自動で動かさない", () => {
    expect(computeAdvancedStatus("LOST", "CONTRACTED")).toBeNull();
  });

  it("既に同じステータスの場合は変化なし", () => {
    expect(computeAdvancedStatus("CONTRACTED", "CONTRACTED")).toBeNull();
  });
});
