import { getDb } from "../config/db.ts";
import { Edge, Node } from "../models/node.ts";
import { logger } from "../utils/logger.ts";

export class Repository {
  async saveNodes(nodes: Node[]): Promise<Map<string, number>> {
    const db = getDb();
    const idMap = new Map<string, number>();

    for (const node of nodes) {
      const existing = await db.queryObject<{ id: number }>(
        "SELECT id FROM nodes WHERE label = $1 AND name = $2",
        [node.label, node.name],
      );

      let id: number;
      if (existing.rows.length > 0) {
        id = existing.rows[0].id;
        await db.queryObject(
          "UPDATE nodes SET properties = $1 WHERE id = $2",
          [node.properties, id],
        );
      } else {
        const result = await db.queryObject<{ id: number }>(
          "INSERT INTO nodes (label, name, properties) VALUES ($1, $2, $3) RETURNING id",
          [node.label, node.name, node.properties],
        );
        id = result.rows[0].id;
      }

      const key = `${node.label}|${node.name}`;
      idMap.set(key, id);
    }

    logger.info(`Saved ${nodes.length} nodes`);
    return idMap;
  }

  async saveEdges(edges: Edge[], nodeMap: Map<string, number>): Promise<void> {
    const db = getDb();
    let saved = 0;

    for (const edge of edges) {
      const existing = await db.queryObject(
        "SELECT id FROM edges WHERE source_id = $1 AND target_id = $2 AND relation_type = $3",
        [edge.source_id, edge.target_id, edge.relation_type],
      );

      if (existing.rows.length === 0) {
        await db.queryObject(
          `INSERT INTO edges (source_id, target_id, relation_type, weight, properties) 
           VALUES ($1, $2, $3, $4, $5)`,
          [
            edge.source_id,
            edge.target_id,
            edge.relation_type,
            edge.weight || 0,
            edge.properties || {},
          ],
        );
        saved++;
      }
    }

    logger.info(`Saved ${saved} edges`);
  }

  async getNodes(label?: string, limit = 100, offset = 0): Promise<Node[]> {
    const db = getDb();
    let query = `SELECT id, label, name, properties, created_at FROM nodes`;
    const params: any[] = [];

    if (label) {
      query += ` WHERE label = $1`;
      params.push(label);
    }

    query += ` ORDER BY id LIMIT $${params.length + 1} OFFSET $${
      params.length + 2
    }`;
    params.push(limit, offset);

    const result = await db.queryObject<any>(query, params);
    return result.rows;
  }

  async getNodeById(id: number): Promise<Node | null> {
    const db = getDb();
    const result = await db.queryObject<Node>(
      `SELECT id, label, name, properties, created_at FROM nodes WHERE id = $1`,
      [id],
    );
    return result.rows[0] || null;
  }

  async getEdgesByNodeId(nodeId: number): Promise<Edge[]> {
    const db = getDb();
    const result = await db.queryObject<Edge>(
      `SELECT id, source_id, target_id, relation_type, weight, properties, created_at 
       FROM edges 
       WHERE source_id = $1 OR target_id = $1`,
      [nodeId],
    );
    return result.rows;
  }

  async searchNodes(query: string): Promise<Node[]> {
    const db = getDb();
    const result = await db.queryObject<Node>(
      `SELECT id, label, name, properties, created_at 
       FROM nodes 
       WHERE name ILIKE $1 OR properties::text ILIKE $1
       LIMIT 50`,
      [`%${query}%`],
    );
    return result.rows;
  }
}
