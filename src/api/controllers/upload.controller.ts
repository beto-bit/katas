import { Context } from "oak";
import { ensureDir } from "fs";
import { BudgetParser } from "../../parsers/budget.parser.ts";
import { PayrollParser } from "../../parsers/payroll.parser.ts";
import { GraphBuilder } from "../../graph/builder.ts";
import { Repository } from "../../storage/repository.ts";
import { logger } from "../../utils/logger.ts";
import { isValidExcelFile } from "../../utils/validators.ts";

const uploadDir = Deno.env.get("UPLOAD_DIR") || "./uploads";
const repo = new Repository();
const graphBuilder = new GraphBuilder(repo);

export const uploadController = {
  async uploadBudget(ctx: Context) {
    await handleUpload(ctx, "budget");
  },

  async uploadPayroll(ctx: Context) {
    await handleUpload(ctx, "payroll");
  },
};

async function handleUpload(ctx: Context, type: "budget" | "payroll") {
  try {
    await ensureDir(uploadDir);

    const body = ctx.request.body({ type: "form-data" });
    const formData = await body.value.read();

    const file = formData.files?.[0];
    if (!file) {
      ctx.response.status = 400;
      ctx.response.body = { error: "No file uploaded" };
      return;
    }

    // Get original filename (may have spaces)
    const originalName = file.originalName || file.filename;
    logger.info(`Received file: ${originalName}`);

    if (!isValidExcelFile(originalName)) {
      ctx.response.status = 400;
      ctx.response.body = {
        error:
          "Invalid file type. Only Excel files allowed (.xlsx, .xls, .ods)",
        received: originalName,
        extension: originalName.split(".").pop(),
      };
      return;
    }

    // Read file content
    let fileContent: Uint8Array;
    if (file.content) {
      fileContent = file.content;
    } else if (file.filename) {
      fileContent = await Deno.readFile(file.filename);
    } else {
      ctx.response.status = 400;
      ctx.response.body = { error: "Could not read file content" };
      return;
    }

    // Parse based on type
    let parseResult;
    if (type === "budget") {
      const parser = new BudgetParser();
      parseResult = await parser.parse(fileContent, originalName);
    } else {
      const parser = new PayrollParser();
      parseResult = await parser.parse(fileContent, originalName);
    }

    // Build graph
    const result = await graphBuilder.buildFromParseResult(
      parseResult.nodes,
      parseResult.edges,
      parseResult.metadata,
    );

    ctx.response.body = {
      success: true,
      type,
      filename: originalName,
      nodesSaved: result.nodesSaved,
      edgesSaved: result.edgesSaved,
      metadata: parseResult.metadata,
    };

    logger.info(`Uploaded ${type} file: ${originalName}`);
  } catch (error) {
    logger.error(`Upload error: ${error.message}`);
    logger.error(error.stack);
    ctx.response.status = 500;
    ctx.response.body = { error: error.message, stack: error.stack };
  }
}
