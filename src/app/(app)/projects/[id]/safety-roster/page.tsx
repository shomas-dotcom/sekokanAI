import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "@/components/PrintButton";
import { isExpired, isExpiringSoon } from "@/lib/qualifications";

const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  REGULAR: "正社員",
  PART_TIME: "パート・アルバイト",
  SUBCONTRACTOR: "一人親方・協力会社",
  OTHER: "その他",
};

// 作業員名簿・資格一覧(安全書類)。会社・従業員マスタと現場への割り当てから自動で
// 組み立てるだけの画面であり、新たな入力は求めない(依頼元の「二重入力を無くす」方針)。
export default async function SafetyRosterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const project = await prisma.project.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      customer: true,
      members: { include: { employee: { include: { qualifications: true } } } },
    },
  });
  if (!project) notFound();

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 print:p-0">
      <style>{`@media print { @page { size: A4; margin: 15mm 15mm; } }`}</style>
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <h1 className="text-center text-2xl font-bold text-zinc-900">作業員名簿・資格一覧</h1>

      <div className="mt-4 flex justify-between text-sm text-zinc-800">
        <div>
          <p className="font-semibold">工事名: {project.name}</p>
          <p>発注者: {project.orderingParty ?? "—"}</p>
          <p>現場住所: {project.siteAddress ?? "—"}</p>
        </div>
        <div className="text-right text-zinc-600">
          <p>{user.company.name}</p>
          <p>{project.customer.name}</p>
        </div>
      </div>

      {project.members.length === 0 ? (
        <p className="mt-6 rounded border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 print:hidden">
          この現場にはまだ作業員が割り当てられていません。案件詳細の「作業員」から従業員を割り当ててください。
        </p>
      ) : (
        <table className="mt-6 w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-2 border-zinc-300 text-zinc-600">
              <th className="py-2 pr-2 font-medium">氏名</th>
              <th className="py-2 pr-2 font-medium">役職</th>
              <th className="py-2 pr-2 font-medium">雇用区分</th>
              <th className="py-2 font-medium">保有資格(有効期限)</th>
            </tr>
          </thead>
          <tbody>
            {project.members.map((m) => (
              <tr key={m.id} className="border-b border-zinc-200 align-top">
                <td className="py-2 pr-2 font-medium text-zinc-900">{m.employee.name}</td>
                <td className="py-2 pr-2 text-zinc-700">{m.employee.position ?? "—"}</td>
                <td className="py-2 pr-2 text-zinc-700">
                  {EMPLOYMENT_TYPE_LABEL[m.employee.employmentType]}
                </td>
                <td className="py-2 text-zinc-700">
                  {m.employee.qualifications.length === 0 ? (
                    "—"
                  ) : (
                    <ul>
                      {m.employee.qualifications.map((q) => {
                        const expired = isExpired(q.expiresAt);
                        const soon = isExpiringSoon(q.expiresAt);
                        return (
                          <li key={q.id} className={expired ? "text-rose-600" : soon ? "text-amber-600" : ""}>
                            {q.name}
                            {q.expiresAt && `(${q.expiresAt.toLocaleDateString("ja-JP")}まで)`}
                            {expired && " 期限切れ"}
                            {soon && !expired && " 期限間近"}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="mt-6 text-xs text-zinc-400 print:mt-10">
        この一覧は従業員マスタ・現場マスタの登録内容から自動作成されています。実際の提出前に、資格証等の原本と照合してください。
      </p>
    </div>
  );
}
