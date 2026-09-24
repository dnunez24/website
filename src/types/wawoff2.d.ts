declare module "wawoff2" {
	/** Unwraps a WOFF2 file into the TrueType or OpenType font inside it. */
	export function decompress(input: Uint8Array): Promise<Uint8Array>;
}
