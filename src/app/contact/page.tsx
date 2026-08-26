import { LegalPageLayout } from "@/components/LegalPageLayout";

export default function ContactPage() {
  return (
    <LegalPageLayout title="お問い合わせ">
      <p>
        本サービスに関するお問い合わせは、下記の連絡先までご連絡ください。
      </p>
      <div className="rounded-xl border border-slate-200 p-4">
        <p className="font-semibold text-slate-900">連絡先(仮)</p>
        <p className="mt-1 text-slate-500">
          ここに正式な問い合わせ用メールアドレス・電話番号を記載してください。現時点では未設定です。
        </p>
      </div>
    </LegalPageLayout>
  );
}
