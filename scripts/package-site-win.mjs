import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

const [projectArg, archiveArg] = process.argv.slice(2);
if (!projectArg || !archiveArg) {
  console.error("usage: node scripts/package-site-win.mjs PROJECT_DIR ARCHIVE_PATH");
  process.exit(2);
}

const project = path.resolve(projectArg);
const archive = path.resolve(archiveArg);
const pluginRoot = "C:/Users/woori/.codex/plugins/cache/openai-curated-remote/sites/0.1.71";
const prepare = path.join(pluginRoot, "skills/sites-hosting/scripts/prepare-site-build.cjs");
const stage = mkdtempSync(path.join(tmpdir(), "sites-package-"));

try {
  const stageDist = path.join(stage, "dist");
  const buildKind = execFileSync(process.execPath, [prepare, project, stageDist], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();

  const sourceHostingPath = path.join(project, ".openai/hosting.json");
  const builtHostingPath = path.join(project, "dist/.openai/hosting.json");
  const stagedOpenAi = path.join(stageDist, ".openai");
  const stagedHostingPath = path.join(stagedOpenAi, "hosting.json");
  mkdirSync(stagedOpenAi, { recursive: true });

  const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
  const source = readJson(sourceHostingPath);
  const built = existsSync(builtHostingPath) ? readJson(builtHostingPath) : {};
  if (
    source.artifact_metadata != null &&
    built.artifact_metadata != null &&
    !isDeepStrictEqual(source.artifact_metadata, built.artifact_metadata)
  ) {
    throw new Error("Conflicting artifact_metadata in hosting manifests.");
  }
  const staged = buildKind === "worker" ? source : readJson(stagedHostingPath);
  const attribution = built.artifact_metadata ?? source.artifact_metadata;
  if (attribution != null) staged.artifact_metadata = attribution;
  writeFileSync(stagedHostingPath, `${JSON.stringify(staged, null, 2)}\n`);

  const drizzle = path.join(project, "drizzle");
  if (existsSync(drizzle)) {
    cpSync(drizzle, path.join(stagedOpenAi, "drizzle"), { recursive: true });
  }

  mkdirSync(path.dirname(archive), { recursive: true });
  execFileSync("tar", ["-C", stage, "-czf", archive, "dist"], { stdio: "inherit" });
  const entries = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" });
  if (!entries.split(/\r?\n/).includes("dist/.openai/hosting.json")) {
    throw new Error("Archive is missing dist/.openai/hosting.json");
  }
  console.log(archive);
} finally {
  rmSync(stage, { recursive: true, force: true });
}
