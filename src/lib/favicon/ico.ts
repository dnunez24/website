/** Byte offsets into the ICONDIR header and the single ICONDIRENTRY that follows it. */
const HEADER_SIZE = 6;
const ENTRY_SIZE = 16;

/**
 * Wraps one square PNG in a minimal ICO container: a 6-byte ICONDIR header,
 * one 16-byte ICONDIRENTRY, then the PNG itself as the image data. Every
 * current browser (and Windows, since Vista) decodes a PNG-payload ICO, so
 * there's no need to also encode a legacy BMP frame.
 */
export function pngToIco(
	png: Uint8Array,
	size: number,
): Uint8Array<ArrayBuffer> {
	if (!Number.isInteger(size) || size < 1 || size > 256) {
		throw new RangeError(`ICO frames must be square, 1-256px; got ${size}`);
	}

	const ico = new Uint8Array(HEADER_SIZE + ENTRY_SIZE + png.byteLength);
	const view = new DataView(ico.buffer);

	// ICONDIR: reserved, type (1 = icon), image count.
	view.setUint16(0, 0, true);
	view.setUint16(2, 1, true);
	view.setUint16(4, 1, true);

	// ICONDIRENTRY, right after the header. Width/height wrap to 0 at 256,
	// the format's way of encoding that size in a single byte.
	ico[HEADER_SIZE] = size % 256;
	ico[HEADER_SIZE + 1] = size % 256;
	ico[HEADER_SIZE + 2] = 0; // no color palette
	ico[HEADER_SIZE + 3] = 0; // reserved
	view.setUint16(HEADER_SIZE + 4, 1, true); // color planes
	view.setUint16(HEADER_SIZE + 6, 32, true); // bits per pixel (RGBA)
	view.setUint32(HEADER_SIZE + 8, png.byteLength, true); // size of the PNG data
	view.setUint32(HEADER_SIZE + 12, HEADER_SIZE + ENTRY_SIZE, true); // offset to the PNG data

	ico.set(png, HEADER_SIZE + ENTRY_SIZE);
	return ico;
}
