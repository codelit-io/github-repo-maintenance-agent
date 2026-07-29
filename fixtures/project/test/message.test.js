import assert from "node:assert/strict";
import { test } from "node:test";
import { message } from "../src/message.js";

test("returns the reviewed greeting", () => {
  assert.equal(message(), "Hello");
});
