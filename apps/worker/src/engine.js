// Backend workflow execution engine: sequential FIFO tasks, independent input batches.
import { randomUUID } from "node:crypto";
import {
  isInitialItems,
  normalizeItems,
  validateWorkflowItems,
} from "../../../packages/shared/src/workflowData.js";
import { changedExecutionNodes } from "../../../packages/shared/src/executionGraph.js";

const KINDS = new Set([
  "manualTrigger",
  "httpRequest",
  "filter",
  "set",
  "sort",
  "limit",
  "if",
  "output",
]);
const MAX_TASKS = 500;
const MAX_ITEMS = 10000;
const clone = (v) => structuredClone(v);
const field = (json, path) => {
  if (!/^[$a-zA-Z_][\w$]*(?:\.[$a-zA-Z_][\w$]*|\[\d+\])*$/.test(path))
    throw Error(`Invalid field path: ${path}`);
  return path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .reduce((v, k) => (v == null ? undefined : v[k]), json);
};
function resolve(raw, json, runId) {
  if (typeof raw !== "string") return raw;
  const match = raw.match(/^\s*{{\s*([^{}]+)\s*}}\s*$/);
  const evalPath = (expr) => {
    if (expr === "$run.id") return runId;
    if (expr === "$json") return json;
    if (expr.startsWith("$json.")) return field(json, expr.slice(6));
    if (expr.startsWith("$json[")) return field(json, expr.slice(5));
    throw Error(`Unsupported expression: ${expr}`);
  };
  if (match) return evalPath(match[1].trim());
  return raw.replace(/{{\s*([^{}]+)\s*}}/g, (_, exp) =>
    String(evalPath(exp.trim()) ?? ""),
  );
}
function condition(json, rule, runId) {
  // Users may enter the field as `price`, `$json.price`, or `{{$json.price}}`.
  // Normalize these equivalent forms without interpreting arbitrary JavaScript.
  const rawPath = String(rule.field ?? "value").trim();
  const expressionMatch = rawPath.match(
    /^{{\s*(\$json(?:\.[\w$]+|\[\d+\])*)\s*}}$/,
  );
  const path = expressionMatch ? expressionMatch[1] : rawPath;
  const left = resolve(
    path === "$json"
      ? "{{$json}}"
      : path.startsWith("$json.") || path.startsWith("$json[")
        ? `{{${path}}}`
        : `{{$json.${path}}}`,
    json,
    runId,
  );
  const right = resolve(rule.value, json, runId);
  switch (rule.operator) {
    case "eq":
      return left === right;
    case "ne":
      return left !== right;
    case "gt":
      return Number(left) > Number(right);
    case "gte":
      return Number(left) >= Number(right);
    case "lt":
      return Number(left) < Number(right);
    case "lte":
      return Number(left) <= Number(right);
    case "contains":
      return String(left ?? "").includes(String(right ?? ""));
    case "empty":
      return left == null || left === "";
    case "notEmpty":
      return left != null && left !== "";
    default:
      throw Error(`Unknown condition operator: ${rule.operator}`);
  }
}
function matches(json, config, runId) {
  const rules = config.conditions?.length
    ? config.conditions
    : [
        {
          field: config.field || "value",
          operator: config.operator || "notEmpty",
          value: config.value ?? "",
        },
      ];
  return (config.combine === "or" ? rules.some : rules.every).call(rules, (r) =>
    condition(json, r, runId),
  );
}
function normalizeHttpRows(rows, json, runId) {
  if (Array.isArray(rows))
    return Object.fromEntries(
      rows
        .filter((r) => r.enabled !== false && r.name)
        .map((r) => [r.name, String(resolve(r.value, json, runId) ?? "")]),
    );
  return Object.fromEntries(
    Object.entries(rows || {}).map(([key, v]) => [
      key,
      String(resolve(v, json, runId) ?? ""),
    ]),
  );
}
async function callHttp(config, item, runId, signal, httpFetch, reportHttp) {
  const url = new URL(String(resolve(config.url || "", item.json, runId)));
  if (url.protocol !== "https:" || url.username || url.password)
    throw Error("HTTP node requires HTTPS URL without embedded credentials");
  const allow = (
    process.env.HTTP_ALLOWED_HOSTS ||
    "jsonplaceholder.typicode.com,httpbin.org,tcgbusfs.blob.core.windows.net"
  )
    .split(",")
    .map((s) => s.trim().toLowerCase());
  if (!allow.includes(url.hostname.toLowerCase()))
    throw Error(`Host is not in HTTP_ALLOWED_HOSTS: ${url.hostname}`);
  const query = normalizeHttpRows(config.query, item.json, runId);
  for (const [k, v] of Object.entries(query)) url.searchParams.append(k, v);
  const method = String(config.method || "GET").toUpperCase();
  if (!["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"].includes(method))
    throw Error("Invalid HTTP method");
  const headers = normalizeHttpRows(config.headers, item.json, runId);
  let body;
  if (config.bodyEnabled && method !== "GET" && method !== "HEAD") {
    const resolved = resolve(config.body ?? "", item.json, runId);
    body = typeof resolved === "string" ? resolved : JSON.stringify(resolved);
    if (body) {
      JSON.parse(body);
      if (!Object.keys(headers).some((k) => k.toLowerCase() === "content-type"))
        headers["Content-Type"] = "application/json";
    }
  }
  const configuredTimeout =
    config.timeout === undefined ? 30000 : Number(config.timeout);
  if (
    !Number.isFinite(configuredTimeout) ||
    configuredTimeout < 1000 ||
    configuredTimeout > 60000
  )
    throw Error("HTTP timeout must be between 1000 and 60000 ms");
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(
    () => controller.abort(new Error("HTTP request timed out")),
    configuredTimeout,
  );
  let response;
  let content;
  const started = Date.now();
  try {
    response = await httpFetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
      redirect: "manual",
    });
    const sizeHeader = Number(response.headers?.get?.("content-length") || 0);
    if (sizeHeader > 5 * 1024 * 1024) throw Error("HTTP response exceeds 5 MB");
    if (response.body && typeof response.body.getReader === "function") {
      const reader = response.body.getReader();
      const chunks = [];
      let length = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > 5 * 1024 * 1024) {
            await reader.cancel();
            throw Error("HTTP response exceeds 5 MB");
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      content = new TextDecoder().decode(
        Buffer.concat(
          chunks.map((c) => Buffer.from(c)),
          length,
        ),
      );
    } else {
      content = await response.text();
      if (Buffer.byteLength(content, "utf8") > 5 * 1024 * 1024)
        throw Error("HTTP response exceeds 5 MB");
    }
    if (controller.signal.aborted)
      throw controller.signal.reason || Error("HTTP request cancelled");
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted)
      throw Error("HTTP request timed out");
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.("abort", abort);
  }
  reportHttp?.({
    statusCode: response.status,
    statusText: response.statusText,
    method,
    durationMs: Date.now() - started,
    responseBytes: Buffer.byteLength(content, "utf8"),
    contentType: response.headers?.get?.("content-type") || "",
  });
  if (response.status >= 300 && response.status < 400)
    throw Error(`HTTP redirect disallowed (${response.status})`);
  if (!response.ok)
    throw Error(`HTTP ${response.status} ${response.statusText}`);
  if (!content) return [];
  let value;
  try {
    value = JSON.parse(content);
  } catch {
    if (config.responseFormat === "json")
      throw Error("HTTP response is not valid JSON");
    value = content;
  }
  return config.keepResponseAsOneItem
    ? normalizeItems({ response: value })
    : normalizeItems(value);
}
export function validateGraph(graph, triggerId) {
  const errors = [];
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges))
    return ["Invalid graph"];
  const nodes = new Map();
  for (const node of graph.nodes) {
    if (!node.id || nodes.has(node.id))
      errors.push(`Duplicate or missing node id: ${node.id}`);
    if (node.type !== "stickyNote" && !KINDS.has(node.type))
      errors.push(`Unknown node kind: ${node.type}`);
    nodes.set(node.id, node);
  }
  const edgeIds = new Set();
  const adj = new Map();
  const edgeKeys = new Set();
  for (const e of graph.edges) {
    const source = nodes.get(e.source),
      target = nodes.get(e.target);
    if (!source || !target) {
      errors.push(`Missing endpoint: ${e.id}`);
      continue;
    }
    if (edgeIds.has(e.id)) errors.push(`Duplicate edge id: ${e.id}`);
    edgeIds.add(e.id);
    if (source.type === "stickyNote" || target.type === "stickyNote") {
      errors.push("Sticky note cannot participate in execution");
      continue;
    }
    if (target.type === "manualTrigger" || source.type === "output")
      errors.push(`Invalid direction: ${e.id}`);
    const handle = e.sourceHandle || "main";
    if (
      source.type === "if"
        ? !["true", "false"].includes(handle)
        : handle !== "main"
    )
      errors.push(`Invalid source handle: ${e.id}`);
    if (e.targetHandle && e.targetHandle !== "input")
      errors.push(`Invalid target handle: ${e.id}`);
    const key = `${e.source}|${handle}|${e.target}`;
    if (edgeKeys.has(key)) errors.push(`Duplicate route: ${key}`);
    edgeKeys.add(key);
    adj.set(e.source, [...(adj.get(e.source) || []), e.target]);
  }
  const colors = new Map();
  const visit = (id) => {
    if (colors.get(id) === 1) {
      errors.push("Workflow contains cycle");
      return;
    }
    if (colors.get(id) === 2) return;
    colors.set(id, 1);
    for (const dest of adj.get(id) || []) visit(dest);
    colors.set(id, 2);
  };
  for (const id of nodes.keys()) if (!colors.has(id)) visit(id);
  if (
    [...nodes.values()].filter((node) => node.type === "manualTrigger").length >
    1
  ) {
    errors.push("Only one Manual Trigger is allowed per workflow");
  }
  if (!nodes.has(triggerId) || nodes.get(triggerId).type !== "manualTrigger")
    errors.push("Select a valid Manual Trigger");
  return errors;
}
async function executeNode(node, input, runId, signal, httpFetch, reportHttp) {
  const config = node.data?.config || {};
  switch (node.type) {
    case "manualTrigger": {
      const initialItems =
        config.initialItems === undefined ? [{}] : config.initialItems;
      if (!isInitialItems(initialItems))
        throw Error(
          "Initial Items must be a JSON object or an array of JSON objects",
        );
      return { main: normalizeItems(initialItems) };
    }
    case "output":
      return {};
    case "filter":
      return { main: input.filter((i) => matches(i.json, config, runId)) };
    case "if":
      return {
        true: input.filter((i) => matches(i.json, config, runId)),
        false: input.filter((i) => !matches(i.json, config, runId)),
      };
    case "set":
      return {
        main: input.map((i) => {
          const json = config.keepOtherFields === false ? {} : clone(i.json);
          for (const f of config.fields || []) {
            if (!f.name) continue;
            if (f.remove) delete json[f.name];
            else json[f.name] = resolve(f.value, i.json, runId);
          }
          return { ...i, json };
        }),
      };
    case "sort": {
      const fields = config.fields?.length
        ? config.fields
        : [
            {
              field: config.field || "value",
              direction: config.direction || "asc",
            },
          ];
      return {
        main: [...input].sort((a, b) => {
          for (const f of fields) {
            const x = field(a.json, f.field),
              y = field(b.json, f.field);
            const cmp =
              x == null
                ? y == null
                  ? 0
                  : 1
                : y == null
                  ? -1
                  : typeof x === "number" && typeof y === "number"
                    ? x - y
                    : String(x).localeCompare(String(y), "zh-Hant", {
                        numeric: true,
                      });
            if (cmp) return f.direction === "desc" ? -cmp : cmp;
          }
          return 0;
        }),
      };
    }
    case "limit": {
      const count = Number(config.count ?? 10);
      if (!Number.isInteger(count) || count < 0)
        throw Error("Limit count must be a nonnegative integer");
      return {
        main:
          config.position === "last"
            ? input.slice(Math.max(0, input.length - count))
            : input.slice(0, count),
      };
    }
    case "httpRequest": {
      const values = [];
      for (const [index, item] of input.entries()) {
        if (signal.aborted) throw Error("Cancelled");
        try {
          values.push(
            ...(await callHttp(
              config,
              item,
              runId,
              signal,
              httpFetch,
              reportHttp,
            )),
          );
        } catch (error) {
          throw Error(
            `HTTP input item ${index + 1}/${input.length}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        if (values.length > MAX_ITEMS) throw Error("Item limit exceeded");
      }
      return { main: values };
    }
    default:
      throw Error(`Unsupported node: ${node.type}`);
  }
}
export function planExecutionTarget(graph, triggerId, targetNodeId) {
  const ancestors = new Set([targetNodeId]);
  const incoming = new Map();
  for (const edge of graph.edges) {
    if (!incoming.has(edge.target)) incoming.set(edge.target, []);
    incoming.get(edge.target).push(edge.source);
  }
  for (const id of ancestors) {
    for (const source of incoming.get(id) ?? []) ancestors.add(source);
  }
  if (!ancestors.has(triggerId))
    throw Error("目標節點沒有連到 Manual Trigger，請檢查上游連線。");
  const reachable = new Set([triggerId]);
  const outgoing = new Map();
  for (const edge of graph.edges) {
    if (!ancestors.has(edge.target)) continue;
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
    outgoing.get(edge.source).push(edge.target);
  }
  for (const id of reachable) {
    for (const target of outgoing.get(id) ?? []) reachable.add(target);
  }
  return reachable;
}

function reusableRuns(snapshot, previousRuns, targetNodeId) {
  const cached = new Map();
  for (const run of previousRuns) {
    const changed = changedExecutionNodes(run.snapshot, snapshot);
    for (const entry of run.nodeRuns) {
      if (
        entry.status !== "success" ||
        changed.has(entry.nodeId) ||
        entry.nodeId === targetNodeId
      )
        continue;
      const key = JSON.stringify([
        entry.nodeId,
        entry.sourceNodeRunId,
        entry.sourceEdgeId,
      ]);
      cached.set(key, entry);
    }
  }
  return cached;
}

export async function runWorkflow(
  graph,
  {
    triggerId = "trigger-1",
    targetNodeId,
    previousRuns = [],
    signal,
    fetchImpl = fetch,
    onEvent = () => {},
    runId = randomUUID(),
  } = {},
) {
  const snapshot = clone(graph);
  const validation = validateGraph(snapshot, triggerId);
  if (validation.length) throw Error(validation.join("; "));
  const nodes = new Map(snapshot.nodes.map((n) => [n.id, n]));
  const scope = targetNodeId
    ? planExecutionTarget(snapshot, triggerId, targetNodeId)
    : null;
  const edges = snapshot.edges
    .filter(
      (edge) => !scope || (scope.has(edge.source) && scope.has(edge.target)),
    )
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const cached = scope
    ? reusableRuns(snapshot, previousRuns, targetNodeId)
    : new Map();
  const queued = [
    {
      nodeId: triggerId,
      inputItems: [],
      sourceNodeRunId: null,
      sourceEdgeId: null,
    },
  ];
  const run = {
    id: runId,
    workflowId: snapshot.id,
    targetNodeId,
    status: "running",
    startedAt: new Date().toISOString(),
    snapshot,
    nodeRuns: [],
    error: null,
  };
  const notify = () => onEvent(clone({ ...run, nodeRuns: run.nodeRuns }));
  notify();
  const controller = new AbortController();
  if (signal) {
    if (signal.aborted) controller.abort();
    else
      signal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
  }
  const maxTime = setTimeout(() => controller.abort(), 60000);
  try {
    while (queued.length) {
      if (controller.signal.aborted) {
        run.status = "cancelled";
        break;
      }
      if (run.nodeRuns.length >= MAX_TASKS)
        throw Error("Execution task limit exceeded");
      const task = queued.shift();
      const node = nodes.get(task.nodeId);
      const reused = cached.get(
        JSON.stringify([node.id, task.sourceNodeRunId, task.sourceEdgeId]),
      );
      if (reused) {
        run.nodeRuns.push({ ...reused, reused: true });
        for (const edge of edges.filter((e) => e.source === node.id)) {
          const items =
            reused.outputItemsByPort[edge.sourceHandle || "main"] ?? [];
          if (items.length)
            queued.push({
              nodeId: edge.target,
              inputItems: clone(items),
              sourceNodeRunId: reused.id,
              sourceEdgeId: edge.id,
            });
        }
        continue;
      }
      const nr = {
        id: randomUUID(),
        nodeId: node.id,
        sourceNodeRunId: task.sourceNodeRunId,
        sourceEdgeId: task.sourceEdgeId,
        status: "running",
        startedAt: new Date().toISOString(),
        inputItems: clone(task.inputItems),
        outputItemsByPort: {},
      };
      run.nodeRuns.push(nr);
      notify();
      const httpResponses = [];
      try {
        const outputs = await executeNode(
          node,
          task.inputItems,
          runId,
          controller.signal,
          fetchImpl,
          (r) => httpResponses.push(r),
        );
        if (httpResponses.length) nr.httpResponses = httpResponses;
        if (controller.signal.aborted) {
          nr.status = "cancelled";
          run.status = "cancelled";
          break;
        }
        nr.outputItemsByPort = outputs;
        nr.status = "success";
        nr.durationMs = Date.now() - Date.parse(nr.startedAt);
        for (const edge of edges.filter((e) => e.source === node.id)) {
          const items = outputs[edge.sourceHandle || "main"] || [];
          if (items.length)
            queued.push({
              nodeId: edge.target,
              inputItems: clone(items),
              sourceNodeRunId: nr.id,
              sourceEdgeId: edge.id,
            });
        }
      } catch (error) {
        if (httpResponses.length) nr.httpResponses = httpResponses;
        nr.status = "failed";
        nr.error = error instanceof Error ? error.message : String(error);
        run.status = controller.signal.aborted ? "cancelled" : "failed";
        run.error = nr.error;
      }
      notify();
      if (run.status !== "running") break;
    }
    if (run.status === "running") run.status = "success";
  } catch (error) {
    run.status = controller.signal.aborted ? "cancelled" : "failed";
    run.error = error instanceof Error ? error.message : String(error);
  } finally {
    clearTimeout(maxTime);
    run.finishedAt = new Date().toISOString();
    notify();
  }
  return run;
}

// Execute exactly one node; never schedule downstream edges. Used by the shared Step UI.
export async function runNodeStep(
  node,
  inputItems = [],
  { signal, fetchImpl = fetch, runId = randomUUID() } = {},
) {
  if (!node || !KINDS.has(node.type)) throw Error("Unsupported step node type");
  if (!validateWorkflowItems(inputItems, MAX_ITEMS))
    throw Error("Invalid input items");
  const snapshot = clone(node);
  const controller = new AbortController();
  if (signal?.aborted) controller.abort();
  else
    signal?.addEventListener("abort", () => controller.abort(), { once: true });
  const timeout = setTimeout(() => controller.abort(), 60000);
  const start = Date.now();
  const httpResponses = [];
  try {
    const outputItemsByPort = await executeNode(
      snapshot,
      clone(inputItems),
      runId,
      controller.signal,
      fetchImpl,
      (r) => httpResponses.push(r),
    );
    if (controller.signal.aborted) throw Error("Step cancelled or timed out");
    return {
      id: randomUUID(),
      nodeId: node.id,
      status: "success",
      inputItems: clone(inputItems),
      outputItemsByPort,
      durationMs: Date.now() - start,
      sourceNodeRunId: null,
      sourceEdgeId: null,
      httpResponses,
    };
  } catch (error) {
    return {
      id: randomUUID(),
      nodeId: node.id,
      status: controller.signal.aborted ? "cancelled" : "failed",
      inputItems: clone(inputItems),
      outputItemsByPort: {},
      durationMs: Date.now() - start,
      sourceNodeRunId: null,
      sourceEdgeId: null,
      httpResponses,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}
