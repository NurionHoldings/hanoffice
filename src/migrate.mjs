import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const directory = join(dirname(fileURLToPath(import.meta.url)), "..", "db");

export async function migrate(db) {
  await db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const applied = new Set((await db.query("SELECT id FROM schema_migrations")).map((row) => row.id));
  const files = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  const ran = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    await db.exec(await readFile(join(directory, file), "utf8"));
    await db.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
    ran.push(file);
  }
  return ran;
}
