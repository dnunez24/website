import { describe, expect, it } from "vitest";
import { countTopics, topicHref } from "./writing";

const article = (...topics: string[]) => ({ data: { topics } });

describe("countTopics", () => {
	it("counts articles per topic, alphabetical", () => {
		expect(
			countTopics([
				article("systems", "architecture"),
				article("systems"),
				{ data: {} },
			]),
		).toEqual([
			{ name: "architecture", count: 1 },
			{ name: "systems", count: 2 },
		]);
	});

	it("counts an article once when it lists a topic twice", () => {
		expect(countTopics([article("craft", "craft")])).toEqual([
			{ name: "craft", count: 1 },
		]);
	});
});

describe("topicHref", () => {
	it("uses the topic name as its URL segment", () => {
		expect(topicHref("developer-experience")).toBe(
			"/topics/developer-experience/",
		);
	});
});
