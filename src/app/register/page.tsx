import { isGoogleConfigured } from "@/lib/googleAuth";
import { RegisterForm } from "./RegisterForm";

// login/page.tsxと同じ理由で、環境変数の状態を必ずリクエストごとに評価する。
export const dynamic = "force-dynamic";

export default function RegisterPage() {
  const googleEnabled = isGoogleConfigured();
  return <RegisterForm googleEnabled={googleEnabled} />;
}
