import { describe, expect, it } from "vitest";
import { pngToIco } from "./ico";

// Stand-in payload: these tests check container bytes, not real PNG structure.
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4, 5]);

describe("pngToIco", () => {
	it("writes the ICONDIR header: reserved 0, type 1 (icon), one image", () => {
		const view = new DataView(pngToIco(PNG, 32).buffer);
		expect(view.getUint16(0, true)).toBe(0);
		expect(view.getUint16(2, true)).toBe(1);
		expect(view.getUint16(4, true)).toBe(1);
	});

	it("writes one ICONDIRENTRY sized and offset to follow the 6+16 byte header", () => {
		const ico = pngToIco(PNG, 32);
		const view = new DataView(ico.buffer);
		expect(ico[6]).toBe(32); // width
		expect(ico[7]).toBe(32); // height
		expect(ico[8]).toBe(0); // no color palette
		expect(ico[9]).toBe(0); // reserved
		expect(view.getUint16(10, true)).toBe(1); // color planes
		expect(view.getUint16(12, true)).toBe(32); // bits per pixel
		expect(view.getUint32(14, true)).toBe(PNG.byteLength); // bytes in resource
		expect(view.getUint32(18, true)).toBe(22); // offset: 6-byte header + 16-byte entry
	});

	it("appends the PNG unchanged at the directory's offset", () => {
		const ico = pngToIco(PNG, 32);
		expect(ico.byteLength).toBe(22 + PNG.byteLength);
		expect(ico.slice(22)).toEqual(PNG);
	});

	it("stores 256 as 0, the ICO format's way of encoding its max size", () => {
		const ico = pngToIco(PNG, 256);
		expect(ico[6]).toBe(0);
		expect(ico[7]).toBe(0);
	});

	it("rejects sizes outside 1-256", () => {
		expect(() => pngToIco(PNG, 0)).toThrow(RangeError);
		expect(() => pngToIco(PNG, 257)).toThrow(RangeError);
		expect(() => pngToIco(PNG, 32.5)).toThrow(RangeError);
	});
});
