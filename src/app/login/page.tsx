import { Suspense } from "react";
import { isGoogleConfigured } from "@/lib/googleAuth";
import { LoginForm } from "./LoginForm";

// 静的プリレンダーされるとGOOGLE_CLIENT_ID等の環境変数の状態がビルド時点で
// 固定されてしまい、環境変数を変えても再デプロイするまで反映されなくなるため、
// 必ずリクエストごとに評価する。
export const dynamic = "force-dynamic";

export default function LoginPage() {
  const googleEnabled = isGoogleConfigured();
  return (
    <Suspense fallback={null}>
      <LoginForm googleEnabled={googleEnabled} />
    </Suspense>
  );
}
