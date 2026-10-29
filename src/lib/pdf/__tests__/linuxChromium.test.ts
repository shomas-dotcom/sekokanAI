import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { prepareLinuxChromiumLibraries, resolveChromiumBinDir } from "@/lib/pdf/linuxChromium";

describe("resolveChromiumBinDir", () => {
  it("@sparticuz/chromium の圧縮ファイルの場所を返し、共有ライブラリの圧縮ファイルがそこにある", () => {
    const binDir = resolveChromiumBinDir();
    expect(existsSync(path.join(binDir, "chromium.br"))).toBe(true);
    expect(existsSync(path.join(binDir, "al2023.tar.br"))).toBe(true);
  });
});

describe("prepareLinuxChromiumLibraries", () => {
  it("共有ライブラリを展開し、/tmp/al2023/lib を読み込み先に加える(Lambda等と判定されない環境でも)", async () => {
    const inflated: string[] = [];
    const libDirs: string[] = [];
    const libDir = await prepareLinuxChromiumLibraries(
      {
        inflate: async (filePath) => {
          inflated.push(filePath);
          return filePath;
        },
        setupLambdaEnvironment: (dir) => libDirs.push(dir),
      },
      "/app/node_modules/@sparticuz/chromium/bin"
    );
    expect(inflated).toEqual([path.join("/app/node_modules/@sparticuz/chromium/bin", "al2023.tar.br")]);
    expect(libDir).toBe(path.join(tmpdir(), "al2023", "lib"));
    expect(libDirs).toEqual([libDir]);
  });

  it("展開に失敗したら、読み込み先を変えずにエラーを伝える(PDFの画面で失敗を表示するため)", async () => {
    const libDirs: string[] = [];
    await expect(
      prepareLinuxChromiumLibraries(
        {
          inflate: async () => {
            throw new Error("展開できません");
          },
          setupLambdaEnvironment: (dir) => libDirs.push(dir),
        },
        "/bin"
      )
    ).rejects.toThrow("展開できません");
    expect(libDirs).toEqual([]);
  });
});
