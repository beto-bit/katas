import { BaseParser, ParseResult } from "./base.parser.ts";
import { ExcelParser } from "./excel.parser.ts";
import { logger } from "../utils/logger.ts";
import { parseNumber, sanitizeString } from "../utils/validators.ts";

export class PayrollParser extends BaseParser {
  async parse(buffer: Uint8Array, filename: string): Promise<ParseResult> {
    logger.info(`Parsing payroll file: ${filename}`);

    const excelParser = new ExcelParser();
    const rawResult = await excelParser.parse(buffer, filename);

    const nodes: any[] = [];
    const edges: any[] = [];
    const nodeMap = new Map<string, number>();
    const unitMap = new Map<string, number>();

    // Extract year/month from filename or use current
    const yearMatch = filename.match(/(20\d{2})/);
    const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
    const monthMatch = filename.match(
      /enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre/i,
    );
    const monthMap: Record<string, number> = {
      enero: 1,
      febrero: 2,
      marzo: 3,
      abril: 4,
      mayo: 5,
      junio: 6,
      julio: 7,
      agosto: 8,
      septiembre: 9,
      octubre: 10,
      noviembre: 11,
      diciembre: 12,
    };
    const month = monthMatch
      ? monthMap[monthMatch[0].toLowerCase()]
      : undefined;

    for (const rowNode of rawResult.nodes) {
      const props = rowNode.properties;

      // Look for employee data
      const nombre = props["NOMBRE EMPLEADO"]?.toString().trim();
      const puesto = props["PUESTO OFICIAL"]?.toString().trim();
      const unidad = props["UNIDAD ADMINISTRATIVA"]?.toString().trim();
      const renglon = props["REN"]?.toString().trim() || "011";
      const salarioNominal = parseNumber(
        props["SALARIO NOMINAL CALCULADO POR MES CALENDARIO"],
      );

      if (!nombre || !puesto) continue;

      let unitId: number | undefined;
      if (unidad) {
        const unitKey = `Unit|${sanitizeString(unidad)}`;
        if (!unitMap.has(unitKey)) {
          const unitNode = this.createNode(
            "AdministrativeUnit",
            sanitizeString(unidad),
            {
              tipo: unidad.includes("MINISTERIO") ? "Ministerial" : "Other",
            },
          );
          nodes.push(unitNode);
          unitMap.set(unitKey, nodes.length - 1);
        }
        unitId = unitMap.get(unitKey);
      }

      const employeeKey = `Employee|${nombre}|${renglon}`;
      if (!nodeMap.has(employeeKey)) {
        const employeeNode = this.createNode(
          "Employee",
          sanitizeString(nombre),
          {
            puesto: sanitizeString(puesto),
            renglon,
            salario_mensual: salarioNominal,
            año: year,
            mes: month,
          },
        );
        nodes.push(employeeNode);
        nodeMap.set(employeeKey, nodes.length - 1);

        if (unitId !== undefined) {
          edges.push(
            this.createEdge(
              nodes.length - 1,
              unitId,
              "WORKS_IN",
              salarioNominal,
            ),
          );
        }
      }
    }

    logger.info(
      `Payroll parsing complete: ${nodes.length} nodes, ${edges.length} edges`,
    );

    return {
      nodes,
      edges,
      metadata: {
        filename,
        filetype: "payroll",
        year,
        month,
        rowsProcessed: rawResult.metadata.rowsProcessed,
      },
    };
  }
}
