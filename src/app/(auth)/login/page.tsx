import { redirect } from "next/navigation";

import { AuthForm } from "~/app/(auth)/_components/auth-form";
import { loginAction } from "~/app/(auth)/actions";
import { auth } from "~/server/auth";

export default async function LoginPage() {
	if (await auth()) redirect("/");
	return <AuthForm action={loginAction} mode="login" />;
}
