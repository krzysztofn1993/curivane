/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
	// Keep Next.js from appending its own block to our hand-written AGENTS.md.
	agentRules: false,
};

export default config;
