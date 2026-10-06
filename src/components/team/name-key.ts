/**
 * The key the Teammate Portal lists a teammate's photo under in
 * GET /api/public/team-photos (see ./portal-photos.ts): never their name,
 * but a hash of it, so the public JSON isn't a list of who's on the team.
 * The site works out the same key for each name it already shows (Our Team
 * cards, the progress page's people) and looks the photo up by it.
 *
 *   key = first 32 hex characters of
 *         SHA-256("huskyteers-team-photo-v1:" + normalizeName(full name))
 *
 * `normalizeName` (./roster.ts) is the portal's `teamPhotoNameKey`, and the
 * prefix and length are its TEAM_PHOTO_KEY_PREFIX / _LENGTH
 * (src/lib/user-photos.ts there): keep them identical. Both repos' tests
 * check the same vectors (tests/team-photos.test.mjs here).
 *
 * SHA-256 is written out here (FIPS 180-4) because Web Crypto's digest is
 * async and the cards look photos up while rendering; a name is a few dozen
 * bytes, and each key is worked out once (`teamPhotoKey` remembers them).
 *
 * Pure module, so the tests in tests/ can load it with Node's type stripping.
 */
import { normalizeName } from "./roster.ts";

/** Hashed in front of the normalized name (the portal's TEAM_PHOTO_KEY_PREFIX). */
export const TEAM_PHOTO_KEY_PREFIX = "huskyteers-team-photo-v1:";
/** Hex characters kept (the portal's TEAM_PHOTO_KEY_LENGTH). */
export const TEAM_PHOTO_KEY_LENGTH = 32;
/** What a key in the payload looks like. */
export const TEAM_PHOTO_KEY_RE = /^[0-9a-f]{32}$/;

/** SHA-256 round constants (cube roots of the first 64 primes). */
const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** Initial hash value (square roots of the first 8 primes). */
const H0 = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
];

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

/** SHA-256 of a string's UTF-8 bytes, as 64 lowercase hex characters. */
export function sha256Hex(text: string): string {
    const bytes = new TextEncoder().encode(text);
    const blocks = Math.ceil((bytes.length + 9) / 64);
    const padded = new Uint8Array(blocks * 64);
    padded.set(bytes);
    padded[bytes.length] = 0x80;
    const view = new DataView(padded.buffer);
    const bits = bytes.length * 8;
    view.setUint32(padded.length - 8, Math.floor(bits / 0x100000000));
    view.setUint32(padded.length - 4, bits >>> 0);

    const h = H0.slice();
    const w = new Uint32Array(64);
    for (let off = 0; off < padded.length; off += 64) {
        for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
        for (let i = 16; i < 64; i++) {
            const a = w[i - 15];
            const b = w[i - 2];
            const s0 = rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3);
            const s1 = rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10);
            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
        }
        let [a, b, c, d, e, f, g, hh] = h;
        for (let i = 0; i < 64; i++) {
            const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
            const ch = (e & f) ^ (~e & g);
            const t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
            const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const t2 = (S0 + maj) | 0;
            hh = g;
            g = f;
            f = e;
            e = (d + t1) | 0;
            d = c;
            c = b;
            b = a;
            a = (t1 + t2) | 0;
        }
        h[0] = (h[0] + a) | 0;
        h[1] = (h[1] + b) | 0;
        h[2] = (h[2] + c) | 0;
        h[3] = (h[3] + d) | 0;
        h[4] = (h[4] + e) | 0;
        h[5] = (h[5] + f) | 0;
        h[6] = (h[6] + g) | 0;
        h[7] = (h[7] + hh) | 0;
    }
    return h.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
}

const known = new Map<string, string | null>();

/**
 * The portal's key for someone's full name, or null for a name that's empty
 * once normalized. Remembered per name (a page shows a few dozen).
 */
export function teamPhotoKey(name: string): string | null {
    const hit = known.get(name);
    if (hit !== undefined) return hit;
    const normalized = normalizeName(name);
    const key = normalized
        ? sha256Hex(TEAM_PHOTO_KEY_PREFIX + normalized).slice(0, TEAM_PHOTO_KEY_LENGTH)
        : null;
    if (known.size > 2000) known.clear();
    known.set(name, key);
    return key;
}
