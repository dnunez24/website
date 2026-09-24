// Run with: node --test .github/deploy/route-guard.test.mjs
// (Node's built-in test runner — no extra dependency, and deliberately
// outside the project's vitest suite: this tests deploy tooling, not the
// site.) Every *-build job runs this before uploading its artifact.

import assert from "node:assert/strict";
import { test } from "node:test";
import { stripJsonc } from "./route-guard.mjs";

test('a string value containing ",}" survives unchanged', () => {
	const text = '{\n  "name": "website",\n  "note": "a,}b"\n}\n';
	assert.equal(stripJsonc(text).note, "a,}b");
});

test('a string value containing ",]" survives unchanged', () => {
	const text = '{\n  "name": "website",\n  "tags": [", ]  weird"]\n}\n';
	assert.equal(stripJsonc(text).tags[0], ", ]  weird");
});

test("a real trailing comma before } is accepted", () => {
	const text =
		'{\n  "name": "website",\n  "compatibility_date": "2026-09-23",\n}\n';
	assert.equal(stripJsonc(text).name, "website");
});

test("a real trailing comma before ] is accepted", () => {
	const text =
		'{\n  "name": "website",\n  "compatibility_flags": ["a", "b",]\n}\n';
	assert.deepEqual(stripJsonc(text).compatibility_flags, ["a", "b"]);
});

test('a real trailing comma survives right after a string containing ",}"', () => {
	// The fix must not overcorrect into never stripping a real trailing
	// comma just because a nearby string happens to contain one.
	const text = '{\n  "name": "website",\n  "note": "a,}b",\n}\n';
	assert.equal(stripJsonc(text).note, "a,}b");
});

test("// inside a string survives", () => {
	const text =
		'{\n  "$schema": "https://example.com/schema.json",\n  "name": "website"\n}\n';
	assert.equal(stripJsonc(text).$schema, "https://example.com/schema.json");
});

test("a // line comment outside a string is stripped", () => {
	const text = '{\n  // a real comment\n  "name": "website"\n}\n';
	assert.equal(stripJsonc(text).name, "website");
});

test("a /* block */ comment outside a string is stripped", () => {
	const text = '{\n  /* a real comment */\n  "name": "website"\n}\n';
	assert.equal(stripJsonc(text).name, "website");
});

test("an unterminated /* fails", () => {
	const text =
		'{\n  "name": "website",\n  /* this comment never closes\n  "x": 1\n}\n';
	assert.throws(() => stripJsonc(text));
});

test("genuinely malformed JSON (unbalanced brace) fails", () => {
	const text = '{\n  "name": "website"\n';
	assert.throws(() => stripJsonc(text));
});
