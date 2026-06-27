const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const envPath = path.join(rootDir, ".env");
const manifestPath = path.join(rootDir, "manifest.json");

function parseEnvFile(contents) {
  const env = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

function isValidExtensionVersion(version) {
  return /^\d+\.\d+\.\d+(\.\d+)?$/.test(version);
}

if (!fs.existsSync(envPath)) {
  console.error("Missing .env file. Create it from .env.example first.");
  process.exit(1);
}

const env = parseEnvFile(fs.readFileSync(envPath, "utf8"));
const version = env.APP_VERSION;

if (!version) {
  console.error("APP_VERSION is missing in .env");
  process.exit(1);
}

if (!isValidExtensionVersion(version)) {
  console.error(`Invalid APP_VERSION "${version}". Use Chrome extension format like 1.2.3 or 1.2.3.4`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
manifest.version = version;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

console.log(`Synced manifest version to ${version}`);
