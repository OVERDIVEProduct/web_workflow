import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import {
  planExecutionTarget,
  runWorkflow,
  validateGraph,
  runNodeStep,
} from "../../worker/src/engine.js";

const runs = new Map();
const active = new Map();
const port = Number(process.env.API_PORT || 3001);
const owners = new Map();
const json = (res, status, value) => {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(value));
};
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "http://127.0.0.1:5173",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "Content-Type, X-Execution-Session",
    });
    return res.end();
  }
  if (url.pathname === "/health") return json(res, 200, { ok: true });
  // This demo API is intentionally loopback-only, not production authentication.
  const found = url.pathname.match(/^\/api\/runs\/([a-z0-9-]+)(\/cancel)?$/i);
  if (found) {
    const run = runs.get(found[1]);
    if (!run) return json(res, 404, { error: "Run not found" });
    const owner = owners.get(found[1]);
    if (owner && owner !== req.headers["x-execution-session"])
      return json(res, 404, { error: "Run not found" });
    if (req.method === "GET" && !found[2]) return json(res, 200, run);
    if (req.method === "POST" && found[2]) {
      active.get(found[1])?.abort();
      return json(res, 202, { cancelling: true });
    }
  }
  if (req.method === "POST" && url.pathname === "/api/steps") {
    try {
      let raw = "";
      for await (const part of req) {
        raw += part;
        if (raw.length > 1_000_000) throw Error("Step payload too large");
      }
      const { node, inputItems } = JSON.parse(raw);
      const controller = new AbortController();
      res.once("close", () => controller.abort());
      const result = await runNodeStep(node, inputItems, {
        signal: controller.signal,
      });
      if (!res.destroyed) return json(res, 200, result);
    } catch (e) {
      if (res.destroyed) return;
      return json(res, 400, {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  if (req.method === "POST" && url.pathname === "/api/runs") {
    try {
      let raw = "";
      for await (const part of req) {
        raw += part;
        if (raw.length > 1_000_000) throw Error("Workflow payload too large");
      }
      const payload = JSON.parse(raw);
      const errors = validateGraph(payload.graph, payload.triggerId);
      if (errors.length) return json(res, 400, { errors });
      const { targetNodeId, sessionKey } = payload;
      if (
        sessionKey !== undefined &&
        (typeof sessionKey !== "string" || !/^[a-f0-9-]{36}$/i.test(sessionKey))
      ) {
        return json(res, 400, { error: "Invalid execution session" });
      }
      let previousRuns = [];
      if (targetNodeId !== undefined) {
        if (!sessionKey || typeof targetNodeId !== "string" || !targetNodeId) {
          return json(res, 400, {
            error: "Invalid execution target or session",
          });
        }
        const scope = planExecutionTarget(
          payload.graph,
          payload.triggerId,
          targetNodeId,
        );
        previousRuns = [...runs.values()]
          .reverse()
          .filter(
            (run) =>
              owners.get(run.id) === sessionKey &&
              run.workflowId === payload.graph.id &&
              run.status === "success",
          )
          .slice(0, 10)
          .reverse();
        const writes = payload.graph.nodes.filter(
          (node) =>
            scope.has(node.id) &&
            node.type === "httpRequest" &&
            ["POST", "PUT", "PATCH", "DELETE"].includes(
              String(node.data?.config?.method).toUpperCase(),
            ),
        );
        if (writes.length && payload.confirmWrites !== true) {
          return json(res, 409, {
            code: "CONFIRM_WRITES",
            error: "這次測試可能會發送修改外部資料的 HTTP 請求，是否繼續？",
          });
        }
      }
      const id = randomUUID();
      const controller = new AbortController();
      if (sessionKey) owners.set(id, sessionKey);
      const placeholder = { id, status: "queued", nodeRuns: [] };
      runs.set(id, placeholder);
      active.set(id, controller);
      void runWorkflow(payload.graph, {
        triggerId: payload.triggerId,
        targetNodeId,
        previousRuns,
        runId: id,
        signal: controller.signal,
        onEvent: (r) => runs.set(id, r),
      })
        .catch((error) =>
          runs.set(id, {
            ...runs.get(id),
            status: "failed",
            error: error.message,
          }),
        )
        .finally(() => active.delete(id));
      return json(res, 202, { runId: id });
    } catch (e) {
      return json(res, 400, { error: e.message });
    }
  }
  json(res, 404, { error: "Not found" });
});
server.listen(port, "127.0.0.1", () =>
  console.log(`Execution API http://127.0.0.1:${port}`),
);
