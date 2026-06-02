import { spawn, execSync } from "child_process";
import { createServer } from "vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

async function main() {
  // Build core first (desktop depends on @music-player/core for ping, radio queue, etc.)
  console.log("[dev] Building @music-player/core...");
  execSync("npm -w @music-player/core run build", {
    stdio: "inherit",
  });

  // Compile electron main process
  console.log("[dev] Compiling electron main process...");
  execSync("npx tsc -p tsconfig.electron.json", {
    cwd: root,
    stdio: "inherit",
  });

  // Copy preload
  const { copyFileSync } = await import("fs");
  copyFileSync(
    resolve(root, "electron/preload.cjs"),
    resolve(root, "dist-electron/preload.cjs"),
  );

  // Start Vite dev server
  const server = await createServer({
    configFile: "./vite.config.ts",
  });
  await server.listen();

  const address = server.httpServer?.address();
  const port = typeof address === "object" && address ? address.port : 5173;
  const url = `http://localhost:${port}`;

  console.log(`[dev] Vite running at ${url}`);

  const electron = spawn(
    require.resolve("electron"),
    ["."],
    {
      env: { ...process.env, VITE_DEV_SERVER_URL: url },
      stdio: "inherit",
      shell: true,
    },
  );

  electron.on("close", () => {
    server.close();
    process.exit();
  });
}

main();
