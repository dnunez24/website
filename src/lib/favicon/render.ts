import { readFile } from "node:fs/promises";
import sharp from "sharp";

const SOURCE = "public/favicon.svg";

/** The source SVG's viewBox, so density scales it to a crisp render instead of rasterizing small and upscaling. */
const VIEWBOX_UNITS = 32;
const BASE_DENSITY = 72;

/**
 * Rasterizes `favicon.svg` at `size`. Density alone (no `.resize()`) lands
 * on the exact pixel size, so a wrong density shows up as a wrong-sized
 * output instead of a blurry one silently rescaled to fit. The square
 * already fills the viewBox at full opacity, so `opaque` only drops the
 * alpha channel sharp's SVG renderer still emits — Apple ignores (and has
 * historically painted black) any transparency in a touch icon.
 */
export async function renderFavicon(
	size: number,
	{ opaque = false }: { opaque?: boolean } = {},
): Promise<Uint8Array<ArrayBuffer>> {
	const svg = await readFile(SOURCE);
	const density = BASE_DENSITY * (size / VIEWBOX_UNITS);
	const image = sharp(svg, { density });
	const png = opaque ? image.removeAlpha() : image;
	return new Uint8Array(await png.png().toBuffer());
}
