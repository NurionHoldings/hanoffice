import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "../../src/migrate.mjs";
import { wrapPg, wrapPglite } from "../../src/db.mjs";

export async function createTestDatabase() {
  if (process.env.DATABASE_URL) {
    const pg = (await import("pg")).default;
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
    const db = wrapPg(pool);
    await migrate(db);
    return {
      db,
      engine: "postgres",
      async reopen() {
        await pool.end();
        return wrapPg(new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 }));
      },
      async close(current = db) { await current.close(); }
    };
  }
  const dir = await mkdtemp(join(tmpdir(), "hanoffice-pg-"));
  const { PGlite } = await import("@electric-sql/pglite");
  let client = new PGlite(dir);
  await migrate(wrapPglite(client));
  return {
    db: wrapPglite(client),
    engine: "pglite",
    async reopen() {
      await client.close();
      client = new PGlite(dir);
      return wrapPglite(client);
    },
    async close() {
      await client.close();
      await rm(dir, { recursive: true, force: true });
    }
  };
}
