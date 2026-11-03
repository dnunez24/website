import { describe, expect, it } from "vitest";
import { pngToIco } from "./ico";

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

/**
 * A PNG real enough for `pngToIco`: a valid signature and IHDR chunk (the
 * only part it reads), plus whatever trailing bytes stand in for the rest
 * of the file — pngToIco copies those through unexamined.
 */
function fakePng(
	width: number,
	height: number,
	...trailing: number[]
): Uint8Array {
	const ihdr = new Uint8Array(4 + 4 + 13); // chunk length + "IHDR" + IHDR data
	const view = new DataView(ihdr.buffer);
	view.setUint32(0, 13, false);
	ihdr.set([0x49, 0x48, 0x44, 0x52], 4); // "IHDR"
	view.setUint32(8, width, false);
	view.setUint32(12, height, false);
	return new Uint8Array([...PNG_SIGNATURE, ...ihdr, ...trailing]);
}

describe("pngToIco", () => {
	it("writes the ICONDIR header: reserved 0, type 1 (icon), one image", () => {
		const view = new DataView(pngToIco(fakePng(32, 32)).buffer);
		expect(view.getUint16(0, true)).toBe(0);
		expect(view.getUint16(2, true)).toBe(1);
		expect(view.getUint16(4, true)).toBe(1);
	});

	it("writes one ICONDIRENTRY, sized from the PNG's own IHDR and offset to follow the 6+16 byte header", () => {
		const png = fakePng(32, 32, 1, 2, 3);
		const ico = pngToIco(png);
		const view = new DataView(ico.buffer);
		expect(ico[6]).toBe(32); // width, read from IHDR, not asserted by a caller
		expect(ico[7]).toBe(32); // height
		expect(ico[8]).toBe(0); // no color palette
		expect(ico[9]).toBe(0); // reserved
		expect(view.getUint16(10, true)).toBe(1); // color planes
		expect(view.getUint16(12, true)).toBe(32); // bits per pixel
		expect(view.getUint32(14, true)).toBe(png.byteLength); // bytes in resource
		expect(view.getUint32(18, true)).toBe(22); // offset: 6-byte header + 16-byte entry
	});

	it("appends the PNG unchanged at the directory's offset", () => {
		const png = fakePng(32, 32, 9, 9, 9);
		const ico = pngToIco(png);
		expect(ico.byteLength).toBe(22 + png.byteLength);
		expect(ico.slice(22)).toEqual(png);
	});

	it("stores 256 as 0, the ICO format's way of encoding its max size", () => {
		const ico = pngToIco(fakePng(256, 256));
		expect(ico[6]).toBe(0);
		expect(ico[7]).toBe(0);
	});

	it("rejects a non-square PNG", () => {
		expect(() => pngToIco(fakePng(32, 16))).toThrow(RangeError);
	});

	it("rejects sizes outside 1-256", () => {
		expect(() => pngToIco(fakePng(0, 0))).toThrow(RangeError);
		expect(() => pngToIco(fakePng(257, 257))).toThrow(RangeError);
	});

	it("rejects input that isn't a PNG with IHDR first", () => {
		expect(() => pngToIco(new Uint8Array([1, 2, 3]))).toThrow(TypeError);
	});
});
