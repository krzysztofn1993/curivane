import "server-only";

import {
	randomBytes,
	type ScryptOptions,
	scrypt,
	timingSafeEqual,
} from "node:crypto";

/**
 * Password hashing with Node's built-in scrypt (no native dependencies).
 *
 * Parameters follow the OWASP Password Storage Cheat Sheet minimum for scrypt
 * (N=2^17, r=8, p=1). They are stored inside each hash, so they can be raised later
 * without invalidating existing passwords.
 *
 * Format: `scrypt$<N>$<r>$<p>$<salt base64>$<key base64>`
 */
const N = 2 ** 17;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

function deriveKey(
	password: string,
	salt: Buffer,
	options: { N: number; r: number; p: number },
	keyLength: number,
): Promise<Buffer> {
	const scryptOptions: ScryptOptions = {
		...options,
		// scrypt needs ~128 * N * r bytes; leave headroom above that.
		maxmem: 256 * options.N * options.r,
	};
	return new Promise((resolve, reject) => {
		scrypt(password, salt, keyLength, scryptOptions, (err, key) => {
			if (err) reject(err);
			else resolve(key);
		});
	});
}

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(SALT_LENGTH);
	const key = await deriveKey(password, salt, { N, r: R, p: P }, KEY_LENGTH);
	return [
		"scrypt",
		N,
		R,
		P,
		salt.toString("base64"),
		key.toString("base64"),
	].join("$");
}

export async function verifyPassword(
	password: string,
	stored: string,
): Promise<boolean> {
	const [scheme, n, r, p, saltB64, keyB64] = stored.split("$");
	if (scheme !== "scrypt" || !n || !r || !p || !saltB64 || !keyB64) {
		return false;
	}
	const expected = Buffer.from(keyB64, "base64");
	const actual = await deriveKey(
		password,
		Buffer.from(saltB64, "base64"),
		{ N: Number(n), r: Number(r), p: Number(p) },
		expected.length,
	);
	return timingSafeEqual(actual, expected);
}

/**
 * A valid hash of a random password. Used when the e-mail is unknown, so a login
 * attempt costs the same time whether or not the account exists.
 */
let dummyHash: Promise<string> | undefined;
export function getDummyHash(): Promise<string> {
	dummyHash ??= hashPassword(randomBytes(32).toString("base64"));
	return dummyHash;
}
