import { readFile } from "node:fs/promises";
import sharp from "sharp";

const SOURCE = "public/favicon.svg";

/** The source SVG's viewBox, so density scales it to a crisp render instead of rasterizing small and upscaling. */
const VIEWBOX_UNITS = 32;
const BASE_DENSITY = 72;

/** evergreen-700, the favicon square's own fill: flattening onto it removes the alpha channel without changing a pixel. */
const BACKGROUND = "#495944";

/**
 * Rasterizes `favicon.svg` at `size`. The square already fills the viewBox,
 * so `opaque` exists only to strip the alpha channel sharp's SVG renderer
 * still emits — Apple ignores (and has historically painted black) any
 * transparency in a touch icon.
 */
export async function renderFavicon(
	size: number,
	{ opaque = false }: { opaque?: boolean } = {},
): Promise<Uint8Array<ArrayBuffer>> {
	const svg = await readFile(SOURCE);
	const density = BASE_DENSITY * (size / VIEWBOX_UNITS);
	const image = sharp(svg, { density }).resize(size, size);
	const png = opaque ? image.flatten({ background: BACKGROUND }) : image;
	return new Uint8Array(await png.png().toBuffer());
}
