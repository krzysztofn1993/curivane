import { eq, inArray, type SQL, sql } from "drizzle-orm";
import { integer, pgTable, varchar } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { type UserId, userIdSchema } from "~/server/auth/validation";

import { accounts, users } from "~/server/db/schema";

import { createUserData } from "./user-data";

/**
 * Test-only owned table, created by `test/global-setup.ts`. Declared with `pgTable` (not
 * `createTable`) and without the `curivane_` prefix, so drizzle-kit ignores it and it never shows
 * up in schema.ts or the registry test.
 */
const ownedItems = pgTable("test_fixture_owned_item", {
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	userId: varchar({ length: 255 })
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	name: varchar({ length: 256 }).notNull(),
});

const url = process.env.DATABASE_URL ?? "";
if (!new URL(url).pathname.endsWith("_test")) {
	throw new Error(
		"user-data.test.ts: DATABASE_URL must point at a *_test database; refusing to run.",
	);
}

const client = postgres(url, { max: 1, onnotice: () => {} });
const testDb = drizzle(client);

const forUser = createUserData(testDb, {
	userOwned: [{ table: ownedItems, description: "Rekordy testowe" }],
	auth: [],
	shared: [],
});

let createdUserIds: string[] = [];

async function createUser() {
	const id = crypto.randomUUID();
	await testDb.insert(users).values({ id, email: `${id}@example.test` });
	createdUserIds.push(id);
	return userIdSchema.parse(id);
}

const rowsInDb = (where: SQL) => testDb.select().from(ownedItems).where(where);

let userA: UserId;
let userB: UserId;

beforeEach(async () => {
	userA = await createUser();
	userB = await createUser();
});

afterEach(async () => {
	if (createdUserIds.length > 0) {
		await testDb.delete(users).where(inArray(users.id, createdUserIds));
	}
	createdUserIds = [];
});

afterAll(async () => {
	await client.end();
});

describe("forUser: insert", () => {
	it("always writes the session's userId", async () => {
		const [row] = await forUser(userA).insert(ownedItems, {
			name: "A's item",
			// @ts-expect-error: userId is not accepted from the caller.
			userId: userB,
		});
		expect(row?.userId).toBe(userA);

		const stored = await rowsInDb(eq(ownedItems.id, row?.id ?? -1));
		expect(stored.map((r) => r.userId)).toEqual([userA]);
	});
});

describe("forUser: user B cannot reach user A's record", () => {
	let aItemId: number;
	let bItemId: number;

	beforeEach(async () => {
		const [aItem] = await forUser(userA).insert(ownedItems, { name: "A" });
		const [bItem] = await forUser(userB).insert(ownedItems, { name: "B" });
		if (!aItem || !bItem) throw new Error("insert returned no row");
		aItemId = aItem.id;
		bItemId = bItem.id;
	});

	it("findMany returns only the caller's rows", async () => {
		const forA = await forUser(userA).findMany(ownedItems);
		expect(forA.map((r) => r.id)).toEqual([aItemId]);

		const forB = await forUser(userB).findMany(ownedItems);
		expect(forB.map((r) => r.id)).toEqual([bItemId]);
	});

	it("findMany with a where on A's id returns nothing for B", async () => {
		const rows = await forUser(userB).findMany(ownedItems, {
			where: eq(ownedItems.id, aItemId),
		});
		expect(rows).toEqual([]);
	});

	it("findFirst does not return A's record for B", async () => {
		expect(
			await forUser(userB).findFirst(ownedItems, {
				where: eq(ownedItems.id, aItemId),
			}),
		).toBeNull();
		const first = await forUser(userB).findFirst(ownedItems);
		expect(first?.id).toBe(bItemId);
	});

	it("update by B on A's id changes nothing", async () => {
		const updated = await forUser(userB).update(
			ownedItems,
			{ name: "hacked" },
			eq(ownedItems.id, aItemId),
		);
		expect(updated).toEqual([]);

		const [stored] = await rowsInDb(eq(ownedItems.id, aItemId));
		expect(stored).toEqual({ id: aItemId, userId: userA, name: "A" });
	});

	it("delete by B on A's id removes nothing", async () => {
		const deleted = await forUser(userB).delete(
			ownedItems,
			eq(ownedItems.id, aItemId),
		);
		expect(deleted).toEqual([]);

		const stored = await rowsInDb(eq(ownedItems.id, aItemId));
		expect(stored).toEqual([{ id: aItemId, userId: userA, name: "A" }]);
	});

	// A raw `or` must not widen the owner condition: without parentheses B's query would be
	// `userId = B and id = B or id = A`, which also matches A's row.
	const aOrB = () =>
		sql`${ownedItems.id} = ${bItemId} or ${ownedItems.id} = ${aItemId}`;

	it("findMany with a raw sql `or` returns only the caller's rows", async () => {
		const rows = await forUser(userB).findMany(ownedItems, { where: aOrB() });
		expect(rows.map((r) => r.id)).toEqual([bItemId]);
	});

	it("update with a raw sql `or` changes only the caller's rows", async () => {
		const updated = await forUser(userB).update(
			ownedItems,
			{ name: "hacked" },
			aOrB(),
		);
		expect(updated.map((r) => r.id)).toEqual([bItemId]);

		const [stored] = await rowsInDb(eq(ownedItems.id, aItemId));
		expect(stored).toEqual({ id: aItemId, userId: userA, name: "A" });
	});

	it("delete with a raw sql `or` removes only the caller's rows", async () => {
		const deleted = await forUser(userB).delete(ownedItems, aOrB());
		expect(deleted.map((r) => r.id)).toEqual([bItemId]);

		const stored = await rowsInDb(eq(ownedItems.id, aItemId));
		expect(stored).toEqual([{ id: aItemId, userId: userA, name: "A" }]);
	});

	it("update cannot change userId", async () => {
		const [updated] = await forUser(userA).update(
			ownedItems,
			{
				name: "renamed",
				// @ts-expect-error: userId is not accepted from the caller.
				userId: userB,
			},
			eq(ownedItems.id, aItemId),
		);
		expect(updated).toEqual({ id: aItemId, userId: userA, name: "renamed" });

		await expect(
			forUser(userA).update(
				ownedItems,
				// @ts-expect-error: userId is not accepted from the caller.
				{ userId: userB },
				eq(ownedItems.id, aItemId),
			),
		).rejects.toThrow();

		const [stored] = await rowsInDb(eq(ownedItems.id, aItemId));
		expect(stored?.userId).toBe(userA);
	});
});

describe("forUser: guards", () => {
	it("rejects a table that is not in userOwned", async () => {
		await expect(forUser(userA).findMany(accounts)).rejects.toThrow(
			/not registered/,
		);
		await expect(
			forUser(userA).insert(accounts, {
				type: "oauth",
				provider: "test",
				providerAccountId: crypto.randomUUID(),
			}),
		).rejects.toThrow(/not registered/);
	});

	it("rejects an empty userId", () => {
		expect(userIdSchema.safeParse("").success).toBe(false);
		expect(userIdSchema.safeParse("   ").success).toBe(false);
		// A cast gets past the brand at compile time; the runtime parse still rejects the id.
		expect(() => forUser("" as UserId)).toThrow(ZodError);
		expect(() => forUser("" as UserId)).toThrow(/nie może być pusty/);
		expect(() => forUser("   " as UserId)).toThrow(ZodError);
		expect(() => forUser("   " as UserId)).toThrow(/nie może być pusty/);
	});

	it("accepts only a branded UserId, not a plain string", () => {
		// @ts-expect-error: a plain string is not a UserId; parse it with userIdSchema first.
		forUser(String(userA));
		expect(() => forUser(userA)).not.toThrow();
	});
});

describe("deleting a user", () => {
	it("cascades to their owned rows and accounts, and keeps other users' rows", async () => {
		await forUser(userA).insert(ownedItems, [{ name: "A1" }, { name: "A2" }]);
		await forUser(userB).insert(ownedItems, { name: "B1" });
		await testDb.insert(accounts).values(
			[userA, userB].map((userId) => ({
				userId,
				type: "oauth" as const,
				provider: "test",
				providerAccountId: userId,
			})),
		);

		await testDb.delete(users).where(eq(users.id, userA));

		expect(await rowsInDb(eq(ownedItems.userId, userA))).toEqual([]);
		expect(
			await testDb.select().from(accounts).where(eq(accounts.userId, userA)),
		).toEqual([]);

		const bItems = await rowsInDb(eq(ownedItems.userId, userB));
		expect(bItems.map((r) => r.name)).toEqual(["B1"]);
		const bAccounts = await testDb
			.select()
			.from(accounts)
			.where(eq(accounts.userId, userB));
		expect(bAccounts).toHaveLength(1);
	});
});
