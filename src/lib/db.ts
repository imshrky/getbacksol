import "server-only";
import postgres from "postgres";

// Reused across invocations in dev (hot reload) via globalThis; in
// production each cold start gets its own module scope anyway, which is
// the standard pattern for serverless + a connection-pooled Postgres.
const globalForDb = globalThis as unknown as { __gbsSql?: ReturnType<typeof postgres> };

// Lazy on purpose: constructing eagerly at module load would throw before
// any route handler's try/catch could turn a missing DATABASE_URL into a
// clean 503 instead of an unhandled 500.
export function getSql() {
  if (globalForDb.__gbsSql) return globalForDb.__gbsSql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured.");
  return (globalForDb.__gbsSql = postgres(url, { ssl: "require", max: 5 }));
}
