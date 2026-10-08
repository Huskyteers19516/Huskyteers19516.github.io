#!/usr/bin/env node
/**
 * Lists every "Website Coding" slot (data-edit-text / data-edit-link /
 * data-edit-image) in the built site and checks them:
 *   - every key matches the contract's format,
 *   - a key is the same kind (text, link or image) everywhere it's used.
 *
 *   npm run build && npm run slots              # table in the terminal
 *   node scripts/site-content-slots.mjs --markdown [distDir]   # Markdown table
 *
 * Exits with 1 when a check fails. Plain JavaScript, no dependencies.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const KEY_RE = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const KINDS = ["text", "link", "image"];

const args = process.argv.slice(2);
const markdown = args.includes("--markdown");
const dir = args.find((a) => !a.startsWith("--")) ?? "dist";

async function htmlFiles(root) {
    const out = [];
    for (const entry of await readdir(root, { withFileTypes: true })) {
        const path = join(root, entry.name);
        if (entry.isDirectory()) out.push(...(await htmlFiles(path)));
        else if (entry.name.endsWith(".html")) out.push(path);
    }
    return out;
}

const decode = (s) =>
    s
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");

function pageOf(file) {
    const rel = relative(dir, file).split(sep).join("/");
    if (rel === "index.html") return "/";
    return `/${rel.replace(/(\/)?index\.html$/, "").replace(/\.html$/, "")}`;
}

const TAG_RE = /<[a-zA-Z][^>]*\sdata-edit-(?:text|link|image)=[^>]*>/g;
const attr = (tag, name) => {
    const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
    return m ? decode(m[1]) : null;
};

const slots = new Map(); // key -> { kinds:Set, label, pages:Set }
const perPage = new Map(); // page -> count of distinct keys
const problems = [];

for (const file of (await htmlFiles(dir)).sort()) {
    const page = pageOf(file);
    const html = await readFile(file, "utf8");
    const pageKinds = new Map();
    for (const [tag] of html.matchAll(TAG_RE)) {
        for (const kind of KINDS) {
            const key = attr(tag, `data-edit-${kind}`);
            if (key === null) continue;
            if (!KEY_RE.test(key) || key.length > 120) {
                problems.push(`${page}: invalid key "${key}"`);
                continue;
            }
            const known = pageKinds.get(key);
            if (known && known !== kind) {
                problems.push(`${page}: "${key}" is both ${known} and ${kind}`);
            }
            pageKinds.set(key, kind);
            const slot = slots.get(key) ?? {
                kinds: new Set(),
                label: "",
                pages: new Set(),
            };
            slot.kinds.add(kind);
            slot.label ||= attr(tag, "data-edit-label") ?? "";
            slot.pages.add(page);
            slots.set(key, slot);
        }
    }
    perPage.set(page, pageKinds.size);
}

for (const [key, slot] of slots) {
    if (slot.kinds.size > 1) {
        problems.push(`"${key}" has more than one kind: ${[...slot.kinds].join(", ")}`);
    }
}

const everyPage = [...perPage.keys()];
const pagesLabel = (pages) =>
    pages.size === everyPage.length ? "every page" : [...pages].sort().join(" ");

const rows = [...slots.entries()].sort(([a], [b]) => a.localeCompare(b));
if (markdown) {
    console.log("| Key | Kind | Label | Pages |");
    console.log("| --- | --- | --- | --- |");
    for (const [key, s] of rows) {
        console.log(
            `| \`${key}\` | ${[...s.kinds].join("/")} | ${s.label.replace(/\|/g, "\\|")} | ${pagesLabel(s.pages)} |`,
        );
    }
} else {
    for (const [key, s] of rows) {
        console.log(`${[...s.kinds].join("/").padEnd(6)} ${key.padEnd(48)} ${s.label}  [${pagesLabel(s.pages)}]`);
    }
    console.log("\nSlots per page:");
    for (const [page, n] of [...perPage.entries()].sort()) {
        console.log(`  ${String(n).padStart(4)}  ${page}`);
    }
    console.log(`\n${rows.length} distinct keys.`);
}

if (problems.length) {
    console.error(`\n${problems.length} problem(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
}
