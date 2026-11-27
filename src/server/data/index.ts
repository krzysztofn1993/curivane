import { db } from "~/server/db";

import { userDataRegistry } from "./registry";
import { createUserData } from "./user-data";

/**
 * The public data module. Code outside `src/server/db/`, `src/server/auth/` and
 * `src/app/(auth)/actions.ts` reaches the database only through here (enforced by the
 * `noRestrictedImports` rule in `biome.jsonc`).
 *
 * @example
 * const items = await forUser(ctx.session.user.id).findMany(someOwnedTable);
 */
export const forUser = createUserData(db, userDataRegistry);

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
