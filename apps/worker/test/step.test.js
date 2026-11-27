import test from "node:test";
import assert from "node:assert/strict";
import { runNodeStep } from "../src/engine.js";
const node = (type, config = {}) => ({ id: "node-1", type, data: { config } });
const items = [
  { json: { score: 3 } },
  { json: { score: 9 } },
  { json: { score: 6 } },
];
test("Manual Trigger preserves default, empty and legacy object inputs", async () => {
  const cases = [
    [{}, [{ json: {} }]],
    [{ initialItems: [] }, []],
    [
      { initialItems: { json: { score: 3 } } },
      [{ json: { json: { score: 3 } } }],
    ],
  ];
  for (const [config, expected] of cases) {
    const result = await runNodeStep(node("manualTrigger", config));
    assert.equal(result.status, "success");
    assert.deepEqual(result.outputItemsByPort.main, expected);
  }
  const invalid = await runNodeStep(
    node("manualTrigger", { initialItems: [1] }),
  );
  assert.equal(invalid.status, "failed");
  assert.match(invalid.error, /Initial Items/);
});
test("execute step does not schedule downstream", async () => {
  const result = await runNodeStep(node("limit", { count: 2 }), items);
  assert.equal(result.outputItemsByPort.main.length, 2);
  assert.equal(result.nodeId, "node-1");
  assert.equal(result.status, "success");
});
test("IF step preserves separate True and False output ports", async () => {
  const result = await runNodeStep(
    node("if", { conditions: [{ field: "score", operator: "gt", value: 5 }] }),
    items,
  );
  assert.equal(result.outputItemsByPort.true.length, 2);
  assert.equal(result.outputItemsByPort.false.length, 1);
});
test("output step only receives its input", async () => {
  const result = await runNodeStep(node("output"), items);
  assert.deepEqual(result.inputItems, items);
  assert.deepEqual(result.outputItemsByPort, {});
});
test("HTTP step invokes injected fetch rather than simulated output", async () => {
  let seen = 0;
  const fakeFetch = async () => {
    seen++;
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => JSON.stringify({ ok: true }),
    };
  };
  const result = await runNodeStep(
    node("httpRequest", { url: "https://jsonplaceholder.typicode.com/todos" }),
    [{ json: {} }],
    { fetchImpl: fakeFetch },
  );
  assert.equal(seen, 1);
  assert.equal(result.outputItemsByPort.main[0].json.ok, true);
});
test("step with malformed input rejected", async () => {
  await assert.rejects(
    () => runNodeStep(node("set"), [{ bad: true }]),
    /Invalid input items/,
  );
});
