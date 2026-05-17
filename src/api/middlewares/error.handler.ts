import { Context, Next } from "oak";
import { logger } from "../../utils/logger.ts";

export async function errorHandler(ctx: Context, next: Next) {
  try {
    await next();
  } catch (err) {
    logger.error(`Error: ${err.message}`);
    logger.error(err.stack);

    ctx.response.status = err.status || 500;
    ctx.response.body = {
      error: err.message || "Internal server error",
      status: ctx.response.status,
      timestamp: new Date().toISOString(),
    };
  }
}

export function notFound(ctx: Context) {
  ctx.response.status = 404;
  ctx.response.body = {
    error: "Not Found",
    path: ctx.request.url.pathname,
    timestamp: new Date().toISOString(),
  };
}
