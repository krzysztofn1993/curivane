# Repository Guidelines

Curivane is a solo, self-hosted speed-reading and memory-training web app: a create-t3-app scaffold on Next.js 16 (App Router), tRPC 11, Drizzle on PostgreSQL, next-auth 5 beta, zod 4, Tailwind 4 and Biome 2.6, managed with npm.

## Hard Rules

- Never reformat, regenerate or overwrite anything in `context/` with a tool. Biome formats Markdown and once flattened the YAML frontmatter there. Keep `"!context"` in `files.includes` in @biome.jsonc.
- Never commit `.env`. Add each new variable to @.env.example and to the schema in @src/env.js.
- `.env` must contain `AUTH_TRUST_HOST=true`, or `next start` fails with UntrustedHost.
- Declare every table through `createTable` in @src/server/db/schema.ts so it gets the `curivane_` prefix. @drizzle.config.ts only manages `curivane_*` tables. The only exception is the test fixture `test_fixture_owned_item` (`pgTable`, tests only).
- Every table in `schema.ts` must be in exactly one group of `userDataRegistry` in @src/server/data/registry.ts (`userOwned`, `auth` or `shared`).
- A new table of user data has a `userId` column with a foreign key to `users.id` and `onDelete: "cascade"`, and goes into `userDataRegistry.userOwned`.

## Project Structure

- `src/app/(auth)/` holds the `/login` and `/register` pages, `_components/auth-form.tsx` and the server actions in `actions.ts`.
- `src/server/auth/` holds the next-auth config, scrypt hashing (`password.ts`) and zod schemas (`validation.ts`).
- `src/server/api/` holds tRPC. Register new routers in @src/server/api/root.ts. The home page is still template code.
- `src/server/data/` holds the table registry and `forUser` (owner-scoped queries); its tests live next to it.
- Product docs live in `context/foundation/` (`prd.md`, `shape-notes.md`, `tech-stack.md`). The bootstrap log is @context/changes/bootstrap-verification/verification.md.

## Commands

- `./start-database.sh` starts Postgres in Docker (container `curivane-postgres`). Docker is rootless; `DOCKER_HOST` is set in `~/.profile`.
- `npm run db:push` applies the schema. Other `db:*` scripts are in @package.json.
- `npm run dev` starts the dev server.
- `npm test` runs Vitest. It needs `curivane-postgres` running; the `curivane_test` database is created and pushed automatically, and the dev database is never touched.
- Run `npm run check` (Biome), `npm run typecheck` and `npm test` before finishing a task.
- `SKIP_ENV_VALIDATION=1 npm run build` builds without a complete `.env`.

## Coding Style

- Biome formats with tabs and sorts imports and Tailwind classes. `npm run check:write` applies safe fixes and skips `context/`.
- Import from `src/` through the `~/` alias.
- Write all user-facing text in Polish, as on the auth pages.

## Auth & Data

- Sign-in uses e-mail and password through the Credentials provider, which requires JWT sessions. Validate with the schemas in `validation.ts`; hash only with `hashPassword`.
- E-mails are stored lower-cased and unique.
- There is no rate limiting, password reset or e-mail verification yet.
- Read and write user data only through `ctx.userData` (`forUser` from `~/server/data`) in `protectedProcedure`; it adds the owner condition to every query. The tRPC context has no `db`.
- Validate all input and identifiers with zod (tRPC `.input()`, server actions, ids from the session). Brand ids with zod `.brand()` (e.g. `UserId` from `userIdSchema` in `validation.ts`) and accept the branded type, not `string`, in data functions.
- Import `~/server/db` only in `src/server/db/`, `src/server/auth/`, `src/app/(auth)/actions.ts` and `src/server/data/` (Biome `noRestrictedImports`).
- Every new procedure with user data gets a case in the isolation test @src/server/data/user-data.test.ts.

## Testing, Commits & Deployment

- Gates: `npm run check`, `npm run typecheck`, `npm test`. Tests are `*.test.ts` next to the code: `registry.test.ts` (schema vs. registry, no DB), `user-data.test.ts` (isolation, on `curivane_test`), `src/server/api/trpc.test.ts` (`protectedProcedure`, `~/server/auth` mocked).
- Commit conventions are not defined yet. CI (GitHub Actions) is not set up.
- The app is self-hosted behind a Cloudflare Tunnel with manual promotion. Ignore the Vercel and Prisma notes in the stock @README.md.
