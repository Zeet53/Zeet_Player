// One-shot: build everything into a portable folder
import { cpSync, copyFileSync, mkdirSync, existsSync, writeFileSync, rmSync, readFileSync } from "fs";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopDir = path.resolve(__dirname, "..");
const coreDir = path.resolve(desktopDir, "..", "core");
const rootDir = path.resolve(desktopDir, "..", "..");
const rootModules = path.join(rootDir, "node_modules");
const outDir = path.join(desktopDir, "release-standalone");
const appName = "Zeet Player";

console.log("=== Building ===");
execSync("npm -w @music-player/core run build && npx vite build && npx tsc -p tsconfig.electron.json", {
  cwd: desktopDir, stdio: "inherit",
});
copyFileSync(path.join(desktopDir, "electron", "preload.cjs"), path.join(desktopDir, "dist-electron", "preload.cjs"));

console.log("=== Assembling ===");
const appDir = path.join(outDir, appName);

// Copy electron binaries
cpSync(path.join(rootModules, "electron", "dist"), appDir, { recursive: true, force: true, dereference: true });

// Copy our built files
const appResDir = path.join(appDir, "resources", "app");
cpSync(path.join(desktopDir, "dist"), path.join(appResDir, "dist"), { recursive: true, force: true, dereference: true });
cpSync(path.join(desktopDir, "dist-electron"), path.join(appResDir, "dist-electron"), { recursive: true, force: true, dereference: true });

// Copy runtime node_modules
for (const mod of ["yandex-music", "soundcloud.ts", "@zibot/scdl", "youtubei.js", "hls.js"]) {
  const src = path.join(rootModules, mod);
  if (!existsSync(src)) { console.log(`  SKIP ${mod}`); continue; }
  const dest = path.join(appResDir, "node_modules", mod);
  mkdirSync(path.dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true, force: true, dereference: true });
  console.log(`  COPY ${mod}`);
}

// Build @music-player/core (just dist + package.json)
const coreDest = path.join(appResDir, "node_modules", "@music-player", "core");
mkdirSync(coreDest, { recursive: true });
cpSync(path.join(coreDir, "dist"), path.join(coreDest, "dist"), { recursive: true, force: true, dereference: true });
writeFileSync(path.join(coreDest, "package.json"), JSON.stringify({
  name: "@music-player/core", type: "module", main: "dist/index.js", version: "1.0.0",
  dependencies: { "yandex-music": "*", "soundcloud.ts": "*", "@zibot/scdl": "*", "youtubei.js": "*" }
}));
console.log("  COPY @music-player/core");

// App package.json
writeFileSync(path.join(appResDir, "package.json"), JSON.stringify({
  name: "zeet-player", version: "1.0.0", main: "dist-electron/main.js", type: "module"
}));

// Rename electron.exe
if (existsSync(path.join(appDir, "electron.exe"))) {
  copyFileSync(path.join(appDir, "electron.exe"), path.join(appDir, `${appName}.exe`));
}

console.log("=== Done ===");
console.log(`Folder: ${outDir}\\${appName}`);
console.log(`Run: ${outDir}\\${appName}\\${appName}.exe`);
