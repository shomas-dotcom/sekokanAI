import { describe, expect, it } from "vitest";
import { computeInvoicePaymentStatus } from "@/lib/invoicePaymentStatus";

const now = new Date("2026-08-29T00:00:00Z");

describe("computeInvoicePaymentStatus", () => {
  it("入金済み(PAID)はstatusに関わらずPAIDを返す", () => {
    expect(computeInvoicePaymentStatus({ status: "PAID", dueDate: null }, now)).toBe("PAID");
  });

  it("DRAFT・CANCELLEDは対象外(null)を返す", () => {
    expect(computeInvoicePaymentStatus({ status: "DRAFT", dueDate: null }, now)).toBeNull();
    expect(computeInvoicePaymentStatus({ status: "CANCELLED", dueDate: null }, now)).toBeNull();
  });

  it("支払期限未設定のISSUEDはNO_DUE_DATEを返す", () => {
    expect(computeInvoicePaymentStatus({ status: "ISSUED", dueDate: null }, now)).toBe("NO_DUE_DATE");
  });

  it("支払期限を過ぎたISSUEDはOVERDUEを返す", () => {
    const dueDate = new Date("2026-08-01T00:00:00Z");
    expect(computeInvoicePaymentStatus({ status: "ISSUED", dueDate }, now)).toBe("OVERDUE");
  });

  it("支払期限が7日以内のISSUEDはDUE_SOONを返す", () => {
    const dueDate = new Date("2026-09-03T00:00:00Z");
    expect(computeInvoicePaymentStatus({ status: "ISSUED", dueDate }, now)).toBe("DUE_SOON");
  });

  it("支払期限がまだ先のISSUEDはUPCOMINGを返す", () => {
    const dueDate = new Date("2026-10-01T00:00:00Z");
    expect(computeInvoicePaymentStatus({ status: "ISSUED", dueDate }, now)).toBe("UPCOMING");
  });
});
