import * as XLSX from "xlsx";

interface ParsedData {
  type: string;
  source: string;
  year: number;
  month?: number;
  nodes: any[];
  edges: any[];
}

function detectFileType(filename: string, sheets: string[]): string {
  const lowerName = filename.toLowerCase();
  const lowerSheets = sheets.join(" ").toLowerCase();

  if (lowerName.includes("presupuesto") || lowerSheets.includes("cuadro1")) {
    return "budget";
  }
  if (
    lowerName.includes("nomina") || lowerName.includes("nom") ||
    lowerSheets.includes("renglon")
  ) {
    return "payroll";
  }
  return "custom";
}

function extractYear(filename: string): number {
  const matches = filename.match(/20\d{2}/g);
  if (matches && matches.length > 0) {
    return parseInt(matches[0]);
  }
  return new Date().getFullYear();
}

function extractMonth(filename: string): number | undefined {
  const months = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  const lowerName = filename.toLowerCase();
  for (let i = 0; i < months.length; i++) {
    if (lowerName.includes(months[i])) {
      return i + 1;
    }
  }
  return undefined;
}

function parseNumber(value: any): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[=()Qq,]/g, "").trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

function parseBudgetSheet(
  sheetData: any[][],
  year: number,
): { nodes: any[]; edges: any[] } {
  const nodes: any[] = [];
  const edges: any[] = [];
  const nodeMap = new Map<string, number>();

  let currentProgram: string | null = null;
  let currentSubprogram: string | null = null;
  let currentProject: string | null = null;

  for (let i = 0; i < sheetData.length; i++) {
    const row = sheetData[i];
    if (!row || row.length < 5) continue;

    const programa = row[0]?.toString().trim();
    const subprograma = row[1]?.toString().trim();
    const proyecto = row[2]?.toString().trim();
    const actividad = row[3]?.toString().trim();
    const descripcion = row[5]?.toString().trim();
    const aprobado2021 = parseNumber(row[6]);
    const aprobado2022 = parseNumber(row[7]);

    if (!descripcion || (aprobado2021 === 0 && aprobado2022 === 0)) continue;
    if (
      descripcion.includes("PARA EL") || descripcion.includes("TOTAL:") ||
      descripcion.includes("SIN")
    ) continue;

    if (
      programa && programa !== "" && !programa.includes("Sin") &&
      !programa.includes("TOTAL")
    ) {
      currentProgram = programa;
      currentSubprogram = null;
      currentProject = null;

      nodes.push({
        label: "Program",
        name: descripcion,
        properties: {
          code: programa,
          budget_2021: aprobado2021,
          budget_2022: aprobado2022,
        },
      });
      nodeMap.set(`Program|${descripcion}`, nodes.length - 1);
    } else if (
      subprograma && subprograma !== "" && subprograma !== "00" &&
      currentProgram
    ) {
      currentSubprogram = subprograma;
      currentProject = null;

      nodes.push({
        label: "Subprogram",
        name: descripcion,
        properties: { code: subprograma, parent_program: currentProgram },
      });
      const subIndex = nodes.length - 1;
      nodeMap.set(`Subprogram|${descripcion}`, subIndex);

      const programIndex = nodeMap.get(
        `Program|${
          nodes.find((n) =>
            n.label === "Program" && n.properties.code === currentProgram
          )?.name
        }`,
      );
      if (programIndex !== undefined) {
        edges.push({
          source_name: descripcion,
          target_name: nodes[programIndex].name,
          relation_type: "PART_OF",
        });
      }
    } else if (
      proyecto && proyecto !== "" && proyecto !== "000" && currentSubprogram
    ) {
      currentProject = proyecto;

      nodes.push({
        label: "Project",
        name: descripcion,
        properties: { code: proyecto, parent_subprogram: currentSubprogram },
      });
      const projIndex = nodes.length - 1;
      nodeMap.set(`Project|${descripcion}`, projIndex);

      const subIndex = nodeMap.get(
        `Subprogram|${
          nodes.find((n) =>
            n.label === "Subprogram" && n.properties.code === currentSubprogram
          )?.name
        }`,
      );
      if (subIndex !== undefined) {
        edges.push({
          source_name: descripcion,
          target_name: nodes[subIndex].name,
          relation_type: "PART_OF",
        });
      }
    } else if (
      actividad && actividad !== "" && actividad !== "000" && descripcion
    ) {
      nodes.push({
        label: "Activity",
        name: descripcion,
        properties: {
          code: actividad,
          budget_2021: aprobado2021,
          budget_2022: aprobado2022,
        },
      });

      let targetName: string | null = null;
      if (currentProject) {
        targetName = nodes.find((n) =>
          n.label === "Project" && n.properties.code === currentProject
        )?.name;
      } else if (currentSubprogram) {
        targetName = nodes.find((n) =>
          n.label === "Subprogram" && n.properties.code === currentSubprogram
        )?.name;
      } else if (currentProgram) {
        targetName = nodes.find((n) =>
          n.label === "Program" && n.properties.code === currentProgram
        )?.name;
      }

      if (targetName) {
        edges.push({
          source_name: descripcion,
          target_name: targetName,
          relation_type: "PART_OF",
        });
      }
    }
  }

  return { nodes, edges };
}

function parseExecutingUnits(
  sheetData: any[][],
  year: number,
): { nodes: any[]; edges: any[] } {
  const nodes: any[] = [];

  for (let i = 0; i < sheetData.length; i++) {
    const row = sheetData[i];
    if (!row || row.length < 3) continue;

    const codigo = row[0]?.toString().trim();
    const descripcion = row[1]?.toString().trim();
    const aprobado2022 = parseNumber(row[2]);

    if (!codigo || !descripcion || codigo === "CÓDIGO" || codigo === "TOTAL:") {
      continue;
    }
    if (codigo.includes("CÓDIGO")) continue;

    if (!isNaN(parseInt(codigo))) {
      nodes.push({
        label: "ExecutingUnit",
        name: descripcion,
        properties: { code: codigo, budget_2022: aprobado2022, year: year },
      });
    }
  }

  return { nodes, edges: [] };
}

function parsePayrollSheet(
  sheetData: any[][],
  year: number,
  month?: number,
): { nodes: any[]; edges: any[] } {
  const nodes: any[] = [];
  const edges: any[] = [];
  const unitMap = new Map<string, number>();

  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(30, sheetData.length); i++) {
    const row = sheetData[i];
    if (
      row &&
      row.some((cell) => cell && cell.toString().includes("NOMBRE EMPLEADO"))
    ) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    console.log("  No se encontraron encabezados de nómina");
    return { nodes, edges };
  }

  const headers = sheetData[headerRowIndex].map((h: any) =>
    h?.toString().trim() || ""
  );

  const colIndex = {
    puesto: headers.findIndex((h) => h.includes("PUESTO")),
    nombre: headers.findIndex((h) => h.includes("NOMBRE EMPLEADO")),
    renglon: headers.findIndex((h) => h === "REN"),
    unidad: headers.findIndex((h) => h.includes("UNIDAD ADMINISTRATIVA")),
    salarioBase: headers.findIndex((h) => h.includes("SALARIO BASE")),
    salarioNominal: headers.findIndex((h) => h.includes("SALARIO NOMINAL")),
    bonoServicios: headers.findIndex((h) => h.includes("BONO SERVICIOS")),
    bonoAntiguedad: headers.findIndex((h) => h.includes("ANTIGÜEDAD")),
    bonoProfesional: headers.findIndex((h) => h.includes("PROFESIONAL")),
    complemento: headers.findIndex((h) => h.includes("COMPLEMENTO SALARIAL")),
    gastosRepresentacion: headers.findIndex((h) =>
      h.includes("GASTOS DE REPRESENTACION")
    ),
  };

  let processed = 0;
  for (let i = headerRowIndex + 1; i < sheetData.length; i++) {
    const row = sheetData[i];
    if (!row || row.length === 0) continue;

    const nombre = row[colIndex.nombre]?.toString().trim();
    const puesto = row[colIndex.puesto]?.toString().trim();
    const unidad = row[colIndex.unidad]?.toString().trim();
    const renglon = row[colIndex.renglon]?.toString().trim() || "011";

    if (!nombre || !puesto) continue;
    if (nombre === "NOMBRE EMPLEADO") continue;

    const salarioBase = parseNumber(row[colIndex.salarioBase]);
    const bonoServicios = parseNumber(row[colIndex.bonoServicios]);
    const bonoAntiguedad = parseNumber(row[colIndex.bonoAntiguedad]);
    const bonoProfesional = parseNumber(row[colIndex.bonoProfesional]);
    const complemento = parseNumber(row[colIndex.complemento]);
    const gastosRep = parseNumber(row[colIndex.gastosRepresentacion]);
    const salarioNominal = parseNumber(row[colIndex.salarioNominal]) ||
      (salarioBase + bonoServicios + bonoAntiguedad + bonoProfesional +
        complemento + gastosRep);

    nodes.push({
      label: "Employee",
      name: nombre,
      properties: {
        position: puesto,
        renglon: renglon,
        salary_base: salarioBase,
        bono_servicios: bonoServicios,
        bono_antiguedad: bonoAntiguedad,
        bono_profesional: bonoProfesional,
        complemento_salarial: complemento,
        gastos_representacion: gastosRep,
        total_salary: salarioNominal,
        unit: unidad,
        year: year,
        month: month,
      },
    });

    if (unidad && unidad !== "UNIDAD ADMINISTRATIVA") {
      let unitIndex = unitMap.get(unidad);
      if (unitIndex === undefined) {
        nodes.push({
          label: "AdministrativeUnit",
          name: unidad,
          properties: {
            type: unidad.includes("MINISTERIO")
              ? "Ministerial"
              : unidad.includes("VICEMINISTERIO")
              ? "Viceministerial"
              : "Other",
          },
        });
        unitIndex = nodes.length - 1;
        unitMap.set(unidad, unitIndex);
      }

      edges.push({
        source_name: nombre,
        target_name: unidad,
        relation_type: "WORKS_IN",
        weight: salarioNominal,
      });
    }

    processed++;
  }

  console.log(`  Procesados ${processed} empleados`);
  return { nodes, edges };
}

function convertExcelToJSON(filePath: string, outputPath?: string): ParsedData {
  console.log(`\n📄 Leyendo archivo: ${filePath}`);

  const data = Deno.readFileSync(filePath);
  const workbook = XLSX.read(data, { type: "buffer" });
  const sheets = workbook.SheetNames;
  const filename = filePath.split("/").pop() || filePath;
  const fileType = detectFileType(filename, sheets);
  const year = extractYear(filename);
  const month = extractMonth(filename);

  console.log(`  Tipo: ${fileType}`);
  console.log(`  Año: ${year}`);
  if (month) console.log(`  Mes: ${month}`);
  console.log(`  Hojas: ${sheets.join(", ")}`);

  let allNodes: any[] = [];
  let allEdges: any[] = [];

  for (const sheetName of sheets) {
    console.log(`\n  📑 Procesando hoja: ${sheetName}`);
    const worksheet = workbook.Sheets[sheetName];
    const sheetData: any[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
    });

    if (fileType === "budget") {
      if (sheetName.includes("CUADRO1") || sheetName === "CUADRO1") {
        const result = parseBudgetSheet(sheetData, year);
        allNodes = allNodes.concat(result.nodes);
        allEdges = allEdges.concat(result.edges);
        console.log(
          `    Nodos: ${result.nodes.length}, Aristas: ${result.edges.length}`,
        );
      } else if (sheetName.includes("CUADRO7") || sheetName === "CUADRO7") {
        const result = parseExecutingUnits(sheetData, year);
        allNodes = allNodes.concat(result.nodes);
        allEdges = allEdges.concat(result.edges);
        console.log(
          `    Nodos: ${result.nodes.length}, Aristas: ${result.edges.length}`,
        );
      }
    } else if (fileType === "payroll") {
      const result = parsePayrollSheet(sheetData, year, month);
      allNodes = allNodes.concat(result.nodes);
      allEdges = allEdges.concat(result.edges);
      console.log(
        `    Nodos: ${result.nodes.length}, Aristas: ${result.edges.length}`,
      );
    }
  }

  const uniqueNodes = [];
  const nodeKeys = new Set();
  for (const node of allNodes) {
    const key = `${node.label}|${node.name}`;
    if (!nodeKeys.has(key)) {
      nodeKeys.add(key);
      uniqueNodes.push(node);
    }
  }

  const uniqueEdges = [];
  const edgeKeys = new Set();
  for (const edge of allEdges) {
    const key = `${edge.source_name}|${edge.target_name}|${edge.relation_type}`;
    if (!edgeKeys.has(key)) {
      edgeKeys.add(key);
      uniqueEdges.push(edge);
    }
  }

  const result: ParsedData = {
    type: fileType,
    source: filename,
    year: year,
    nodes: uniqueNodes,
    edges: uniqueEdges,
  };

  if (month) {
    result.month = month;
  }

  console.log(`\n✅ Resumen final:`);
  console.log(`   Nodos únicos: ${uniqueNodes.length}`);
  console.log(`   Aristas únicas: ${uniqueEdges.length}`);

  if (outputPath) {
    Deno.writeTextFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`   Guardado en: ${outputPath}`);
  }

  return result;
}

if (import.meta.main) {
  const args = Deno.args;
  if (args.length < 1) {
    console.log(
      "Uso: deno run --allow-read --allow-write excel-to-json.ts <archivo_excel> [archivo_salida.json]",
    );
    Deno.exit(1);
  }

  let inputPath = args[0];
  if (inputPath.startsWith("~")) {
    inputPath = Deno.env.get("HOME") + inputPath.slice(1);
  }

  const uploadDir = "/home/angel/Escritorio/katas/uploads";
  const filename = inputPath.split("/").pop() || "output";
  const outputPath = args[1] ||
    `${uploadDir}/${filename.replace(/\.(xlsx|xls|ods)$/i, ".json")}`;

  try {
    convertExcelToJSON(inputPath, outputPath);
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    Deno.exit(1);
  }
}
