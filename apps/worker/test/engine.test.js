import test from "node:test";
import assert from "node:assert/strict";
import { runWorkflow, validateGraph } from "../src/engine.js";
const n = (id, type, config = {}) => ({
  id,
  type,
  data: { label: id, config },
});
const e = (source, target, sourceHandle = "main") => ({
  id: `${source}-${target}-${sourceHandle}`,
  source,
  target,
  sourceHandle,
});
const graph = (nodes, edges) => ({ id: "demo", nodes, edges });
const run = (g, extra = {}) => runWorkflow(g, { triggerId: "t", ...extra });
test("workflow rejects a second Manual Trigger even when disconnected", async () => {
  const document = graph(
    [n("t", "manualTrigger"), n("other", "manualTrigger")],
    [],
  );
  await assert.rejects(() => run(document), /Only one Manual Trigger/);
});
test("execute to Output reuses a valid HTTP result and reruns changed Filter only on the selected path", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response(JSON.stringify([{ price: 300 }, { price: 100 }]));
  };
  const document = graph(
    [
      n("t", "manualTrigger"),
      n("http", "httpRequest", {
        url: "https://jsonplaceholder.typicode.com/todos",
      }),
      n("f", "filter", { field: "price", operator: "gt", value: 50 }),
      n("o", "output"),
      n("other", "output"),
    ],
    [e("t", "http"), e("http", "f"), e("f", "o"), e("http", "other")],
  );
  const first = await run(document, { fetchImpl });
  assert.equal(first.status, "success");
  document.nodes[2].data.config.value = 200;
  const result = await run(document, {
    fetchImpl,
    targetNodeId: "o",
    previousRuns: [first],
  });
  assert.equal(result.status, "success");
  assert.equal(calls, 1);
  assert.deepEqual(
    result.nodeRuns.map((entry) => [entry.nodeId, Boolean(entry.reused)]),
    [
      ["t", true],
      ["http", true],
      ["f", false],
      ["o", false],
    ],
  );
  assert.deepEqual(result.nodeRuns.at(-1).inputItems, [
    { json: { price: 300 } },
  ]);
  document.edges = document.edges.filter((edge) => edge.target !== "o");
  await assert.rejects(
    () =>
      run(document, {
        fetchImpl,
        targetNodeId: "o",
        previousRuns: [first, result],
      }),
    /目標節點沒有連到 Manual Trigger/,
  );
  assert.equal(calls, 1);
});

test("execute to a middle node does not schedule its descendants", async () => {
  const document = graph(
    [n("t", "manualTrigger"), n("f", "limit"), n("o", "output")],
    [e("t", "f"), e("f", "o")],
  );
  const result = await run(document, { targetNodeId: "f" });
  assert.deepEqual(
    result.nodeRuns.map((entry) => entry.nodeId),
    ["t", "f"],
  );
});
test("trigger -> output", async () => {
  const r = await run(
    graph([n("t", "manualTrigger"), n("o", "output")], [e("t", "o")]),
  );
  assert.equal(r.status, "success");
  assert.equal(r.nodeRuns.length, 2);
});
test("filter sort limit pipeline", async () => {
  const r = await run(
    graph(
      [
        n("t", "manualTrigger", {
          initialItems: [{ price: 3 }, { price: 1 }, { price: 2 }],
        }),
        n("f", "filter", { field: "price", operator: "gt", value: 1 }),
        n("s", "sort", { field: "price" }),
        n("l", "limit", { count: 1 }),
        n("o", "output"),
      ],
      [e("t", "f"), e("f", "s"), e("s", "l"), e("l", "o")],
    ),
  );
  assert.equal(r.status, "success");
  assert.equal(r.nodeRuns.at(-1).inputItems[0].json.price, 2);
});
test("if true false separate items", async () => {
  const r = await run(
    graph(
      [
        n("t", "manualTrigger", { initialItems: [{ stock: 5 }, { stock: 0 }] }),
        n("i", "if", { field: "stock", operator: "gt", value: 0 }),
        n("a", "output"),
        n("b", "output"),
      ],
      [e("t", "i"), e("i", "a", "true"), e("i", "b", "false")],
    ),
  );
  assert.equal(r.nodeRuns.length, 4);
  assert.equal(r.nodeRuns.find((x) => x.nodeId === "a").inputItems.length, 1);
  assert.equal(r.nodeRuns.find((x) => x.nodeId === "b").inputItems.length, 1);
});
test("multi route: common output executes independently", async () => {
  const r = await run(
    graph(
      [
        n("t", "manualTrigger", { initialItems: [{ x: 1 }, { x: 2 }] }),
        n("f", "filter", { field: "x", operator: "gt", value: 1 }),
        n("s", "sort", { field: "x", direction: "desc" }),
        n("o", "output"),
      ],
      [e("t", "f"), e("t", "s"), e("f", "o"), e("s", "o")],
    ),
  );
  const out = r.nodeRuns.filter((x) => x.nodeId === "o");
  assert.equal(out.length, 2);
  assert.deepEqual(
    out.map((x) => x.inputItems.length),
    [1, 2],
  );
});
test("cycle rejected", () => {
  assert.ok(
    validateGraph(
      graph(
        [n("t", "manualTrigger"), n("a", "set"), n("b", "sort")],
        [e("t", "a"), e("a", "b"), e("b", "a")],
      ),
      "t",
    ).some((x) => x.includes("cycle")),
  );
});
test("invalid branch handle rejected", () => {
  assert.ok(
    validateGraph(
      graph([n("t", "manualTrigger"), n("o", "output")], [e("t", "o", "true")]),
      "t",
    ).some((x) => x.includes("handle")),
  );
});
test("filter produces zero: downstream skipped", async () => {
  const r = await run(
    graph(
      [
        n("t", "manualTrigger", { initialItems: [{ x: 1 }] }),
        n("f", "filter", { field: "x", operator: "gt", value: 4 }),
        n("o", "output"),
      ],
      [e("t", "f"), e("f", "o")],
    ),
  );
  assert.equal(r.nodeRuns.length, 2);
  assert.equal(r.status, "success");
});
test("HTTP mocked GET result passes to output", async () => {
  const fake = async () => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => JSON.stringify([{ id: 1 }, { id: 2 }]),
  });
  const r = await run(
    graph(
      [
        n("t", "manualTrigger"),
        n("h", "httpRequest", {
          url: "https://jsonplaceholder.typicode.com/todos",
        }),
        n("o", "output"),
      ],
      [e("t", "h"), e("h", "o")],
    ),
    { fetchImpl: fake },
  );
  assert.equal(r.status, "success");
  assert.equal(r.nodeRuns.at(-1).inputItems.length, 2);
});
test("HTTP nonallowlisted host rejected", async () => {
  const r = await run(
    graph(
      [
        n("t", "manualTrigger"),
        n("h", "httpRequest", { url: "https://localhost/test" }),
      ],
      [e("t", "h")],
    ),
  );
  assert.equal(r.status, "failed");
  assert.match(r.error, /not in HTTP_ALLOWED_HOSTS/);
});
test("set expression", async () => {
  const r = await run(
    graph(
      [
        n("t", "manualTrigger", { initialItems: [{ price: 7 }] }),
        n("s", "set", {
          fields: [{ name: "original", value: "{{$json.price}}" }],
        }),
        n("o", "output"),
      ],
      [e("t", "s"), e("s", "o")],
    ),
  );
  assert.equal(r.nodeRuns.at(-1).inputItems[0].json.original, 7);
});
