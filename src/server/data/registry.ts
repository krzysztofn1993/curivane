import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";

import {
	accounts,
	sessions,
	users,
	verificationTokens,
} from "~/server/db/schema";

/**
 * A Drizzle table owned by a single user: it has a text `userId` column pointing at `users.id`.
 */
export type OwnedTable = PgTable & {
	userId: AnyPgColumn<{ dataType: "string"; data: string }>;
};

export type UserOwnedEntry = {
	table: OwnedTable;
	/** Short Polish description of the kind of data (used by the account export in S-02). */
	description: string;
};

export type UserDataRegistry = {
	userOwned: UserOwnedEntry[];
	auth: PgTable[];
	shared: PgTable[];
};

/**
 * Every table in `src/server/db/schema.ts` belongs to exactly one group here.
 *
 * - `userOwned`: a user's own data. Read and write these tables only through `forUser` from
 *   `~/server/data`, which adds the owner condition to every query. A new table of user data:
 *   - goes into `userOwned` with a Polish `description`;
 *   - has a `userId` column with a foreign key to `users.id` and `onDelete: "cascade"`, so deleting
 *     the account deletes its rows;
 *   - has an index on `userId`, because every query filters by it;
 *   - uses `userId` as its primary key only when it holds one row per user (e.g. settings).
 * - `auth`: tables managed by next-auth and the auth code (`src/server/auth/`, `(auth)/actions.ts`).
 * - `shared`: data that belongs to no single user.
 */
export const userDataRegistry: UserDataRegistry = {
	userOwned: [],
	auth: [users, accounts, sessions, verificationTokens],
	shared: [],
};
