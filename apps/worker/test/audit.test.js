import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { runNodeStep, runWorkflow } from "../src/engine.js";
const n = (type, config = {}) => ({ id: `${type}-1`, type, data: { config } });
const input = [
  { json: { price: 40, name: "A", qty: 2 } },
  { json: { price: 10, name: "B", qty: 0 } },
  { json: { price: 20, name: "C", qty: 5 } },
];
const step = (type, config, items = input) =>
  runNodeStep(n(type, config), items);

test("Manual Trigger output initial items", async () => {
  const r = await step(
    "manualTrigger",
    { initialItems: [{ a: 1 }, { a: 2 }] },
    [],
  );
  assert.deepEqual(
    r.outputItemsByPort.main.map((x) => x.json.a),
    [1, 2],
  );
});
test("Filter AND/OR and zero items", async () => {
  const rules = [
    { field: "price", operator: "gt", value: 15 },
    { field: "qty", operator: "gt", value: 1 },
  ];
  assert.deepEqual(
    (
      await step("filter", { conditions: rules, combine: "and" })
    ).outputItemsByPort.main.map((x) => x.json.name),
    ["A", "C"],
  );
  assert.equal(
    (
      await step("filter", {
        conditions: [{ field: "qty", operator: "gt", value: 99 }],
      })
    ).outputItemsByPort.main.length,
    0,
  );
  assert.equal(
    (await step("filter", { conditions: rules, combine: "or" }))
      .outputItemsByPort.main.length,
    2,
  );
});
test("Set preserves source input and resolves expression", async () => {
  const r = await step("set", {
    fields: [
      { name: "double", value: "{{$json.price}}" },
      { name: "qty", remove: true },
    ],
  });
  assert.equal(r.outputItemsByPort.main[0].json.double, 40);
  assert.equal("qty" in r.outputItemsByPort.main[0].json, false);
  assert.equal(input[0].json.qty, 2);
});
test("Sort numeric ascending/descending and multi keys", async () => {
  const asc = await step("sort", {
    fields: [{ field: "price", direction: "asc" }],
  });
  assert.deepEqual(
    asc.outputItemsByPort.main.map((x) => x.json.price),
    [10, 20, 40],
  );
  const desc = await step("sort", {
    fields: [{ field: "qty", direction: "desc" }],
  });
  assert.deepEqual(
    desc.outputItemsByPort.main.map((x) => x.json.qty),
    [5, 2, 0],
  );
});
test("Limit zero, first and last, oversized", async () => {
  assert.equal(
    (await step("limit", { count: 0 })).outputItemsByPort.main.length,
    0,
  );
  assert.equal(
    (await step("limit", { count: 100 })).outputItemsByPort.main.length,
    3,
  );
  assert.equal(
    (await step("limit", { count: 1, position: "last" })).outputItemsByPort
      .main[0].json.name,
    "C",
  );
});
test("IF routes each item independently", async () => {
  const r = await step("if", {
    conditions: [{ field: "qty", operator: "gt", value: 1 }],
  });
  assert.deepEqual(
    r.outputItemsByPort.true.map((x) => x.json.name),
    ["A", "C"],
  );
  assert.deepEqual(
    r.outputItemsByPort.false.map((x) => x.json.name),
    ["B"],
  );
});
test("Output receives input but does not emit downstream data", async () => {
  const r = await step("output", {});
  assert.deepEqual(r.inputItems, input);
  assert.deepEqual(r.outputItemsByPort, {});
});

test("HTTP GET/POST actual loopback transport, headers, query, JSON object and array", async (t) => {
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        method: req.method,
        url: req.url,
        token: req.headers["x-test"],
        body: body ? JSON.parse(body) : null,
      }),
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  const port = server.address().port;
  const forwarded = (url, options) =>
    fetch(`http://127.0.0.1:${port}${url.pathname}${url.search}`, options);
  const result = await runNodeStep(
    n("httpRequest", {
      method: "POST",
      url: "https://httpbin.org/anything",
      query: [{ name: "q", value: "{{$json.price}}" }],
      headers: [{ name: "X-Test", value: "works" }],
      bodyEnabled: true,
      body: '{"from": "audit"}',
    }),
    [{ json: { price: 42 } }],
    { fetchImpl: forwarded },
  );
  assert.equal(result.status, "success");
  assert.equal(result.outputItemsByPort.main[0].json.method, "POST");
  assert.equal(result.outputItemsByPort.main[0].json.url, "/anything?q=42");
  assert.deepEqual(result.outputItemsByPort.main[0].json.body, {
    from: "audit",
  });
  assert.equal(result.outputItemsByPort.main[0].json.token, "works");
  assert.equal(result.httpResponses[0].statusCode, 200);
  assert.equal(result.httpResponses[0].contentType, "application/json");
});
test("HTTP 204, error status, malformed JSON, text, zero array, multiple items", async () => {
  const make =
    (value, status = 200) =>
    async () =>
      new Response(value, {
        status,
        headers: { "content-type": "application/json" },
      });
  const config = { url: "https://httpbin.org/test" };
  assert.equal(
    (
      await runNodeStep(n("httpRequest", config), [{ json: {} }], {
        fetchImpl: make(null, 204),
      })
    ).outputItemsByPort.main.length,
    0,
  );
  const bad = await runNodeStep(n("httpRequest", config), [{ json: {} }], {
    fetchImpl: make('{"error":true}', 404),
  });
  assert.equal(bad.status, "failed");
  assert.equal(bad.httpResponses[0].statusCode, 404);
  const malformed = await runNodeStep(
    n("httpRequest", { ...config, responseFormat: "json" }),
    [{ json: {} }],
    { fetchImpl: make("bad json") },
  );
  assert.equal(malformed.status, "failed");
  assert.match(malformed.error, /not valid JSON/);
  const text = await runNodeStep(n("httpRequest", config), [{ json: {} }], {
    fetchImpl: make("hello"),
  });
  assert.equal(text.outputItemsByPort.main[0].json.value, "hello");
  const empty = await runNodeStep(n("httpRequest", config), [{ json: {} }], {
    fetchImpl: make("[]"),
  });
  assert.equal(empty.outputItemsByPort.main.length, 0);
  let calls = 0;
  const repeated = await runNodeStep(
    n("httpRequest", config),
    [{ json: { a: 1 } }, { json: { a: 2 } }],
    {
      fetchImpl: async () => {
        calls++;
        return new Response('{"ok":1}', { status: 201 });
      },
    },
  );
  assert.equal(calls, 2);
  assert.equal(repeated.outputItemsByPort.main.length, 2);
  assert.equal(repeated.httpResponses.length, 2);
});
test("HTTP timeout respects node config with cancellable request", async () => {
  const r = await runNodeStep(
    n("httpRequest", { url: "https://httpbin.org/delay/5", timeout: 1000 }),
    [{ json: {} }],
    {
      fetchImpl: async (_url, { signal }) =>
        new Promise((_, reject) =>
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          }),
        ),
    },
  );
  assert.equal(r.status, "failed");
  assert.match(r.error, /timed out/);
});
test("workflow diamond executes downstream separately", async () => {
  const nodes = [
    {
      id: "t",
      type: "manualTrigger",
      data: { config: { initialItems: [{ x: 2 }, { x: 1 }] } },
    },
    {
      id: "f",
      type: "filter",
      data: { config: { field: "x", operator: "gt", value: 1 } },
    },
    { id: "s", type: "sort", data: { config: { field: "x" } } },
    { id: "o", type: "output", data: { config: {} } },
  ];
  const edges = [
    ["t", "f"],
    ["t", "s"],
    ["f", "o"],
    ["s", "o"],
  ].map(([source, target], i) => ({ id: String(i), source, target }));
  const run = await runWorkflow(
    { id: "diamond", nodes, edges },
    { triggerId: "t" },
  );
  assert.equal(run.status, "success");
  assert.deepEqual(
    run.nodeRuns
      .filter((r) => r.nodeId === "o")
      .map((r) => r.inputItems.length),
    [1, 2],
  );
});
