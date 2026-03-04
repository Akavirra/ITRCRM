const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

function loadEnv(file) {
  const p = path.join(process.cwd(), file);
  if (!fs.existsSync(p)) return {};
  const content = fs.readFileSync(p, "utf8");

  const env = {};

  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;

    const eq = t.indexOf("=");
    if (eq === -1) continue;

    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();

    env[k] = v;
  }

  return env;
}

// Load ONLY production env
const prodEnv = loadEnv(".env.production.local");

const env = {
  ...process.env,
  ...prodEnv,
  APP_ENV: "prod",
  DB_PATH: prodEnv.DB_PATH || "data/school.prod.db",
};

console.log("[START-PROD] APP_ENV =", env.APP_ENV);
console.log("[START-PROD] DB_PATH =", env.DB_PATH);

const r = spawnSync(
  "npx",
  ["next", "start", "-p", "3001"],
  {
    stdio: "inherit",
    env,
    shell: true,
  }
);

process.exit(r.status ?? 0);
