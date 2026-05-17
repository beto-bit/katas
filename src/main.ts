import { Application } from "oak";
import router from "./api/router.ts";
import { initDb } from "./config/db.ts";
import { errorHandler, notFound } from "./api/middlewares/error.handler.ts";
import { logger } from "./utils/logger.ts";

const PORT = parseInt(Deno.env.get("PORT") || "8000");
const HOST = Deno.env.get("HOST") || "0.0.0.0";

async function main() {
  try {
    await initDb();
    logger.info("Database initialized");

    const app = new Application();

    app.use(errorHandler);

    app.use(async (ctx, next) => {
      const start = Date.now();
      await next();
      const ms = Date.now() - start;
      logger.info(
        `${ctx.request.method} ${ctx.request.url.pathname} - ${ctx.response.status} - ${ms}ms`,
      );
    });

    app.use(router.routes());
    app.use(router.allowedMethods());
    app.use(notFound);

    app.listen({ port: PORT, hostname: HOST });
    logger.info(`Server running on http://${HOST}:${PORT}`);
    logger.info(`API endpoints available at /api/*`);
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    Deno.exit(1);
  }
}

await main();
