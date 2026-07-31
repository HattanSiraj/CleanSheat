import assert from "node:assert/strict";
import test from "node:test";
import { parseCsvInChunks } from "./csvImport.js";

test("CSV chunk parsing combines rows and reports progress", async () => {
  const updates = [];
  const result = await parseCsvInChunks("name,value\nAlpha,1\nBeta,2\n", {
    onProgress: (progress) => updates.push(progress),
  });

  assert.deepEqual(result.data, [
    { name: "Alpha", value: "1" },
    { name: "Beta", value: "2" },
  ]);
  assert.equal(result.errors.length, 0);
  assert.equal(updates.at(-1).rowCount, 2);
});
