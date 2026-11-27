import { redirect } from "next/navigation";

import { AuthForm } from "~/app/(auth)/_components/auth-form";
import { registerAction } from "~/app/(auth)/actions";
import { auth } from "~/server/auth";

export default async function RegisterPage() {
	if (await auth()) redirect("/");
	return <AuthForm action={registerAction} mode="register" />;
}
