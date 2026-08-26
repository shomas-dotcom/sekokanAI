import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { LandingPage } from "./LandingPage";

export default async function Home() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");
  return <LandingPage />;
}
