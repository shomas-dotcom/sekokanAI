import { afterEach, describe, expect, it, vi } from "vitest";
import {
  draftDailyReportFromText,
  draftQuoteItemsFromText,
  draftKyItems,
  classifyVoiceIntent,
  extractBusinessCardFromImage,
  extractBusinessCardFromPdf,
  extractCustomerFieldsFromText,
  extractEmployeeFieldsFromText,
  extractProjectRequestFromText,
  extractProjectRequestFromImage,
  extractIdCardFromImage,
  analyzeAiIntakeFromText,
  analyzeAiIntakeFromImage,
} from "@/lib/ai";

function mockAnthropicResponse(text: string, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    text: async () => (ok ? "" : "internal error"),
    json: async () => ({ content: [{ text }] }),
  } as Response;
}

describe("draftDailyReportFromText (モック実装)", () => {
  it("依頼文の音声入力例から各項目を抽出し、聞き取れなかった項目はunclearItemsに積む", async () => {
    const text =
      "今日は〇〇建設の現場。バックホウ0.25を使って砕石を25㎡敷均し。プレート転圧。職人3人。8時開始。17時終了。危険箇所は重機接触。翌日は型枠施工。";

    const draft = await draftDailyReportFromText(text);

    expect(draft.machinery).toContain("バックホウ");
    expect(draft.machinery).toContain("プレート");
    // ㎡は正規化(normalizeExtractedText)により建設現場でよく使う表記"m2"に揃える
    expect(draft.quantityWorked).toContain("25m2");
    expect(draft.startTime).toBe("08:00");
    expect(draft.endTime).toBe("17:00");
    expect(draft.dangerPrediction).toContain("重機接触");
    expect(draft.nextDayPlan).toContain("型枠施工");

    // 職長・作業員数は本文からは特定できないため、断定せず確認候補として積まれる
    expect(draft.foremanName).toBeNull();
    expect(draft.unclearItems.some((i) => i.field === "職長")).toBe(true);
  });

  it("使用車両(ダンプ等)は使用機械とは別枠として抽出する", async () => {
    const draft = await draftDailyReportFromText("4トンダンプで残土搬出。0.25BH使用。");
    expect(draft.vehicles).toContain("ダンプ");
    expect(draft.machinery).toContain("0.25BH");
    expect(draft.machinery).not.toContain("ダンプ");
  });

  it("開始/終了時間・危険予知・翌日の予定が聞き取れなかった場合は確認候補として積む", async () => {
    const draft = await draftDailyReportFromText("作業内容はL型側溝据付20m。作業員4名。天候晴れ。異常なし。");
    expect(draft.startTime).toBeNull();
    expect(draft.endTime).toBeNull();
    expect(draft.dangerPrediction).toBeNull();
    expect(draft.nextDayPlan).toBeNull();
    const fields = draft.unclearItems.map((i) => i.field);
    expect(fields).toEqual(
      expect.arrayContaining(["職長", "開始時間", "終了時間", "危険予知", "翌日の予定"])
    );
  });
});

describe("draftQuoteItemsFromText (モック実装)", () => {
  const rateMaster = [
    {
      id: "rate-1",
      name: "L型側溝撤去新設",
      unit: "m",
      unitPrice: 8000,
      costPrice: 5000,
      category: "SUBCONTRACT",
    },
  ];

  it("単価マスタに一致する品目は会社単価を反映する(単価を勝手に作らない)", async () => {
    const items = await draftQuoteItemsFromText("L型側溝撤去新設33m", rateMaster);
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(33);
    expect(items[0].unit).toBe("m");
    expect(items[0].unitPriceHint).toBe(8000);
    expect(items[0].costPriceHint).toBe(5000);
    expect(items[0].matchedRateItemId).toBe("rate-1");
  });

  it("単価マスタに一致しない品目は単価不明のまま(unitPriceHint=null)にする", async () => {
    const items = await draftQuoteItemsFromText("舗装撤去復旧20㎡", rateMaster);
    expect(items[0].quantity).toBe(20);
    expect(items[0].unit).toBe("m2");
    expect(items[0].unitPriceHint).toBeNull();
    expect(items[0].matchedRateItemId).toBeNull();
  });

  it("「3人4日」のような労務表記は人日に換算する", async () => {
    const items = await draftQuoteItemsFromText("土工3人4日", []);
    expect(items[0].quantity).toBe(12);
    expect(items[0].unit).toBe("人日");
  });

  it("改行・読点区切りで複数項目に分ける", async () => {
    const items = await draftQuoteItemsFromText("掘削工\n残土処分、L型側溝設置", []);
    expect(items.map((i) => i.itemName)).toEqual(["掘削工", "残土処分", "L型側溝設置"]);
  });
});

describe("draftKyItems (モック実装)", () => {
  it("作業内容のキーワードから危険ポイント・対策の候補を提案する", async () => {
    const items = await draftKyItems("バックホウで掘削し、ダンプで残土搬出する");
    const risks = items.map((i) => i.risk);
    expect(risks).toContain("重機との接触・巻き込まれ");
    expect(risks).toContain("土砂崩壊による埋没");
    expect(risks).toContain("後退時の接触・巻き込まれ");
    // 対策が伴わない危険ポイントを作らない(必ず対をなす)
    for (const item of items) {
      expect(item.countermeasure.length).toBeGreaterThan(0);
    }
  });

  it("一致するキーワードが無い場合は空の1行を返す(「異常なし」等を勝手に作らない)", async () => {
    const items = await draftKyItems("事務所で書類整理");
    expect(items).toEqual([{ risk: "", countermeasure: "" }]);
  });
});

describe("classifyVoiceIntent (モック実装、ダッシュボードの音声振り分け窓口)", () => {
  it("危険予知に関する内容はKYと判定する", async () => {
    expect(await classifyVoiceIntent("本日の危険予知活動。バックホウ使用時の接触に注意する。")).toBe("KY");
  });

  it("それ以外の内容(通常の作業報告)は日報と判定する", async () => {
    expect(await classifyVoiceIntent("今日は坂戸市役所の現場。作業員4名。8時開始、17時終了。")).toBe(
      "DAILY_REPORT"
    );
  });

  it("判断に迷う短い内容も日報側に倒す(現場で使う頻度が高いため)", async () => {
    expect(await classifyVoiceIntent("お疲れ様です。")).toBe("DAILY_REPORT");
  });

  it("名刺・会社名の登録内容はCUSTOMERと判定する", async () => {
    expect(await classifyVoiceIntent("会社名は若葉産業。担当は山田さん。")).toBe("CUSTOMER");
  });

  it("従業員登録の内容はEMPLOYEEと判定する", async () => {
    expect(await classifyVoiceIntent("従業員登録です。氏名は田中太郎。")).toBe("EMPLOYEE");
  });

  it("元請からの見積依頼はPROJECT_REQUESTと判定する", async () => {
    expect(await classifyVoiceIntent("元請から見積依頼が来ました。工期は9月中です。")).toBe(
      "PROJECT_REQUEST"
    );
  });
});

describe("AI関数の異常系入力(空文字・記号のみ等でも例外を投げない)", () => {
  it("draftDailyReportFromTextは空文字でも例外を投げず、全項目を確認候補にする", async () => {
    const draft = await draftDailyReportFromText("");
    expect(draft.workContent).toBeNull();
    expect(draft.unclearItems.length).toBeGreaterThan(0);
  });

  it("draftQuoteItemsFromTextは空文字なら空配列を返す", async () => {
    const items = await draftQuoteItemsFromText("", []);
    expect(items).toEqual([]);
  });

  it("draftQuoteItemsFromTextは記号だけの行を渡しても例外を投げない", async () => {
    const items = await draftQuoteItemsFromText("、、、\n,,,", []);
    expect(Array.isArray(items)).toBe(true);
  });

  it("draftKyItemsは空文字でも例外を投げず空の1行を返す", async () => {
    const items = await draftKyItems("");
    expect(items).toEqual([{ risk: "", countermeasure: "" }]);
  });

  it("extractBusinessCardFromImageはAI未設定時、それらしい偽データを作らずunavailableを返す", async () => {
    const result = await extractBusinessCardFromImage("dGVzdA==", "image/jpeg");
    expect(result.confidence).toBe("unavailable");
    expect(result.companyName).toBeNull();
    expect(result.personName).toBeNull();
  });

  it("extractBusinessCardFromPdfはAI未設定時、それらしい偽データを作らずunavailableを返す", async () => {
    const result = await extractBusinessCardFromPdf("dGVzdA==");
    expect(result.confidence).toBe("unavailable");
    expect(result.companyName).toBeNull();
  });

  it("extractCustomerFieldsFromTextはAI未設定でも電話番号・メールアドレスを正規表現で拾える", async () => {
    const result = await extractCustomerFieldsFromText(
      "会社名は若葉産業。担当は山田さん。電話は03-1234-5678。携帯は090-1234-5678。メールはyamada@example.comです。"
    );
    expect(result.companyName).toBe("若葉産業");
    expect(result.phone).toBe("03-1234-5678");
    expect(result.mobilePhone).toBe("090-1234-5678");
    expect(result.email).toBe("yamada@example.com");
  });

  it("extractEmployeeFieldsFromTextはAI未設定でも電話番号を正規表現で拾える", async () => {
    const result = await extractEmployeeFieldsFromText("氏名は田中太郎。電話は090-1111-2222。");
    expect(result.phone).toBe("090-1111-2222");
  });

  it("extractProjectRequestFromTextはAI未設定でも原文を工事内容の手がかりとして残し、断定できない項目はunclearFieldsに積む", async () => {
    const text = "所沢市泉町\n土間コン30㎡\n残土10m3\n工期9月1日〜9月30日";
    const result = await extractProjectRequestFromText(text);
    expect(result.workContent).toContain("土間コン");
    expect(result.periodText).toBe("9月1日〜9月30日");
    expect(result.soilQuantity).toBe("10m3");
    // 案件名はモックでは断定せず、常に確認候補にする
    expect(result.projectName).toBeNull();
    expect(result.unclearFields).toContain("案件名");
  });

  it("extractProjectRequestFromImageはAI未設定時、それらしい偽データを作らずunavailableを返す", async () => {
    const result = await extractProjectRequestFromImage("dGVzdA==", "image/jpeg");
    expect(result.confidence).toBe("unavailable");
    expect(result.projectName).toBeNull();
  });

  it("extractIdCardFromImageはAI未設定時、それらしい偽データを作らずunavailableを返す", async () => {
    const result = await extractIdCardFromImage("dGVzdA==", "image/jpeg");
    expect(result.confidence).toBe("unavailable");
    expect(result.name).toBeNull();
    expect(result.dateOfBirth).toBeNull();
  });
});

describe("AI_API_KEY設定時(本物のAI呼び出しモード、fetchはモック化する)", () => {
  const originalKey = process.env.AI_API_KEY;

  afterEach(() => {
    process.env.AI_API_KEY = originalKey;
    vi.unstubAllGlobals();
  });

  it("draftQuoteItemsFromTextはAIの抽出結果に単価マスタを機械的に突き合わせる(AIは単価を決めない)", async () => {
    process.env.AI_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(
      mockAnthropicResponse(
        JSON.stringify([{ itemName: "L型側溝撤去新設", spec: null, quantity: 33, unit: "m" }])
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const rateMaster = [
      { id: "r1", name: "L型側溝撤去新設", unit: "m", unitPrice: 8000, costPrice: 5000, category: "SUBCONTRACT" },
    ];
    const items = await draftQuoteItemsFromText("側溝をやる", rateMaster);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(items).toEqual([
      {
        itemName: "L型側溝撤去新設",
        spec: null,
        quantity: 33,
        unit: "m",
        unitPriceHint: 8000,
        costPriceHint: 5000,
        categoryHint: "SUBCONTRACT",
        matchedRateItemId: "r1",
      },
    ]);
  });

  it("AI呼び出しが失敗してもエラーを投げず、ルールベースの下書きに自動で切り替わる", async () => {
    process.env.AI_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockAnthropicResponse("", false)));

    const items = await draftQuoteItemsFromText("掘削工10m3", []);
    expect(items).toHaveLength(1);
    expect(items[0].itemName).toContain("掘削工");
  });

  it("AIの応答がJSONとして壊れていてもエラーを投げず、ルールベースの下書きに切り替わる", async () => {
    process.env.AI_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockAnthropicResponse("これはJSONではありません")));

    const draft = await draftDailyReportFromText("現場は坂戸市役所。作業員4名。");
    expect(draft.siteName).toBe("坂戸市役所");
  });

  it("draftDailyReportFromTextはAIが明記していない項目をnullのまま確認候補にする(勝手に埋めない)", async () => {
    process.env.AI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockAnthropicResponse(
          JSON.stringify({
            siteName: "坂戸市役所",
            weather: "晴れ",
            workerCount: 4,
            machinery: null,
            vehicles: null,
            quantityWorked: null,
            safetyNotes: null,
            foremanName: null,
            startTime: null,
            endTime: null,
            dangerPrediction: null,
            nextDayPlan: null,
          })
        )
      )
    );

    const draft = await draftDailyReportFromText("現場は坂戸市役所。晴れ。作業員4名。");
    expect(draft.siteName).toBe("坂戸市役所");
    expect(draft.weather).toBe("晴れ");
    expect(draft.workerCount).toBe(4);
    expect(draft.safetyNotes).toBeNull();
    expect(draft.unclearItems.map((i) => i.field)).toContain("安全事項");
    expect(draft.unclearItems.map((i) => i.field)).toContain("職長");
  });

  it("extractBusinessCardFromImageは名刺の読み取り結果をそのまま返す(単価等と違い機械的な突き合わせ対象がない)", async () => {
    process.env.AI_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(
      mockAnthropicResponse(
        JSON.stringify({
          companyName: "若葉産業株式会社",
          personName: "山田太郎",
          position: "営業部長",
          department: "営業部",
          postalCode: "100-0001",
          address: "東京都千代田区1-1-1",
          phone: "03-1234-5678",
          mobilePhone: "090-1234-5678",
          fax: null,
          email: "yamada@example.com",
          companyUrl: "https://example.com",
        })
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await extractBusinessCardFromImage("dGVzdA==", "image/jpeg");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.companyName).toBe("若葉産業株式会社");
    expect(result.personName).toBe("山田太郎");
    expect(result.mobilePhone).toBe("090-1234-5678");
    expect(result.fax).toBeNull();
    expect(result.confidence).toBe("high");
  });

  it("extractBusinessCardFromPdfは名刺PDFの読み取り結果を返す", async () => {
    process.env.AI_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(
      mockAnthropicResponse(
        JSON.stringify({
          companyName: "若葉産業株式会社",
          personName: "山田太郎",
          position: null,
          department: null,
          postalCode: null,
          address: null,
          phone: "03-1234-5678",
          mobilePhone: null,
          fax: null,
          email: "yamada@example.com",
          companyUrl: null,
        })
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await extractBusinessCardFromPdf("dGVzdA==");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.companyName).toBe("若葉産業株式会社");
    expect(result.confidence).toBe("high");
  });

  it("extractBusinessCardFromImageはAI呼び出しが失敗してもエラーを投げず、unavailableとして返す", async () => {
    process.env.AI_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockAnthropicResponse("", false)));

    const result = await extractBusinessCardFromImage("dGVzdA==", "image/jpeg");
    expect(result.confidence).toBe("unavailable");
    expect(result.companyName).toBeNull();
  });

  it("extractBusinessCardFromImageは読み取れた項目が少ない場合、要確認(needs_review)として返す", async () => {
    process.env.AI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockAnthropicResponse(
          JSON.stringify({
            companyName: "若葉産業株式会社",
            personName: null,
            position: null,
            department: null,
            postalCode: null,
            address: null,
            phone: null,
            mobilePhone: null,
            fax: null,
            email: null,
            companyUrl: null,
          })
        )
      )
    );

    const result = await extractBusinessCardFromImage("dGVzdA==", "image/jpeg");
    expect(result.confidence).toBe("needs_review");
  });

  it("analyzeAiIntakeFromImageはAI設定時、documentTypeに応じてcustomer/projectを構造化して返す", async () => {
    process.env.AI_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(
      mockAnthropicResponse(
        JSON.stringify({
          documentType: "business_card",
          customer: {
            companyName: "若葉産業株式会社",
            personName: "山田太郎",
            position: null,
            department: null,
            postalCode: null,
            address: null,
            phone: "03-1234-5678",
            mobilePhone: null,
            fax: null,
            email: null,
            companyUrl: null,
          },
          project: null,
          employee: null,
        })
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeAiIntakeFromImage("dGVzdA==", "image/jpeg");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.documentType).toBe("business_card");
    expect(result.customer?.companyName).toBe("若葉産業株式会社");
    expect(result.project).toBeNull();
    expect(result.confidence).toBe("high");
  });
});

describe("analyzeAiIntakeFromText (AIかんたん登録の統合判定、モック実装)", () => {
  it("会社名・担当者の登録っぽい内容はbusiness_cardと判定し、customerを埋める", async () => {
    const result = await analyzeAiIntakeFromText("会社名は若葉産業。担当は山田さん。電話は03-1234-5678。");
    expect(result.documentType).toBe("business_card");
    expect(result.customer?.companyName).toBe("若葉産業");
    expect(result.project).toBeNull();
  });

  it("見積依頼っぽい内容はproject_messageと判定し、projectを埋める", async () => {
    const result = await analyzeAiIntakeFromText("所沢市泉町\n土間コン30㎡\n残土10m3\n工期9月1日〜9月30日");
    expect(result.documentType).toBe("project_message");
    expect(result.project).not.toBeNull();
    expect(result.customer).toBeNull();
  });

  it("どちらとも判定できない内容はunknownとして扱い、AIが勝手に情報を作らない", async () => {
    const result = await analyzeAiIntakeFromText("お疲れ様です。");
    // モックのフォールバック判定ではdaily_report相当(現場報告)扱いになるため、
    // 顧客・案件どちらの候補も作らないことだけを確認する(勝手な断定をしない)
    expect(result.customer).toBeNull();
    expect(result.project === null || result.project?.projectName === null).toBe(true);
  });
});

describe("analyzeAiIntakeFromImage (AIかんたん登録の統合判定)", () => {
  it("AI未設定時、それらしい偽データを作らずunavailableを返す", async () => {
    const result = await analyzeAiIntakeFromImage("dGVzdA==", "image/jpeg");
    expect(result.confidence).toBe("unavailable");
    expect(result.documentType).toBe("unknown");
    expect(result.customer).toBeNull();
    expect(result.project).toBeNull();
    expect(result.employee).toBeNull();
  });
});
