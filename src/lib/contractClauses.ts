export type ContractClause = { key: string; title: string; text: string };

// この条項は工事内容・金額・工期・支払条件そのものであり、案件ごとに必ず内容が
// 変わる(=過去契約からの使い回しをしてはいけない)条項のキー。
export const ALWAYS_REGENERATE_CLAUSE_KEYS = new Set(["kouji_naiyou", "kingaku", "koki", "shiharai"]);

/**
 * 同じ顧客との過去契約(確定済み)がある場合に、条項を引き継ぐ。工事内容・金額・
 * 工期・支払条件(ALWAYS_REGENERATE_CLAUSE_KEYS)は必ず新しい内容(freshClauses)を
 * 使い、それ以外の条項は過去契約で編集された文面があればそちらを優先する
 * (REQUIREMENTS.md「重要な契約条項をAIが勝手に削除・変更しない」
 * 「今回変更が必要な情報だけを差し替える」方針)。
 */
export function mergeClausesWithPast(
  freshClauses: ContractClause[],
  pastClauses: ContractClause[] | null,
  alwaysRegenerateKeys: Set<string> = ALWAYS_REGENERATE_CLAUSE_KEYS
): ContractClause[] {
  if (!pastClauses) return freshClauses;
  const pastByKey = new Map(pastClauses.map((c) => [c.key, c]));
  return freshClauses.map((c) => (alwaysRegenerateKeys.has(c.key) ? c : (pastByKey.get(c.key) ?? c)));
}

export type ContractClauseInput = {
  projectName: string;
  siteAddress: string | null;
  overview: string | null;
  contractAmountExcludingTax: number;
  taxAmount: number;
  contractAmountIncludingTax: number;
  startDate: Date | null;
  endDate: Date | null;
  paymentTerms: string | null;
};

function formatDate(d: Date | null): string {
  return d ? d.toLocaleDateString("ja-JP") : "未定(要確認)";
}

function yen(n: number): string {
  return `${n.toLocaleString("ja-JP")}円`;
}

/**
 * 工事請負契約書の基本条項のデフォルト文面を生成する(一般的なひな形)。
 * 生成後は各条項をユーザーが編集できる(Contract.clausesJson)。
 * 法的有効性を保証するものではない — 画面上の免責注記(REQUIREMENTS.md #9)と必ず対で表示すること。
 */
export function buildDefaultClauses(input: ContractClauseInput): ContractClause[] {
  return [
    {
      key: "kouji_naiyou",
      title: "第1条(工事内容)",
      text: `受注者は、次の工事(以下「本工事」という。)を発注者のために誠実に施工するものとする。\n工事名: ${input.projectName}\n工事場所: ${input.siteAddress ?? "要確認"}\n工事概要: ${input.overview ?? "要確認"}`,
    },
    {
      key: "kingaku",
      title: "第2条(契約金額)",
      text: `本工事の契約金額は次のとおりとする。\n工事金額(税抜): ${yen(input.contractAmountExcludingTax)}\n消費税額: ${yen(input.taxAmount)}\n契約金額(税込): ${yen(input.contractAmountIncludingTax)}`,
    },
    {
      key: "koki",
      title: "第3条(工期)",
      text: `着手: ${formatDate(input.startDate)}\n完成: ${formatDate(input.endDate)}`,
    },
    {
      key: "shiharai",
      title: "第4条(支払方法)",
      text: input.paymentTerms
        ? `発注者は、次の支払条件により受注者に契約金額を支払うものとする。\n${input.paymentTerms}`
        : "支払条件は別途協議のうえ定める(要確認)。",
    },
    {
      key: "koji_henkou",
      title: "第5条(工事内容の変更)",
      text: "発注者及び受注者は、必要があると認めるときは、協議のうえ工事内容を変更できるものとする。工事内容の変更により契約金額または工期に影響が生じる場合は、双方協議のうえこれを変更する。",
    },
    {
      key: "tsuika_koji",
      title: "第6条(追加工事)",
      text: "発注者が追加工事を求める場合は、事前に受注者と協議し、別途見積書を取得したうえで契約金額及び工期の変更について合意するものとする。",
    },
    {
      key: "koki_henkou",
      title: "第7条(工期の変更)",
      text: "天災その他受注者の責によらない事由により工期内に工事を完成できないと認められるときは、受注者は発注者に工期の延長を求めることができる。",
    },
    {
      key: "kensa",
      title: "第8条(検査)",
      text: "受注者は、工事を完成したときは発注者にその旨を通知し、発注者は通知を受けた日から相当の期間内に検査を行うものとする。",
    },
    {
      key: "hikiwatashi",
      title: "第9条(引渡し)",
      text: "受注者は、前条の検査に合格した後、本工事の完成物を発注者に引渡すものとする。",
    },
    {
      key: "kashi",
      title: "第10条(契約不適合責任)",
      text: "引渡された工事の目的物が種類または品質に関して契約の内容に適合しないものであるときは、受注者は発注者との協議に基づき、修補その他の必要な措置を講じるものとする。",
    },
    {
      key: "songai",
      title: "第11条(損害の負担)",
      text: "工事の完成前に、天災その他双方の責によらない事由により本工事の完成物または材料等に損害が生じたときは、その損害の負担については双方協議のうえ定める。",
    },
    {
      key: "daisansha",
      title: "第12条(第三者に対する損害)",
      text: "本工事の施工に伴い第三者に損害を及ぼしたときは、受注者がその損害を賠償する。ただし、その損害が発注者の指示等に起因する場合は、発注者及び受注者が協議のうえ、その責任及び負担を定める。",
    },
    {
      key: "himitsu",
      title: "第13条(秘密保持)",
      text: "発注者及び受注者は、本契約の遂行を通じて知り得た相手方の業務上の秘密を、相手方の事前の承諾なく第三者に開示または漏洩してはならない。",
    },
    {
      key: "kaijo",
      title: "第14条(契約の解除)",
      text: "発注者または受注者は、相手方が本契約に違反し、相当の期間を定めた催告後もその違反が改善されない場合、本契約を解除することができる。",
    },
    {
      key: "hansha",
      title: "第15条(反社会的勢力の排除)",
      text: "発注者及び受注者は、自己または自己の役員等が暴力団その他の反社会的勢力に該当しないことを確約し、該当することが判明した場合、相手方は本契約を解除できるものとする。",
    },
    {
      key: "kyogi",
      title: "第16条(協議事項)",
      text: "本契約に定めのない事項及び本契約の条項の解釈について疑義が生じた場合は、発注者及び受注者が誠意をもって協議し、これを解決するものとする。",
    },
    {
      key: "kankatsu",
      title: "第17条(管轄裁判所)",
      text: "本契約に関する訴訟については、受注者の所在地を管轄する地方裁判所を第一審の専属的合意管轄裁判所とする(要確認: 発注者指定の管轄がある場合はそちらを優先する)。",
    },
    {
      key: "tokuyaku",
      title: "第18条(特約事項)",
      text: "特記事項がある場合はここに記載する。",
    },
  ];
}
