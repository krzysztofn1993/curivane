import type { Sql } from "postgres";

/**
 * Stops the run unless the connection really is on a `*_test` database. The URL checks look only at
 * its path; this asks the server, so a query parameter or an overridden env cannot point the tests
 * at the dev database unnoticed.
 */
export async function assertTestDatabase(sql: Sql) {
	const [row] = await sql<
		{ name: string }[]
	>`select current_database() as name`;
	if (!row?.name.endsWith("_test")) {
		throw new Error(
			`Tests: connected to database "${row?.name}", not a *_test database; refusing to run.`,
		);
	}
}
