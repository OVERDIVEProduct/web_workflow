import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { runWorkflow, runNodeStep } from "../src/engine.js";

const n = (id, type, config = {}) => ({
  id,
  type,
  data: { label: id, config },
});
const edge = (id, source, target, sourceHandle = "main") => ({
  id,
  source,
  target,
  sourceHandle,
});
const graph = (config) => ({
  id: "regression",
  nodes: [
    n("t", "manualTrigger"),
    n("h", "httpRequest", { url: "https://httpbin.org/data", ...config }),
    n("f", "filter", {
      conditions: [{ field: "price", operator: "gt", value: 200 }],
    }),
    n("o", "output"),
  ],
  edges: [edge("e1", "t", "h"), edge("e2", "h", "f"), edge("e3", "f", "o")],
});

async function withServer(t, handler) {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  const port = server.address().port;
  return (url, options) =>
    fetch(`http://127.0.0.1:${port}${url.pathname}${url.search}`, options);
}

test("real HTTP transport -> JSON array -> Filter -> Output, checks every handoff", async (t) => {
  const transport = await withServer(t, (req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify([
        { name: "A", price: 300 },
        { name: "B", price: 100 },
      ]),
    );
  });
  const result = await runWorkflow(graph(), {
    triggerId: "t",
    fetchImpl: transport,
  });
  assert.equal(result.status, "success");
  assert.deepEqual(
    result.nodeRuns.map((x) => x.nodeId),
    ["t", "h", "f", "o"],
  );
  assert.equal(result.nodeRuns[1].outputItemsByPort.main.length, 2);
  assert.deepEqual(
    result.nodeRuns[2].inputItems,
    result.nodeRuns[1].outputItemsByPort.main,
  );
  assert.deepEqual(
    result.nodeRuns[2].outputItemsByPort.main.map((i) => i.json.name),
    ["A"],
  );
  assert.deepEqual(
    result.nodeRuns[3].inputItems.map((i) => i.json.name),
    ["A"],
  );
});

test("default Filter field value with API rows having only price returns zero, not network failure", async (t) => {
  const transport = await withServer(t, (_, res) => {
    res.setHeader("content-type", "application/json");
    res.end('[{"price":300},{"price":100}]');
  });
  const g = graph();
  g.nodes[2].data.config = {
    conditions: [{ field: "value", operator: "notEmpty", value: "" }],
  };
  const result = await runWorkflow(g, { triggerId: "t", fetchImpl: transport });
  assert.equal(result.status, "success");
  assert.deepEqual(
    result.nodeRuns.map((x) => x.nodeId),
    ["t", "h", "f"],
  );
  assert.equal(result.nodeRuns[1].outputItemsByPort.main.length, 2);
  assert.equal(result.nodeRuns[2].outputItemsByPort.main.length, 0);
});

test("Filter accepts plain, $json and braced expression field paths", async () => {
  const inputs = [{ json: { price: 300 } }, { json: { price: 100 } }];
  for (const path of ["price", "$json.price", "{{$json.price}}"]) {
    const r = await runNodeStep(
      n("f", "filter", {
        conditions: [{ field: path, operator: "gt", value: 200 }],
      }),
      inputs,
    );
    assert.equal(r.status, "success", path);
    assert.deepEqual(
      r.outputItemsByPort.main.map((x) => x.json.price),
      [300],
      path,
    );
  }
});

test("20 consecutive real HTTP -> Filter workflow runs are independent", async (t) => {
  let calls = 0;
  const transport = await withServer(t, (_, res) => {
    calls++;
    res.writeHead(200, { "content-type": "application/json" });
    res.end('[{"name":"A","price":300},{"name":"B","price":100}]');
  });
  const ids = new Set();
  for (let i = 0; i < 20; i++) {
    const run = await runWorkflow(graph(), {
      triggerId: "t",
      fetchImpl: transport,
    });
    assert.equal(run.status, "success", `run ${i}`);
    assert.equal(run.nodeRuns.length, 4);
    assert.deepEqual(
      run.nodeRuns[3].inputItems.map((x) => x.json.name),
      ["A"],
    );
    ids.add(run.id);
  }
  assert.equal(ids.size, 20);
  assert.equal(calls, 20);
});

test("HTTP per-input failures identify which item failed, and do not output misleading success", async (t) => {
  let count = 0;
  const transport = await withServer(t, (_, res) => {
    count++;
    res.writeHead(count === 2 ? 503 : 200, {
      "content-type": "application/json",
    });
    res.end(count === 2 ? '{"error":"unavailable"}' : '{"ok":true}');
  });
  const r = await runNodeStep(
    n("h", "httpRequest", { url: "https://httpbin.org/test" }),
    [{ json: { id: 1 } }, { json: { id: 2 } }],
    { fetchImpl: transport },
  );
  assert.equal(r.status, "failed");
  assert.equal(count, 2);
  assert.match(r.error, /item 2\/2.*HTTP 503/);
  assert.deepEqual(r.outputItemsByPort, {});
  assert.equal(r.httpResponses.length, 2);
});

test("IF branches and diamond do not merge inputs", async () => {
  const g = {
    id: "diamond",
    nodes: [
      n("t", "manualTrigger", {
        initialItems: [{ price: 300 }, { price: 100 }],
      }),
      n("i", "if", {
        conditions: [{ field: "price", operator: "gt", value: 200 }],
      }),
      n("s", "set", { fields: [{ name: "source", value: "branch" }] }),
      n("o", "output"),
    ],
    edges: [
      edge("a", "t", "i"),
      edge("b", "i", "s", "true"),
      edge("c", "i", "s", "false"),
      edge("d", "s", "o"),
    ],
  };
  const r = await runWorkflow(g, { triggerId: "t" });
  assert.equal(r.status, "success");
  assert.deepEqual(
    r.nodeRuns.filter((x) => x.nodeId === "s").map((x) => x.inputItems.length),
    [1, 1],
  );
  assert.equal(r.nodeRuns.filter((x) => x.nodeId === "o").length, 2);
});
