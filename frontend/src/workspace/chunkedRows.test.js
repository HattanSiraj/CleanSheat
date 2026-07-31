import assert from "node:assert/strict";
import test from "node:test";
import { processRowsInChunks } from "./chunkedRows.js";

test("chunked row work preserves order and reports completion", async () => {
  const progress = [];
  let yields = 0;
  const output = await processRowsInChunks(
    [1, 2, 3, 4, 5],
    (value, index, results) => results.push(value + index),
    {
      rowLimit: 2,
      timeBudgetMs: Number.POSITIVE_INFINITY,
      onProgress: (value) => progress.push(value),
      yieldControl: async () => { yields += 1; },
    },
  );

  assert.deepEqual(output, [1, 3, 5, 7, 9]);
  assert.equal(yields, 2);
  assert.equal(progress.at(-1), 1);
});

test("chunked row work can be cancelled", async () => {
  const controller = new AbortController();
  await assert.rejects(
    processRowsInChunks([1, 2, 3], () => {}, {
      signal: controller.signal,
      rowLimit: 1,
      yieldControl: async () => controller.abort(),
    }),
    { name: "AbortError" },
  );
});
