import { and, eq, type SQL } from "drizzle-orm";
import type {
	AnyPgColumn,
	PgDatabase,
	PgQueryResultHKT,
	PgTable,
} from "drizzle-orm/pg-core";

import { type UserId, userIdSchema } from "~/server/auth/validation";

import type { OwnedTable, UserDataRegistry } from "./registry";

/**
 * Any Drizzle Postgres database: the app's postgres-js instance or a test instance built from a
 * different schema object. Kept as a parameter so this file never imports `~/server/db`.
 */
// biome-ignore lint/suspicious/noExplicitAny: the factory must accept a database for any schema.
type AnyPgDatabase = PgDatabase<PgQueryResultHKT, any, any>;

/** Row values without `userId`: the owner always comes from the session, never from the caller. */
type WithoutUserId<T> = Omit<T, "userId"> & { userId?: never };

export type OwnedRow<T extends OwnedTable> = T["$inferSelect"];
export type OwnedInsert<T extends OwnedTable> = WithoutUserId<
	T["$inferInsert"]
>;
export type OwnedUpdate<T extends OwnedTable> = WithoutUserId<
	Partial<T["$inferInsert"]>
>;

type OrderBy = SQL | AnyPgColumn;

export type FindManyOptions = {
	where?: SQL | undefined;
	orderBy?: OrderBy | OrderBy[] | undefined;
	limit?: number | undefined;
};

export type FindFirstOptions = Omit<FindManyOptions, "limit">;

/**
 * Data functions bound to one user. Every query adds `userId = <session user>`:
 * - `insert` always writes the session's `userId`; a `userId` key smuggled into `values` is
 *   overwritten;
 * - `update` never changes `userId`; a `userId` key in `set` is dropped;
 * - `update` and `delete` require a `where` condition.
 */
export type UserData = {
	findMany<T extends OwnedTable>(
		table: T,
		opts?: FindManyOptions,
	): Promise<OwnedRow<T>[]>;
	findFirst<T extends OwnedTable>(
		table: T,
		opts?: FindFirstOptions,
	): Promise<OwnedRow<T> | null>;
	insert<T extends OwnedTable>(
		table: T,
		values: OwnedInsert<T> | OwnedInsert<T>[],
	): Promise<OwnedRow<T>[]>;
	update<T extends OwnedTable>(
		table: T,
		set: OwnedUpdate<T>,
		where: SQL,
	): Promise<OwnedRow<T>[]>;
	delete<T extends OwnedTable>(table: T, where: SQL): Promise<OwnedRow<T>[]>;
};

/**
 * Builds `forUser(userId)`. The only way to reach `userOwned` tables; see `registry.ts`.
 *
 * `userId` is a branded `UserId` (parse it with `userIdSchema` from `~/server/auth/validation`), so a
 * plain `string` does not type-check. It is parsed again at runtime, so an empty or whitespace-only
 * id smuggled in with a cast still throws a `ZodError`.
 */
export function createUserData(
	db: AnyPgDatabase,
	registry: UserDataRegistry,
): (userId: UserId) => UserData {
	const ownedTables = new Set<PgTable>(
		registry.userOwned.map((entry) => entry.table),
	);

	function assertOwned(table: OwnedTable) {
		if (!ownedTables.has(table)) {
			throw new Error(
				"User data: table is not registered in userDataRegistry.userOwned.",
			);
		}
	}

	function assertWhere(where: SQL | undefined, fn: string) {
		if (!where) {
			throw new Error(`User data: ${fn}() requires a where condition.`);
		}
	}

	return (input) => {
		const userId = userIdSchema.parse(input);

		const owner = (table: OwnedTable, where?: SQL) =>
			and(eq(table.userId, userId), where);

		const findMany = async <T extends OwnedTable>(
			table: T,
			opts: FindManyOptions = {},
		): Promise<OwnedRow<T>[]> => {
			assertOwned(table);
			let query = db
				.select()
				.from(table as PgTable)
				.where(owner(table, opts.where))
				.$dynamic();
			if (opts.orderBy) {
				query = query.orderBy(
					...(Array.isArray(opts.orderBy) ? opts.orderBy : [opts.orderBy]),
				);
			}
			if (opts.limit !== undefined) {
				query = query.limit(opts.limit);
			}
			return (await query) as OwnedRow<T>[];
		};

		return {
			findMany,

			async findFirst(table, opts = {}) {
				const rows = await findMany(table, { ...opts, limit: 1 });
				return rows[0] ?? null;
			},

			async insert(table, values) {
				assertOwned(table);
				const list = Array.isArray(values) ? values : [values];
				if (list.length === 0) return [];
				// The session's userId goes last, so it wins over any userId the caller slipped in.
				const rows = list.map((row) => ({ ...row, userId }));
				return (await db
					.insert(table as PgTable)
					.values(rows as PgTable["$inferInsert"][])
					.returning()) as OwnedRow<typeof table>[];
			},

			async update(table, set, where) {
				assertOwned(table);
				assertWhere(where, "update");
				// Ownership cannot be transferred: userId is dropped from the changes.
				const { userId: _ignored, ...changes } = set as Record<string, unknown>;
				if (Object.keys(changes).length === 0) {
					throw new Error("User data: update() has no columns to change.");
				}
				return (await db
					.update(table as PgTable)
					.set(changes)
					.where(owner(table, where))
					.returning()) as OwnedRow<typeof table>[];
			},

			async delete(table, where) {
				assertOwned(table);
				assertWhere(where, "delete");
				return (await db
					.delete(table as PgTable)
					.where(owner(table, where))
					.returning()) as OwnedRow<typeof table>[];
			},
		};
	};
}
