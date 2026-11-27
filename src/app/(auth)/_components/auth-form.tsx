"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { AuthFormState } from "~/app/(auth)/actions";

type AuthFormProps = {
	mode: "login" | "register";
	action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
};

const copy = {
	login: {
		title: "Zaloguj się",
		submit: "Zaloguj",
		pending: "Logowanie…",
		switchText: "Nie masz konta?",
		switchLink: "Załóż konto",
		switchHref: "/register",
		autoComplete: "current-password",
	},
	register: {
		title: "Załóż konto",
		submit: "Załóż konto",
		pending: "Zakładanie konta…",
		switchText: "Masz już konto?",
		switchLink: "Zaloguj się",
		switchHref: "/login",
		autoComplete: "new-password",
	},
} as const;

export function AuthForm({ mode, action }: AuthFormProps) {
	const [state, formAction, pending] = useActionState(action, {});
	const t = copy[mode];

	return (
		<main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] px-4 text-white">
			<form
				action={formAction}
				className="flex w-full max-w-sm flex-col gap-4 rounded-xl bg-white/10 p-6"
				noValidate
			>
				<h1 className="text-3xl font-bold">{t.title}</h1>

				{state.error && (
					<p
						className="rounded-md bg-red-500/20 px-3 py-2 text-sm"
						role="alert"
					>
						{state.error}
					</p>
				)}

				<label className="flex flex-col gap-1">
					<span className="text-sm">E-mail</span>
					<input
						aria-invalid={!!state.fieldErrors?.email}
						autoComplete="email"
						className="rounded-md bg-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-white/40"
						defaultValue={state.email}
						name="email"
						required
						type="email"
					/>
					{state.fieldErrors?.email && (
						<span className="text-sm text-red-300">
							{state.fieldErrors.email}
						</span>
					)}
				</label>

				<label className="flex flex-col gap-1">
					<span className="text-sm">Hasło</span>
					<input
						aria-invalid={!!state.fieldErrors?.password}
						autoComplete={t.autoComplete}
						className="rounded-md bg-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-white/40"
						name="password"
						required
						type="password"
					/>
					{state.fieldErrors?.password && (
						<span className="text-sm text-red-300">
							{state.fieldErrors.password}
						</span>
					)}
				</label>

				<button
					className="rounded-full bg-white/10 px-10 py-3 font-semibold transition hover:bg-white/20 disabled:opacity-50"
					disabled={pending}
					type="submit"
				>
					{pending ? t.pending : t.submit}
				</button>

				<p className="text-center text-sm">
					{t.switchText}{" "}
					<Link className="underline" href={t.switchHref}>
						{t.switchLink}
					</Link>
				</p>
			</form>
		</main>
	);
}
