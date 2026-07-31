import assert from "node:assert/strict";
import test from "node:test";

test("workspace controller module stays available to the browser bundle", async () => {
  const module = await import("./useWorkspaceController.js");
  assert.equal(typeof module.useWorkspaceController, "function");
});
