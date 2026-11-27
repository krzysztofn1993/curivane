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

/**
 * The signed-in user's id (`users.id`), parsed from the session. Branded, so data functions
 * (`forUser` in `src/server/data/`) accept only an id that went through this schema, not any
 * `string`. Lives here because the id comes from auth and this file imports only zod, so
 * `src/server/api/`, `src/server/data/` and tests can use it without pulling in next-auth or db.
 *
 * It only rejects, never transforms: an id with spaces at the edges is refused, not trimmed into a
 * different id. Max 255 characters, like `users.id` (`varchar(255)`).
 */
export const userIdSchema = z
	.string()
	.max(255, { error: "Identyfikator użytkownika jest za długi." })
	.refine((id) => id.trim().length > 0, {
		error: "Identyfikator użytkownika nie może być pusty.",
	})
	.refine((id) => id.trim() === id, {
		error:
			"Identyfikator użytkownika nie może zaczynać się ani kończyć spacją.",
	})
	.brand<"UserId">();

export type UserId = z.infer<typeof userIdSchema>;
