import { initDb } from "../config/db.ts";
import { logger } from "../utils/logger.ts";

async function migrate() {
  logger.info("Running database migrations...");
  await initDb();
  logger.info("Migrations completed successfully");
  Deno.exit(0);
}

await migrate();
