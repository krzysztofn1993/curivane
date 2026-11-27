"use server";

import { AuthError } from "next-auth";
import { z } from "zod";

import { signIn } from "~/server/auth";
import { hashPassword } from "~/server/auth/password";
import { registerSchema } from "~/server/auth/validation";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";

export type AuthFormState = {
	error?: string;
	fieldErrors?: { email?: string; password?: string };
	email?: string;
};

async function signInWithPassword(
	email: string,
	password: string,
): Promise<AuthFormState> {
	try {
		// On success this throws Next's redirect, which must propagate.
		await signIn("credentials", { email, password, redirectTo: "/" });
	} catch (error) {
		if (error instanceof AuthError) {
			return { error: "Nieprawidłowy e-mail lub hasło.", email };
		}
		throw error;
	}
	return {};
}

export async function loginAction(
	_prev: AuthFormState,
	formData: FormData,
): Promise<AuthFormState> {
	const email = String(formData.get("email") ?? "");
	const password = String(formData.get("password") ?? "");
	return signInWithPassword(email, password);
}

export async function registerAction(
	_prev: AuthFormState,
	formData: FormData,
): Promise<AuthFormState> {
	const rawEmail = String(formData.get("email") ?? "");
	const parsed = registerSchema.safeParse({
		email: rawEmail,
		password: formData.get("password"),
	});
	if (!parsed.success) {
		const { fieldErrors } = z.flattenError(parsed.error);
		return {
			fieldErrors: {
				email: fieldErrors.email?.[0],
				password: fieldErrors.password?.[0],
			},
			email: rawEmail,
		};
	}

	const { email, password } = parsed.data;
	const inserted = await db
		.insert(users)
		.values({ email, passwordHash: await hashPassword(password) })
		.onConflictDoNothing({ target: users.email })
		.returning({ id: users.id });

	if (inserted.length === 0) {
		return {
			fieldErrors: { email: "Konto z tym adresem e-mail już istnieje." },
			email: rawEmail,
		};
	}

	return signInWithPassword(email, password);
}
