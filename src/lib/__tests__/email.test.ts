import { afterEach, describe, expect, it, vi } from "vitest";
import { maskEmail, sendEmail } from "@/lib/email";

const params = {
  to: "tanaka@example.com",
  subject: "【現場AI】パスワード再設定",
  text: "https://example.com/reset-password?token=SECRET_TOKEN",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("sendEmail", () => {
  it("本番でメール設定がないときは本文(リンク)をログに出さず、失敗として返す", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(sendEmail(params)).rejects.toThrow();

    const logged = [...log.mock.calls, ...warn.mock.calls].flat().join("\n");
    expect(logged).not.toContain("SECRET_TOKEN");
    expect(logged).not.toContain("tanaka@example.com");
  });

  it("開発中でメール設定がないときは本文をログに出して成功扱い(動作確認用)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("RESEND_API_KEY", "");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(sendEmail(params)).resolves.toBeUndefined();
    expect(log.mock.calls.flat().join("\n")).toContain("SECRET_TOKEN");
  });

  it("メールサービスがエラーを返したら呼び出し元へ失敗を伝える", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(sendEmail(params)).rejects.toThrow("status=500");
  });

  it("送信に成功したら何も投げない", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));

    await expect(sendEmail(params)).resolves.toBeUndefined();
  });
});

describe("maskEmail", () => {
  it("宛先の先頭2文字とドメインだけ残す", () => {
    expect(maskEmail("tanaka@example.com")).toBe("ta***@example.com");
    expect(maskEmail("not-an-address")).toBe("***");
  });
});
