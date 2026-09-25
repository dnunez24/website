/** Byte lengths of the ICONDIR header and the single ICONDIRENTRY that follows it. */
const HEADER_SIZE = 6;
const ENTRY_SIZE = 16;

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

/**
 * Reads width/height from a PNG's IHDR chunk — the format's own source of
 * truth for its size, so the directory entry can't drift from the pixels
 * a caller actually handed us.
 */
function pngDimensions(png: Uint8Array): { width: number; height: number } {
	const isPng = PNG_SIGNATURE.every((byte, index) => png[index] === byte);
	const chunkType = String.fromCharCode(
		png[12] ?? 0,
		png[13] ?? 0,
		png[14] ?? 0,
		png[15] ?? 0,
	);
	if (!isPng || chunkType !== "IHDR") {
		throw new TypeError("pngToIco needs a PNG with IHDR as its first chunk");
	}
	const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
	// PNG multi-byte fields are big-endian ("network byte order").
	return {
		width: view.getUint32(16, false),
		height: view.getUint32(20, false),
	};
}

/**
 * Wraps one square PNG in a minimal ICO container: a 6-byte ICONDIR header,
 * one 16-byte ICONDIRENTRY, then the PNG itself as the image data. Every
 * current browser (and Windows, since Vista) decodes a PNG-payload ICO, so
 * there's no need to also encode a legacy BMP frame.
 */
export function pngToIco(png: Uint8Array): Uint8Array<ArrayBuffer> {
	const { width, height } = pngDimensions(png);
	if (width !== height) {
		throw new RangeError(`ICO frames must be square; got ${width}x${height}`);
	}
	if (width < 1 || width > 256) {
		throw new RangeError(`ICO frames must be 1-256px; got ${width}`);
	}

	const ico = new Uint8Array(HEADER_SIZE + ENTRY_SIZE + png.byteLength);
	const view = new DataView(ico.buffer);

	// ICONDIR: reserved, type (1 = icon), image count.
	view.setUint16(0, 0, true);
	view.setUint16(2, 1, true);
	view.setUint16(4, 1, true);

	// ICONDIRENTRY, right after the header. Assigning into a Uint8Array
	// wraps mod 256 on its own, which conveniently matches the format's
	// rule that 0 means 256 — the one size a single byte can't spell out.
	ico[HEADER_SIZE] = width;
	ico[HEADER_SIZE + 1] = width;
	ico[HEADER_SIZE + 2] = 0; // no color palette
	ico[HEADER_SIZE + 3] = 0; // reserved
	view.setUint16(HEADER_SIZE + 4, 1, true); // color planes
	view.setUint16(HEADER_SIZE + 6, 32, true); // bits per pixel (RGBA)
	view.setUint32(HEADER_SIZE + 8, png.byteLength, true); // size of the PNG data
	view.setUint32(HEADER_SIZE + 12, HEADER_SIZE + ENTRY_SIZE, true); // offset to the PNG data

	ico.set(png, HEADER_SIZE + ENTRY_SIZE);
	return ico;
}
