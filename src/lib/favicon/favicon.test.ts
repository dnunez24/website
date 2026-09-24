import type { APIContext } from "astro";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { GET as appleTouchIcon } from "../../pages/apple-touch-icon.png";
import { GET as faviconIco } from "../../pages/favicon.ico";

describe("favicon.ico", () => {
	it("serves an ICO whose directory entry points to a real, decodable 32×32 PNG", async () => {
		const response = await faviconIco({} as APIContext);
		expect(response.headers.get("Content-Type")).toBe(
			"image/vnd.microsoft.icon",
		);
		const body = new Uint8Array(await response.arrayBuffer());
		const view = new DataView(body.buffer);
		expect([body[6], body[7]]).toEqual([32, 32]); // ICONDIRENTRY width/height
		const bytesInResource = view.getUint32(14, true);
		const offset = view.getUint32(18, true);
		// The container's own byte-laying-out logic is covered by ico.test.ts;
		// this confirms the offset it names holds a real, correctly sized PNG.
		expect(body.byteLength).toBe(offset + bytesInResource);
		const meta = await sharp(body.slice(offset)).metadata();
		expect(meta).toMatchObject({ width: 32, height: 32, format: "png" });
	});
});

describe("apple-touch-icon.png", () => {
	it("serves a 180×180 opaque PNG with no alpha channel", async () => {
		const response = await appleTouchIcon({} as APIContext);
		expect(response.headers.get("Content-Type")).toBe("image/png");
		const body = new Uint8Array(await response.arrayBuffer());
		const meta = await sharp(body).metadata();
		expect(meta).toMatchObject({
			width: 180,
			height: 180,
			format: "png",
			hasAlpha: false,
			channels: 3,
		});
	});
});
