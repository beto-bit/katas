import { getDb } from "../config/db.ts";
import { logger } from "../utils/logger.ts";
import { jaccardSimilarity } from "../utils/validators.ts";

export class CorrelationEngine {
  async computeAllCorrelations(): Promise<number> {
    logger.info(
      "Calcular correlaciones entre datos presupuestarios y de nómina.",
    );

    const db = getDb();
    let correlationsCreated = 0;

    // 1. Correlación entre unidades administrativas y programas/actividades
    const units = await db.queryObject<{ id: number; name: string }>(
      `SELECT id, name FROM nodes WHERE label = 'AdministrativeUnit'`,
    );

    const budgetNodes = await db.queryObject<
      { id: number; name: string; properties: any }
    >(
      `SELECT id, name, properties FROM nodes WHERE label IN ('Program', 'Activity', 'ExecutingUnit')`,
    );

    for (const unit of units.rows) {
      for (const budget of budgetNodes.rows) {
        const similarity = jaccardSimilarity(unit.name, budget.name);

        if (similarity > 0.15) {
          // Verificar si ya existe
          const existing = await db.queryObject(
            `SELECT id FROM edges WHERE source_id = $1 AND target_id = $2 AND relation_type = 'CORRELATED_WITH'`,
            [unit.id, budget.id],
          );

          if (existing.rows.length === 0) {
            await db.queryObject(
              `INSERT INTO edges (source_id, target_id, relation_type, weight, properties)
               VALUES ($1, $2, $3, $4, $5)`,
              [unit.id, budget.id, "CORRELATED_WITH", similarity, {
                method: "textual_similarity",
              }],
            );
            correlationsCreated++;
            logger.info(
              `Correlation: ${unit.name} <-> ${budget.name} (${similarity})`,
            );
          }
        }
      }
    }

    // 2. Correlación por montos
    const employees = await db.queryObject<{ id: number; properties: any }>(
      `SELECT id, properties FROM nodes WHERE label = 'Employee'`,
    );

    const programs = await db.queryObject<{ id: number; properties: any }>(
      `SELECT id, properties FROM nodes WHERE label = 'Program'`,
    );

    for (const employee of employees.rows) {
      const salary = employee.properties.total_salary ||
        employee.properties.salary_base || 0;

      for (const program of programs.rows) {
        const budget = program.properties.budget_2023 ||
          program.properties.budget_2022 || 0;

        if (salary > 20000 && budget > 50000000) {
          const weight = Math.min(salary / budget, 0.5);

          const existing = await db.queryObject(
            `SELECT id FROM edges WHERE source_id = $1 AND target_id = $2 AND relation_type = 'CORRELATED_WITH'`,
            [employee.id, program.id],
          );

          if (existing.rows.length === 0) {
            await db.queryObject(
              `INSERT INTO edges (source_id, target_id, relation_type, weight, properties)
               VALUES ($1, $2, $3, $4, $5)`,
              [employee.id, program.id, "CORRELATED_WITH", weight, {
                method: "budget_salary_ratio",
              }],
            );
            correlationsCreated++;
          }
        }
      }
    }

    logger.info(`Se crearon ${correlationsCreated} aristas de correlación`);
    return correlationsCreated;
  }

  async getCorrelationsForNode(
    nodeId: number,
    minWeight = 0.1,
  ): Promise<any[]> {
    const db = getDb();
    const result = await db.queryObject(
      `SELECT n.id, n.label, n.name, n.properties, e.weight, e.properties as edge_properties
       FROM edges e
       JOIN nodes n ON (n.id = e.source_id OR n.id = e.target_id)
       WHERE (e.source_id = $1 OR e.target_id = $1)
         AND e.relation_type = 'CORRELATED_WITH'
         AND e.weight >= $2
         AND n.id != $1`,
      [nodeId, minWeight],
    );

    return result.rows;
  }
}
