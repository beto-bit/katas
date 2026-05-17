import { Context } from "oak";
import { Repository } from "../../storage/repository.ts";
import { GraphQueries } from "../../graph/queries.ts";

const repo = new Repository();
const queries = new GraphQueries();

export const graphController = {
  async getNodes(ctx: Context) {
    const url = new URL(ctx.request.url);
    const label = url.searchParams.get("label") || undefined;
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const nodes = await repo.getNodes(label, limit, offset);
    ctx.response.body = { nodes, total: nodes.length, limit, offset };
  },

  async getNodeById(ctx: Context) {
    const id = parseInt(ctx.params.id);
    const node = await repo.getNodeById(id);

    if (!node) {
      ctx.response.status = 404;
      ctx.response.body = { error: "Node not found" };
      return;
    }

    const edges = await repo.getEdgesByNodeId(id);
    ctx.response.body = { ...node, edges };
  },

  async getEdges(ctx: Context) {
    const url = new URL(ctx.request.url);
    const nodeId = url.searchParams.get("nodeId");

    if (nodeId) {
      const edges = await repo.getEdgesByNodeId(parseInt(nodeId));
      ctx.response.body = { edges };
    } else {
      ctx.response.body = { message: "Specify nodeId to get edges" };
    }
  },

  async getNeighbors(ctx: Context) {
    const nodeId = parseInt(ctx.params.nodeId);
    const url = new URL(ctx.request.url);
    const relationType = url.searchParams.get("relationType") || undefined;

    try {
      const result = await queries.getNeighbors(nodeId, relationType);
      ctx.response.body = result;
    } catch (error) {
      ctx.response.status = 404;
      ctx.response.body = { error: error.message };
    }
  },

  async findPath(ctx: Context) {
    const url = new URL(ctx.request.url);
    const from = parseInt(url.searchParams.get("from") || "");
    const to = parseInt(url.searchParams.get("to") || "");
    const maxDepth = parseInt(url.searchParams.get("maxDepth") || "10");

    if (isNaN(from) || isNaN(to)) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Missing from or to parameters" };
      return;
    }

    const path = await queries.findShortestPath(from, to, maxDepth);
    ctx.response.body = path || { message: "No path found" };
  },

  async search(ctx: Context) {
    const url = new URL(ctx.request.url);
    const q = url.searchParams.get("q");

    if (!q) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Missing search query parameter 'q'" };
      return;
    }

    const results = await repo.searchNodes(q);
    ctx.response.body = { query: q, results, count: results.length };
  },

  async getSummary(ctx: Context) {
    const summary = await queries.getGraphSummary();
    ctx.response.body = summary;
  },
};
