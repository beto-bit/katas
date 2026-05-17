export interface Node {
  id?: number;
  label: string;
  name: string;
  properties: Record<string, unknown>;
  created_at?: Date;
}

export interface NodeWithRelations extends Node {
  outgoing: Edge[];
  incoming: Edge[];
}

export interface Edge {
  id?: number;
  source_id: number;
  target_id: number;
  relation_type: string;
  weight?: number;
  properties?: Record<string, unknown>;
  created_at?: Date;
}

export interface PathResult {
  nodes: Node[];
  edges: Edge[];
  totalWeight: number;
}
