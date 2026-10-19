import { test } from "node:test";
import assert from "node:assert/strict";
import { navDirection, routeRank } from "./nav-direction.ts";

test("pages follow the menu order", () => {
  assert.deepEqual(["/", "/explore", "/g/secure-solidity", "/collection", "/connect", "/new", "/mod"].map(routeRank), [0, 1, 1.5, 2, 3, 4, 5]);
});

test("further right in the menu is forward, further left is back", () => {
  assert.equal(navDirection("/", "/explore"), "forward");
  assert.equal(navDirection("/new", "/"), "back");
  assert.equal(navDirection("/explore", "/g/react-performance"), "forward");
  assert.equal(navDirection("/g/react-performance", "/explore"), "back");
  assert.equal(navDirection("/connect", "/collection"), "back");
});

test("same page, look-alike paths and unknown pages get no direction", () => {
  assert.equal(navDirection("/explore", "/explore"), null);
  assert.equal(navDirection("/g/a", "/g/b"), null);
  assert.equal(navDirection("/", "/explorer"), null);
  assert.equal(navDirection("/", "/raw/a.md"), null);
});
