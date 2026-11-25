import pg from "pg";

let opening;

export function wrapPg(pool) {
  return {
    engine: "postgres",
    async query(text, params = []) {
      const result = await pool.query(text, params);
      return result.rows;
    },
    async exec(script) {
      await pool.query(script);
    },
    async transaction(fn) {
      const client = await pool.connect();
      const tx = { async query(text, params = []) { return (await client.query(text, params)).rows; } };
      try {
        await client.query("BEGIN");
        const value = await fn(tx);
        await client.query("COMMIT");
        return value;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    close() { return pool.end(); }
  };
}

export function wrapPglite(client) {
  return {
    engine: "pglite",
    async query(text, params = []) {
      const result = await client.query(text, params);
      return result.rows;
    },
    async exec(script) { await client.exec(script); },
    transaction(fn) {
      return client.transaction(async (tx) => fn({
        async query(text, params = []) { return (await tx.query(text, params)).rows; }
      }));
    },
    close() { return client.close(); }
  };
}

export function getDatabase() {
  if (!process.env.DATABASE_URL) return Promise.resolve(null);
  if (!opening) {
    opening = (async () => {
      const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
      const db = wrapPg(pool);
      const { migrate } = await import("./migrate.mjs");
      await migrate(db);
      return db;
    })().catch((error) => { opening = undefined; throw error; });
  }
  return opening;
}
