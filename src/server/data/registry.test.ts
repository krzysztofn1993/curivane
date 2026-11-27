import { getTableColumns, getTableName, is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import * as schema from "~/server/db/schema";

import { userDataRegistry } from "./registry";

// Every export of schema.ts that is a table (relations and `createTable` itself are skipped).
const schemaTables = (Object.values(schema) as unknown[]).filter(
	(value): value is PgTable => is(value, PgTable),
);

const groups = {
	userOwned: userDataRegistry.userOwned.map((entry) => entry.table as PgTable),
	auth: userDataRegistry.auth,
	shared: userDataRegistry.shared,
};
const registeredTables = Object.values(groups).flat();

const hasUserId = (table: PgTable) => "userId" in getTableColumns(table);

describe("userDataRegistry", () => {
	it("finds the tables of schema.ts", () => {
		expect(schemaTables.length).toBeGreaterThan(0);
	});

	it.each(schemaTables.map((table) => [getTableName(table), table] as const))(
		"puts table %s in exactly one group",
		(name, table) => {
			const inGroups = Object.entries(groups)
				.filter(([, tables]) => tables.includes(table))
				.map(([group]) => group);
			const count = registeredTables.filter((t) => t === table).length;
			expect(
				count,
				`Table "${name}" must be in exactly one registry group (userOwned, auth or shared); found in: [${inGroups.join(", ")}], ${count} time(s). Add it to userDataRegistry in src/server/data/registry.ts.`,
			).toBe(1);
		},
	);

	it("contains no tables outside schema.ts", () => {
		const foreign = registeredTables
			.filter((table) => !schemaTables.includes(table))
			.map(getTableName);
		expect(
			foreign,
			`Registry tables not exported from src/server/db/schema.ts: ${foreign.join(", ")}`,
		).toEqual([]);
	});

	it("gives every userOwned table a userId column", () => {
		const missing = groups.userOwned.filter((t) => !hasUserId(t));
		expect(
			missing.map(getTableName),
			"userOwned tables without a userId column",
		).toEqual([]);
	});

	it("gives no shared table a userId column", () => {
		const owned = groups.shared.filter(hasUserId);
		expect(
			owned.map(getTableName),
			"shared tables with a userId column (move them to userOwned)",
		).toEqual([]);
	});
});

describe("userId foreign keys", () => {
	const ownedTables = schemaTables.filter(hasUserId);

	it("covers the auth tables account and session", () => {
		const names = ownedTables.map(getTableName);
		expect(names).toContain(getTableName(schema.accounts));
		expect(names).toContain(getTableName(schema.sessions));
	});

	it.each(ownedTables.map((table) => [getTableName(table), table] as const))(
		"table %s: userId references users.id with onDelete cascade",
		(name, table) => {
			const userId = getTableColumns(table).userId;
			const fk = getTableConfig(table).foreignKeys.find((key) => {
				const ref = key.reference();
				return (
					ref.columns.length === 1 &&
					ref.columns[0] === userId &&
					ref.foreignTable === schema.users &&
					ref.foreignColumns.length === 1 &&
					ref.foreignColumns[0] === schema.users.id
				);
			});
			expect(
				fk,
				`Table "${name}": column userId has no foreign key to users.id.`,
			).toBeDefined();
			expect(
				fk?.onDelete,
				`Table "${name}": the foreign key userId -> users.id must have onDelete: "cascade".`,
			).toBe("cascade");
		},
	);
});
