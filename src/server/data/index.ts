import { db } from "~/server/db";

import { userDataRegistry } from "./registry";
import { createUserData } from "./user-data";

/**
 * The public data module. Code outside `src/server/db/`, `src/server/auth/` and
 * `src/app/(auth)/actions.ts` reaches the database only through here (enforced by the
 * `noRestrictedImports` rule in `biome.jsonc`).
 *
 * `forUser` takes a branded `UserId`, not a `string`. In tRPC use `ctx.userData` from
 * `protectedProcedure`, which parses the session id for you. Elsewhere parse it first:
 *
 * @example
 * const userId = userIdSchema.parse(session.user.id); // from ~/server/auth/validation
 * const items = await forUser(userId).findMany(someOwnedTable);
 */
export const forUser = createUserData(db, userDataRegistry);

export type { UserId } from "~/server/auth/validation";

export type {
	OwnedTable,
	UserDataRegistry,
	UserOwnedEntry,
} from "./registry";
export type {
	FindFirstOptions,
	FindManyOptions,
	OwnedInsert,
	OwnedRow,
	OwnedUpdate,
	UserData,
} from "./user-data";
export { userDataRegistry };
