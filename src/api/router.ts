import { Router } from "oak";
import { graphController } from "./controllers/graph.controller.ts";
import { correlationsController } from "./controllers/correlations.controller.ts";
import { jsonController } from "./controllers/json.controller.ts";

const router = new Router();

router.post("/api/data/upload", jsonController.uploadJSON);
router.get("/api/data/template/:type", jsonController.getTemplate);

router.get("/api/graph/nodes", graphController.getNodes);
router.get("/api/graph/nodes/:id", graphController.getNodeById);
router.get("/api/graph/edges", graphController.getEdges);
router.get("/api/graph/neighbors/:nodeId", graphController.getNeighbors);
router.get("/api/graph/path", graphController.findPath);
router.get("/api/graph/search", graphController.search);
router.get("/api/graph/summary", graphController.getSummary);

router.post("/api/correlations/run", correlationsController.runCorrelations);
router.get("/api/correlations/results", correlationsController.getCorrelations);
router.get(
  "/api/correlations/between",
  correlationsController.getCorrelationBetween,
);

router.get("/api/health", (ctx) => {
  ctx.response.body = { status: "ok", timestamp: new Date().toISOString() };
});

export default router;
