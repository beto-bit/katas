import { Edge, Node } from "../models/node.ts";

export interface ParseResult {
  nodes: Node[];
  edges: Edge[];
  metadata: {
    filename: string;
    filetype: string;
    year?: number;
    month?: number;
    rowsProcessed: number;
  };
}

export abstract class BaseParser {
  abstract parse(buffer: Uint8Array, filename: string): Promise<ParseResult>;

  protected createNode(
    label: string,
    name: string,
    properties: Record<string, any> = {},
  ): Node {
    return {
      label,
      name: name.substring(0, 500), // Limit length
      properties,
    };
  }

  protected createEdge(
    sourceId: number,
    targetId: number,
    relationType: string,
    weight?: number,
    properties: Record<string, any> = {},
  ): Edge {
    return {
      source_id: sourceId,
      target_id: targetId,
      relation_type: relationType,
      weight,
      properties,
    };
  }
}
