import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * Tests run against `curivane_test` on the same Postgres server as the dev database: the URL is
 * `DATABASE_URL` from `.env` with the database name swapped. It is set in `test.env`, so it is in
 * place before any test imports `~/env` or `~/server/db`. `SKIP_ENV_VALIDATION` is not set: the
 * env schema is validated in tests too.
 */
export default defineConfig(({ mode }) => {
	const { DATABASE_URL } = loadEnv(mode, process.cwd(), "");
	if (!DATABASE_URL) {
		throw new Error("Vitest: DATABASE_URL is missing from .env.");
	}

	const testUrl = new URL(DATABASE_URL);
	testUrl.pathname = "/curivane_test";
	if (!testUrl.pathname.endsWith("_test")) {
		throw new Error(
			"Vitest: the test database name must end with _test; refusing to run.",
		);
	}

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
