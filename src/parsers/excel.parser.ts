import * as XLSX from "xlsx";
import { BaseParser, ParseResult } from "./base.parser.ts";
import { logger } from "../utils/logger.ts";

export class ExcelParser extends BaseParser {
  async parse(buffer: Uint8Array, filename: string): Promise<ParseResult> {
    logger.info(`Parsing Excel file: ${filename}`);

    const workbook = XLSX.read(buffer, {
      type: "buffer",
      cellDates: true,
      cellNF: false,
      cellText: false,
    });

    const allNodes: any[] = [];
    const allEdges: any[] = [];
    let totalRows = 0;

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
        blankrows: false,
      });

      if (rawData.length < 2) continue;

      let headerRowIndex = 0;
      while (
        headerRowIndex < rawData.length &&
        rawData[headerRowIndex].every((cell) => !cell || cell === "")
      ) {
        headerRowIndex++;
      }

      if (headerRowIndex >= rawData.length) continue;

      const headers = rawData[headerRowIndex].map((h: any) =>
        h?.toString().trim().replace(/\s+/g, " ") || `col_${Math.random()}`
      );

      for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.every((cell) => cell === undefined || cell === "")) {
          continue;
        }

        const obj: Record<string, any> = {};
        for (let j = 0; j < headers.length; j++) {
          obj[headers[j]] = row[j] !== undefined ? row[j] : "";
        }

        obj._sheet = sheetName;
        obj._rowNum = i;

        const node = this.createNode("RawRow", `${sheetName}_row_${i}`, obj);
        allNodes.push(node);
        totalRows++;
      }
    }

    logger.info(`Parsed ${totalRows} rows from ${filename}`);

    return {
      nodes: allNodes,
      edges: allEdges,
      metadata: {
        filename,
        filetype: filename.split(".").pop() || "xlsx",
        rowsProcessed: totalRows,
      },
    };
  }
}
