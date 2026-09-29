import { isGoogleConfigured } from "@/lib/googleAuth";
import { getMonitorSignupStatus } from "@/lib/monitor";
import { RegisterForm } from "./RegisterForm";

// login/page.tsxと同じ理由で、環境変数の状態を必ずリクエストごとに評価する。
// モニターの残り枠も常に最新の値を出す必要があるため同様。
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const googleEnabled = isGoogleConfigured();
  const monitorStatus = await getMonitorSignupStatus();
  return <RegisterForm googleEnabled={googleEnabled} monitorStatus={monitorStatus} />;
}
