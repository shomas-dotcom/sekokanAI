import { LegalPageLayout } from "@/components/LegalPageLayout";

export default function ContactPage() {
  return (
    <LegalPageLayout title="お問い合わせ">
      <p>
        本サービスに関するお問い合わせは、下記の連絡先までご連絡ください。
      </p>
      <div className="rounded-xl border border-slate-200 p-4">
        <p className="font-semibold text-slate-900">杉本土木株式会社</p>
        <p className="mt-1 text-slate-700">TEL/FAX: 04-2930-8299</p>
        <p className="mt-1 text-slate-700">
          メール:{" "}
          <a href="mailto:shoma.s@sugidoboku.com" className="text-indigo-700 underline">
            shoma.s@sugidoboku.com
          </a>
        </p>
      </div>
    </LegalPageLayout>
  );
}
