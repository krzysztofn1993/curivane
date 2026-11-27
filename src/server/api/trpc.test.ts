import type { Session } from "next-auth";
import { describe, expect, it, vi } from "vitest";

import { userIdSchema } from "~/server/auth/validation";

// trpc.ts imports ~/server/auth, which pulls in next-auth; the context is built by hand below.
vi.mock("~/server/auth", () => ({ auth: vi.fn() }));

const { createCallerFactory, createTRPCRouter, protectedProcedure } =
	await import("~/server/api/trpc");

const testRouter = createTRPCRouter({
	whoami: protectedProcedure.query(({ ctx }) => ({
		userId: ctx.session.user.id,
		hasUserData: typeof ctx.userData?.findMany === "function",
		hasDb: "db" in ctx,
	})),
});

const createCaller = createCallerFactory(testRouter);

const callWith = (session: Session | null) =>
	createCaller({ session, headers: new Headers() }).whoami();

const sessionFor = (id: string): Session => ({
	user: { id, email: "test@example.test" },
	expires: new Date(Date.now() + 60_000).toISOString(),
});

describe("protectedProcedure", () => {
	it("rejects a missing session", async () => {
		await expect(callWith(null)).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("rejects an empty user id", async () => {
		await expect(callWith(sessionFor(""))).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("rejects a whitespace-only user id", async () => {
		await expect(callWith(sessionFor("   "))).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("gives ctx.userData and no ctx.db for a valid session", async () => {
		const userId = userIdSchema.parse("user-1");
		await expect(callWith(sessionFor(userId))).resolves.toEqual({
			userId: "user-1",
			hasUserData: true,
			hasDb: false,
		});
	});
});
