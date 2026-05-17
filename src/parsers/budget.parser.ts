import { BaseParser, ParseResult } from "./base.parser.ts";
import { ExcelParser } from "./excel.parser.ts";
import { logger } from "../utils/logger.ts";
import { parseNumber, sanitizeString } from "../utils/validators.ts";

export class BudgetParser extends BaseParser {
  async parse(buffer: Uint8Array, filename: string): Promise<ParseResult> {
    logger.info(`Parsing budget file: ${filename}`);

    const excelParser = new ExcelParser();
    const rawResult = await excelParser.parse(buffer, filename);

    const nodes: any[] = [];
    const edges: any[] = [];
    const nodeMap = new Map<string, number>();

    let tempId = 1;

    for (const rowNode of rawResult.nodes) {
      const props = rowNode.properties;
      const sheet = props._sheet;

      if (sheet.includes("CUADRO1") || sheet.includes("CUADRO")) {
        await this.processBudgetRow(props, nodes, edges, nodeMap, tempId);
        tempId++;
      }

      if (sheet.includes("CUADRO7")) {
        await this.processExecutingUnit(props, nodes, edges, nodeMap, tempId);
        tempId++;
      }
    }

    logger.info(
      `Budget parsing complete: ${nodes.length} nodes, ${edges.length} edges`,
    );

    return {
      nodes,
      edges,
      metadata: {
        filename,
        filetype: "budget",
        rowsProcessed: rawResult.metadata.rowsProcessed,
      },
    };
  }

  private async processBudgetRow(
    props: Record<string, any>,
    nodes: any[],
    edges: any[],
    nodeMap: Map<string, number>,
    tempId: number,
  ) {
    const programa = props["PROGRAMA"]?.toString().trim();
    const subprograma = props["SUBPROGRAMA"]?.toString().trim();
    const proyecto = props["PROYECTO"]?.toString().trim();
    const actividad = props["ACTIVIDAD"]?.toString().trim();
    const descripcion = sanitizeString(props["DESCRIPCIÓN"]?.toString() || "");
    const aprobado2021 = parseNumber(props["APROBADO 2021 (*)"]);
    const aprobado2022 = parseNumber(props["APROBADO 2022"]);

    if (!descripcion || (aprobado2021 === 0 && aprobado2022 === 0)) return;

    let lastNodeId: number | null = null;

    if (programa && programa !== "" && !programa.includes("Sin")) {
      const programKey = `Program|${programa}`;
      if (!nodeMap.has(programKey)) {
        const programNode = this.createNode("Program", programa, {
          codigo: programa,
        });
        nodes.push(programNode);
        nodeMap.set(programKey, nodes.length - 1);
      }
      lastNodeId = nodeMap.get(programKey)!;
    }

    if (subprograma && subprograma !== "" && lastNodeId !== null) {
      const subprogramKey = `Subprogram|${subprograma}`;
      if (!nodeMap.has(subprogramKey)) {
        const subprogramNode = this.createNode("Subprogram", subprograma, {
          codigo: subprograma,
        });
        nodes.push(subprogramNode);
        nodeMap.set(subprogramKey, nodes.length - 1);
        // Create PART_OF edge
        edges.push(this.createEdge(nodes.length - 1, lastNodeId, "PART_OF"));
      }
      lastNodeId = nodeMap.get(subprogramKey)!;
    }

    if (proyecto && proyecto !== "" && lastNodeId !== null) {
      const projectKey = `Project|${proyecto}`;
      if (!nodeMap.has(projectKey)) {
        const projectNode = this.createNode("Project", proyecto, {
          codigo: proyecto,
        });
        nodes.push(projectNode);
        nodeMap.set(projectKey, nodes.length - 1);
        edges.push(this.createEdge(nodes.length - 1, lastNodeId, "PART_OF"));
      }
      lastNodeId = nodeMap.get(projectKey)!;
    }

    if (actividad && actividad !== "" && lastNodeId !== null) {
      const activityKey = `Activity|${actividad}|${descripcion}`;
      if (!nodeMap.has(activityKey)) {
        const activityNode = this.createNode("Activity", descripcion, {
          codigo: actividad,
          aprobado2021,
          aprobado2022,
        });
        nodes.push(activityNode);
        nodeMap.set(activityKey, nodes.length - 1);
        edges.push(this.createEdge(nodes.length - 1, lastNodeId, "PART_OF"));
      }
      lastNodeId = nodeMap.get(activityKey)!;

      if (aprobado2022 > 0) {
        const budgetKey = `Budget|${descripcion}|2022`;
        if (!nodeMap.has(budgetKey)) {
          const budgetNode = this.createNode(
            "BudgetAllocation",
            `${descripcion} 2022`,
            {
              año: 2022,
              monto: aprobado2022,
              descripcion,
            },
          );
          nodes.push(budgetNode);
          nodeMap.set(budgetKey, nodes.length - 1);
          edges.push(
            this.createEdge(
              nodes.length - 1,
              lastNodeId,
              "FUNDS",
              aprobado2022,
            ),
          );
        }
      }
    }
  }

  private async processExecutingUnit(
    props: Record<string, any>,
    nodes: any[],
    edges: any[],
    nodeMap: Map<string, number>,
    tempId: number,
  ) {
    const codigo = props["CÓDIGO"]?.toString().trim();
    const descripcion = sanitizeString(props["DESCRIPCIÓN"]?.toString() || "");
    const aprobado2021 = parseNumber(props["APROBADO 2021 (*)"]);
    const aprobado2022 = parseNumber(props["APROBADO 2022"]);

    if (!codigo || !descripcion) return;

    const unitKey = `ExecutingUnit|${codigo}`;
    if (!nodeMap.has(unitKey)) {
      const unitNode = this.createNode("ExecutingUnit", descripcion, {
        codigo,
        aprobado2021,
        aprobado2022,
      });
      nodes.push(unitNode);
      nodeMap.set(unitKey, nodes.length - 1);
    }
  }
}
