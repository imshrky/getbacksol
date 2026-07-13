import postgres from "postgres";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL before running this script.");
  process.exit(1);
}

const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "schema.sql");
const schema = readFileSync(schemaPath, "utf8");

const sql = postgres(url, { ssl: "require" });

try {
  await sql.unsafe(schema);
  console.log("Schema applied.");
} finally {
  await sql.end();
}
