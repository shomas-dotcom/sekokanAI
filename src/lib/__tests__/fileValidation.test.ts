import { describe, expect, it } from "vitest";
import { validateImageFile, MAX_IMAGE_BYTES } from "@/lib/fileValidation";

describe("validateImageFile", () => {
  it("許可された画像形式は通す", () => {
    expect(validateImageFile({ type: "image/jpeg", size: 1000 })).toBeNull();
    expect(validateImageFile({ type: "image/png", size: 1000 })).toBeNull();
    expect(validateImageFile({ type: "image/webp", size: 1000 })).toBeNull();
  });

  it("SVG等スクリプトを含み得る形式は拒否する(XSS対策)", () => {
    expect(validateImageFile({ type: "image/svg+xml", size: 1000 })).not.toBeNull();
  });

  it("画像以外のファイルは拒否する", () => {
    expect(validateImageFile({ type: "application/pdf", size: 1000 })).not.toBeNull();
  });

  it("空のファイルは拒否する", () => {
    expect(validateImageFile({ type: "image/jpeg", size: 0 })).not.toBeNull();
  });

  it("上限サイズを超えるファイルは拒否する", () => {
    expect(validateImageFile({ type: "image/jpeg", size: MAX_IMAGE_BYTES + 1 })).not.toBeNull();
  });

  it("上限サイズちょうどは許可する", () => {
    expect(validateImageFile({ type: "image/jpeg", size: MAX_IMAGE_BYTES })).toBeNull();
  });
});
