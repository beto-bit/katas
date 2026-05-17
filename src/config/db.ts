import { config } from "https://deno.land/x/dotenv@v3.2.2/mod.ts";
import { Client } from "postgres";

// Cargar variables de entorno
await config({ export: true });

let client: Client | null = null;

export async function initDb() {
  const databaseUrl = Deno.env.get("DATABASE_URL");
  if (!databaseUrl) {
    throw new Error("DATABASE_URL no está configurado en el entorno");
  }

  console.log("Connecting to database...");
  client = new Client(databaseUrl);
  await client.connect();

  console.log("Iniciando la migración...");
  await migrate();

  console.log("✓ Database conectada y migrada");
  return client;
}

export function getDb() {
  if (!client) {
    throw new Error("Base de datos no inicializada. Llame primero a initDb().");
  }
  return client;
}

async function migrate() {
  try {
    const sql = await Deno.readTextFile(
      "./src/storage/migrations/001_init.sql",
    );
    await client!.queryArray(sql);
    console.log("✓ Migración completeda");
  } catch (error) {
    if (!error.message.includes("already exists")) {
      console.error("Migration error:", error);
      throw error;
    }
    console.log("✓ Las tablas ya existen");
  }
}
