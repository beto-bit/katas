import { getDb } from "../config/db.ts";
import { Edge, Node } from "../models/node.ts";
import { logger } from "../utils/logger.ts";

export class GraphBuilder {
  private repo: any;

  constructor(repo: any) {
    this.repo = repo;
  }

  async buildFromParseResult(
    nodes: Node[],
    edges: Edge[],
    metadata: any,
  ): Promise<{ nodesSaved: number; edgesSaved: number }> {
    const db = getDb();
    logger.info(
      `Construyendo un grafo a partir de ${nodes.length} nodos y ${edges.length} aristas`,
    );

    // First, save all nodes and create a name->id mapping
    const nameToId = new Map<string, number>();
    let nodesSaved = 0;

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
        nodesSaved++;
      }

      const key = `${node.label}|${node.name}`;
      nameToId.set(key, id);
      // Also store by name alone for flexibility
      nameToId.set(node.name, id);
    }

    // Now process edges, resolving source and target by name
    let edgesSaved = 0;
    for (const edge of edges) {
      let sourceId: number | null = null;
      let targetId: number | null = null;

      // Try different ways to resolve source
      if (edge.source_id && typeof edge.source_id === "number") {
        sourceId = edge.source_id;
      } else if (edge.source_name) {
        sourceId = nameToId.get(edge.source_name) || null;
      } else if (edge.source) {
        sourceId = nameToId.get(edge.source) || null;
      }

      // Try different ways to resolve target
      if (edge.target_id && typeof edge.target_id === "number") {
        targetId = edge.target_id;
      } else if (edge.target_name) {
        targetId = nameToId.get(edge.target_name) || null;
      } else if (edge.target) {
        targetId = nameToId.get(edge.target) || null;
      }

      if (sourceId && targetId) {
        const existing = await db.queryObject(
          "SELECT id FROM edges WHERE source_id = $1 AND target_id = $2 AND relation_type = $3",
          [sourceId, targetId, edge.relation_type],
        );

        if (existing.rows.length === 0) {
          await db.queryObject(
            `INSERT INTO edges (source_id, target_id, relation_type, weight, properties) 
             VALUES ($1, $2, $3, $4, $5)`,
            [
              sourceId,
              targetId,
              edge.relation_type,
              edge.weight || 1,
              edge.properties || {},
            ],
          );
          edgesSaved++;
          logger.info(
            `Created edge: ${edge.relation_type} from ${sourceId} to ${targetId}`,
          );
        }
      } else {
        logger.warn(
          `Could not resolve edge: source=${
            edge.source || edge.source_name
          }, target=${edge.target || edge.target_name}`,
        );
      }
    }

    logger.info(
      `Creación del grafo completada: ${nodesSaved} nodos guardados, ${edgesSaved} aristas guardadas`,
    );

    return { nodesSaved, edgesSaved };
  }
}
