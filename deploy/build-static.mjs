import { cp, mkdir, rm } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const output = new URL("dist/", root);
const assets = [
    "index.html",
    "help-content.html",
    "styles.css",
    "main.js",
    "src",
    "fonts",
    "images",
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const asset of assets) {
    await cp(new URL(asset, root), new URL(asset, output), { recursive: true });
}

console.log("Static site ready in dist/");
