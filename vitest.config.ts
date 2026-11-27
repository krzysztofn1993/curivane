import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * Tests run against `curivane_test` on the same Postgres server as the dev database: the URL is
 * `DATABASE_URL` from `.env` with the database name swapped and the query string removed. It is
 * set in `test.env`, so it is in place before any test imports `~/env` or `~/server/db`.
 * `SKIP_ENV_VALIDATION` is not set: the env schema is validated in tests too.
 */
export default defineConfig(({ mode }) => {
	const { DATABASE_URL } = loadEnv(mode, process.cwd(), "");
	if (!DATABASE_URL) {
		throw new Error("Vitest: DATABASE_URL is missing from .env.");
	}

	// Query parameters are dropped: postgres-js lets `?database=…` override the path, which could
	// point the tests at the dev database. The setup and the test client also check
	// `current_database()` after connecting.
	const testUrl = new URL(DATABASE_URL);
	testUrl.pathname = "/curivane_test";
	testUrl.search = "";

	return {
		resolve: {
			alias: { "~": fileURLToPath(new URL("./src", import.meta.url)) },
		},
		test: {
			environment: "node",
			env: { DATABASE_URL: testUrl.toString() },
			globalSetup: ["./src/server/data/test/global-setup.ts"],
		},
	};
});
