import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import type { DefaultSession, NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { getDummyHash, verifyPassword } from "~/server/auth/password";
import { loginSchema } from "~/server/auth/validation";
import { db } from "~/server/db";
import {
	accounts,
	sessions,
	users,
	verificationTokens,
} from "~/server/db/schema";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
	interface Session extends DefaultSession {
		user: {
			id: string;
		} & DefaultSession["user"];
	}
}

/**
 * E-mail + password login (decision recorded in context/foundation/shape-notes.md, 2026-11-26).
 *
 * The Credentials provider only works with JWT sessions, so `session.strategy` is "jwt".
 * The Drizzle adapter stays wired in so OAuth providers can be added later without
 * schema changes.
 *
 * @see https://authjs.dev/getting-started/authentication/credentials
 */
export const authConfig = {
	providers: [
		Credentials({
			credentials: {
				email: { label: "E-mail", type: "email" },
				password: { label: "Hasło", type: "password" },
			},
			authorize: async (credentials) => {
				const parsed = loginSchema.safeParse(credentials);
				if (!parsed.success) return null;
				const { email, password } = parsed.data;

				const user = await db.query.users.findFirst({
					where: eq(users.email, email),
				});

				if (!user?.passwordHash) {
					// Same work as a real check, so response time does not reveal
					// whether the account exists.
					await verifyPassword(password, await getDummyHash());
					return null;
				}

				const valid = await verifyPassword(password, user.passwordHash);
				if (!valid) return null;

				return { id: user.id, email: user.email, name: user.name };
			},
		}),
	],
	adapter: DrizzleAdapter(db, {
		usersTable: users,
		accountsTable: accounts,
		sessionsTable: sessions,
		verificationTokensTable: verificationTokens,
	}),
	session: { strategy: "jwt" },
	pages: {
		signIn: "/login",
	},
	callbacks: {
		jwt: ({ token, user }) => {
			if (user?.id) token.sub = user.id;
			return token;
		},
		session: ({ session, token }) => ({
			...session,
			user: {
				...session.user,
				id: token.sub ?? "",
			},
		}),
	},
} satisfies NextAuthConfig;
