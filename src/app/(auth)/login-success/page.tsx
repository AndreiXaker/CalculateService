import { Suspense } from "react";
import AuthPage from "./AuthPage";

export default function LoginPage() {
  return (
    <Suspense>
      <AuthPage />
    </Suspense>
  )
}