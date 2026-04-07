import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import { logger } from "../utils/logger";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

export const pool = new Pool({
  connectionString: databaseUrl
});

pool.on("error", (err: Error) => {
  logger.error("Unexpected PostgreSQL pool error", { message: err.message });
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function ensureDbConnection(): Promise<void> {
  try {
    await query("SELECT 1");
    logger.info("PostgreSQL connection is ready");
  } catch (error) {
    const err = error as Error & { errors?: unknown[] };
    const inner = Array.isArray(err.errors)
      ? err.errors
          .map((innerError) => {
            if (innerError instanceof Error) {
              return innerError.message;
            }
            return String(innerError);
          })
          .join("; ")
      : null;

    const details = inner || err.message || "unknown PostgreSQL connection error";
    throw new Error(`Could not connect to PostgreSQL (${details})`);
  }
}

export async function closeDbPool(): Promise<void> {
  await pool.end();
}
