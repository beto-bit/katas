import { Context } from "oak";
import { CorrelationEngine } from "../../graph/correlations.ts";
import { getDb } from "../../config/db.ts";
import { logger } from "../../utils/logger.ts";

const correlationEngine = new CorrelationEngine();

export const correlationsController = {
  async runCorrelations(ctx: Context) {
    try {
      const count = await correlationEngine.computeAllCorrelations();

      ctx.response.body = {
        success: true,
        message: "Correlation analysis completed",
        correlationsCreated: count,
      };
    } catch (error) {
      logger.error(`Correlation error: ${error.message}`);
      ctx.response.status = 500;
      ctx.response.body = { error: error.message };
    }
  },

  async getCorrelations(ctx: Context) {
    const url = new URL(ctx.request.url);
    const nodeId = url.searchParams.get("nodeId");
    const minWeight = parseFloat(url.searchParams.get("minWeight") || "0.1");

    const db = getDb();

    if (nodeId) {
      const correlations = await correlationEngine.getCorrelationsForNode(
        parseInt(nodeId),
        minWeight,
      );
      ctx.response.body = { nodeId: parseInt(nodeId), correlations };
    } else {
      const limit = parseInt(url.searchParams.get("limit") || "100");
      const offset = parseInt(url.searchParams.get("offset") || "0");

      const result = await db.queryObject(
        `SELECT e.id, e.source_id, e.target_id, e.weight, e.properties,
                s.name as source_name, s.label as source_label,
                t.name as target_name, t.label as target_label
         FROM edges e
         JOIN nodes s ON s.id = e.source_id
         JOIN nodes t ON t.id = e.target_id
         WHERE e.relation_type = 'CORRELATED_WITH' AND e.weight >= $1
         ORDER BY e.weight DESC
         LIMIT $2 OFFSET $3`,
        [minWeight, limit, offset],
      );

      ctx.response.body = {
        correlations: result.rows,
        limit,
        offset,
        total: result.rows.length,
      };
    }
  },

  async getCorrelationBetween(ctx: Context) {
    const url = new URL(ctx.request.url);
    const source = parseInt(url.searchParams.get("source") || "");
    const target = parseInt(url.searchParams.get("target") || "");

    if (isNaN(source) || isNaN(target)) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Missing source or target parameters" };
      return;
    }

    const db = getDb();
    const result = await db.queryObject(
      `SELECT e.*, 
              s.name as source_name, t.name as target_name
       FROM edges e
       JOIN nodes s ON s.id = e.source_id
       JOIN nodes t ON t.id = e.target_id
       WHERE ((e.source_id = $1 AND e.target_id = $2) OR (e.source_id = $2 AND e.target_id = $1))
         AND e.relation_type = 'CORRELATED_WITH'`,
      [source, target],
    );

    ctx.response.body = {
      source,
      target,
      correlation: result.rows[0] || null,
    };
  },
};
