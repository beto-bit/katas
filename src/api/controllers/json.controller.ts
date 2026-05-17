import { Context } from "oak";
import { GraphBuilder } from "../../graph/builder.ts";
import { Repository } from "../../storage/repository.ts";
import { logger } from "../../utils/logger.ts";

const repo = new Repository();
const graphBuilder = new GraphBuilder(repo);

export const jsonController = {
  async uploadJSON(ctx: Context) {
    try {
      const body = await ctx.request.body({ type: "json" }).value;

      if (!body.type || !body.nodes || !Array.isArray(body.nodes)) {
        ctx.response.status = 400;
        ctx.response.body = {
          error:
            "Invalid JSON format. Expected: { type: string, nodes: array, edges?: array }",
        };
        return;
      }

      if (!["budget", "payroll", "custom"].includes(body.type)) {
        ctx.response.status = 400;
        ctx.response.body = {
          error: "Invalid type. Must be 'budget', 'payroll', or 'custom'",
        };
        return;
      }

      const nodes = body.nodes.map((node: any, index: number) => ({
        label: node.label || "any",
        name: node.name || `Node_${index}`,
        properties: {
          ...node.properties,
          _source: body.source || "json_upload",
          _year: body.year,
          _month: body.month,
          _type: body.type,
        },
      }));

      // CORREGIDO: Usar source_name y target_name en lugar de source_id/target_id con 0
      const edges = (body.edges || []).map((edge: any) => ({
        source_name: edge.source_name || edge.source,
        target_name: edge.target_name || edge.target,
        relation_type: edge.relation_type || "RELATED_TO",
        weight: edge.weight || 1,
        properties: edge.properties || {},
      }));

      const result = await graphBuilder.buildFromParseResult(nodes, edges, {
        filename: body.source || "json_upload",
        filetype: body.type,
        year: body.year,
        month: body.month,
        rowsProcessed: nodes.length,
      });

      ctx.response.body = {
        success: true,
        type: body.type,
        source: body.source,
        nodesSaved: result.nodesSaved,
        edgesSaved: result.edgesSaved,
        timestamp: new Date().toISOString(),
      };

      logger.info(
        `JSON upload: ${result.nodesSaved} nodes, ${result.edgesSaved} edges`,
      );
    } catch (error) {
      logger.error(`JSON upload error: ${error.message}`);
      ctx.response.status = 500;
      ctx.response.body = { error: error.message };
    }
  },

  async getTemplate(ctx: Context) {
    const type = ctx.params.type;

    const templates: Record<string, any> = {
      budget: {
        type: "budget",
        source: "Nombre de la fuente",
        year: 2024,
        nodes: [
          {
            label: "Program",
            name: "Nombre del programa",
            properties: {
              code: "01",
              total_budget: 1000000,
            },
          },
          {
            label: "Activity",
            name: "Nombre de la actividad",
            properties: {
              code: "001",
              budget: 500000,
            },
          },
        ],
        edges: [
          {
            source_name: "Nombre de la actividad",
            target_name: "Nombre del programa",
            relation_type: "PART_OF",
          },
        ],
      },
      payroll: {
        type: "payroll",
        source: "Nombre de la institución",
        year: 2026,
        month: 1,
        nodes: [
          {
            label: "Employee",
            name: "Nombre completo",
            properties: {
              position: "Cargo",
              salary: 15000,
              unit: "Unidad administrativa",
            },
          },
          {
            label: "AdministrativeUnit",
            name: "Nombre de la unidad",
            properties: {
              type: "Ministerial",
            },
          },
        ],
        edges: [
          {
            source_name: "Nombre completo",
            target_name: "Nombre de la unidad",
            relation_type: "WORKS_IN",
            weight: 15000,
          },
        ],
      },
    };

    ctx.response.body = templates[type] || {
      error: "Template not found. Available: budget, payroll",
    };
  },
};
