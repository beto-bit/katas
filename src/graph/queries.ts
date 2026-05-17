import { getDb } from "../config/db.ts";
import { Edge, Node, PathResult } from "../models/node.ts";

export class GraphQueries {
  async findShortestPath(
    startId: number,
    endId: number,
    maxDepth = 10,
  ): Promise<PathResult | null> {
    const db = getDb();

    const result = await db.queryObject<
      { path: number[]; total_weight: number }
    >(
      `WITH RECURSIVE path_finder AS (
         SELECT 
           ARRAY[source_id, target_id] as node_path,
           weight as total_weight,
           1 as depth,
           target_id as last_node
         FROM edges
         WHERE source_id = $1
         UNION ALL
         SELECT 
           pf.node_path || e.target_id,
           pf.total_weight + COALESCE(e.weight, 0),
           pf.depth + 1,
           e.target_id
         FROM path_finder pf
         JOIN edges e ON pf.last_node = e.source_id
         WHERE pf.depth < $2 AND NOT (e.target_id = ANY(pf.node_path))
       )
       SELECT node_path, total_weight
       FROM path_finder
       WHERE last_node = $3
       ORDER BY depth ASC
       LIMIT 1`,
      [startId, maxDepth, endId],
    );

    if (result.rows.length === 0) return null;

    const path = result.rows[0];
    const nodes = await db.queryObject<Node>(
      `SELECT id, label, name, properties, created_at FROM nodes WHERE id = ANY($1)`,
      [path.node_path],
    );

    return {
      nodes: nodes.rows,
      edges: [],
      totalWeight: path.total_weight || 0,
    };
  }

  async getNeighbors(nodeId: number, relationType?: string): Promise<{
    node: Node;
    neighbors: Array<{ node: Node; relation: Edge }>;
  }> {
    const db = getDb();

    const nodeResult = await db.queryObject<Node>(
      `SELECT id, label, name, properties, created_at FROM nodes WHERE id = $1`,
      [nodeId],
    );

    if (nodeResult.rows.length === 0) {
      throw new Error(`Node ${nodeId} not found`);
    }

    const node = nodeResult.rows[0];

    let query = `
      SELECT n.id, n.label, n.name, n.properties, n.created_at,
             e.id as edge_id, e.source_id, e.target_id, e.relation_type, e.weight, e.properties as edge_properties
      FROM edges e
      JOIN nodes n ON (n.id = e.source_id OR n.id = e.target_id)
      WHERE (e.source_id = $1 OR e.target_id = $1) AND n.id != $1
    `;
    const params: any[] = [nodeId];

    if (relationType) {
      query += ` AND e.relation_type = $2`;
      params.push(relationType);
    }

    const result = await db.queryObject<any>(query, params);

    const neighbors = result.rows.map((row) => ({
      node: {
        id: row.id,
        label: row.label,
        name: row.name,
        properties: row.properties,
        created_at: row.created_at,
      },
      relation: {
        id: row.edge_id,
        source_id: row.source_id,
        target_id: row.target_id,
        relation_type: row.relation_type,
        weight: row.weight,
        properties: row.edge_properties,
      },
    }));

    return { node, neighbors };
  }

  async getGraphSummary(): Promise<{
    totalNodes: number;
    totalEdges: number;
    nodesByLabel: Record<string, number>;
    edgesByType: Record<string, number>;
  }> {
    const db = getDb();

    const nodesCount = await db.queryObject<{ label: string; count: string }>(
      `SELECT label, COUNT(*) as count FROM nodes GROUP BY label`,
    );

    const edgesCount = await db.queryObject<
      { relation_type: string; count: string }
    >(
      `SELECT relation_type, COUNT(*) as count FROM edges GROUP BY relation_type`,
    );

    const nodesByLabel: Record<string, number> = {};
    for (const row of nodesCount.rows) {
      nodesByLabel[row.label] = parseInt(row.count);
    }

    const edgesByType: Record<string, number> = {};
    for (const row of edgesCount.rows) {
      edgesByType[row.relation_type] = parseInt(row.count);
    }

    const totalNodes = Object.values(nodesByLabel).reduce((a, b) => a + b, 0);
    const totalEdges = Object.values(edgesByType).reduce((a, b) => a + b, 0);

    return { totalNodes, totalEdges, nodesByLabel, edgesByType };
  }
}
