#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const envMap = {};
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    envMap[key] = value;
  }
  return envMap;
}

function runCommand(command, args, env) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { stdio: "inherit", env });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}

function waitForPort(host, port, timeoutMs = 60000) {
  const start = Date.now();
  return new Promise((resolvePromise, rejectPromise) => {
    const attempt = () => {
      const socket = createConnection({ host, port });
      socket.once("connect", () => {
        socket.end();
        resolvePromise();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - start >= timeoutMs) {
          rejectPromise(new Error(`Server readiness timed out on ${host}:${port}`));
          return;
        }
        setTimeout(attempt, 500);
      });
    };
    attempt();
  });
}

async function main() {
  const cwd = process.cwd();
  const testEnv = loadDotEnvFile(resolve(cwd, ".env.test.local"));
  const env = { ...process.env, ...testEnv };
  const port = Number.parseInt(env.TEST_PORT ?? "3100", 10);
  const baseUrl = `http://127.0.0.1:${port}`;
  const targetScripts = process.argv.slice(2);
  const scriptsToRun = targetScripts.length > 0 ? targetScripts : ["test:ssr:raw"];
  let server = null;

  const stopServer = () => {
    if (!server || server.killed) {
      return;
    }
    server.kill("SIGTERM");
  };

  const handleExit = () => stopServer();
  process.on("SIGINT", handleExit);
  process.on("SIGTERM", handleExit);
  process.on("exit", handleExit);

  try {
    await runCommand("npm", ["run", "build"], env);

    server = spawn("npm", ["run", "start", "--", "-p", String(port)], {
      stdio: "inherit",
      env: { ...env, NODE_ENV: "production" },
    });

    await waitForPort("127.0.0.1", port);

    for (const scriptName of scriptsToRun) {
      await runCommand("npm", ["run", scriptName], {
        ...env,
        BASE_URL: baseUrl,
        TEST_BASE_URL: baseUrl,
      });
    }
  } finally {
    stopServer();
    process.off("SIGINT", handleExit);
    process.off("SIGTERM", handleExit);
    process.off("exit", handleExit);
  }
}

main().catch((error) => {
  console.error(`[test:ssr] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
