import { z } from "zod";

export const emailSchema = z
	.string()
	.trim()
	.toLowerCase()
	.pipe(z.email({ error: "Podaj poprawny adres e-mail." }).max(255));

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const passwordSchema = z
	.string()
	.min(PASSWORD_MIN_LENGTH, {
		error: `Hasło musi mieć co najmniej ${PASSWORD_MIN_LENGTH} znaków.`,
	})
	.max(PASSWORD_MAX_LENGTH, {
		error: `Hasło może mieć najwyżej ${PASSWORD_MAX_LENGTH} znaków.`,
	});

/** Login only checks shape; strength rules apply at registration. */
export const loginSchema = z.object({
	email: emailSchema,
	password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

export const registerSchema = z.object({
	email: emailSchema,
	password: passwordSchema,
});
