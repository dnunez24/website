/**
 * Line fitting for the share cards. Pure functions over a width measure, so
 * they test without fonts.
 */

/** The advance width of `text` at a size the caller has fixed. */
export type Measure = (text: string) => number;

/** Greedy word wrap: each line takes words until the next would pass `maxWidth`. */
export function wrap(
	text: string,
	measure: Measure,
	maxWidth: number,
): string[] {
	const lines: string[] = [];
	let line = "";
	for (const word of text.trim().split(/\s+/)) {
		const next = line ? `${line} ${word}` : word;
		if (!line || measure(next) <= maxWidth) line = next;
		else {
			lines.push(line);
			line = word;
		}
	}
	if (line) lines.push(line);
	return lines;
}

/**
 * The narrowest wrap that keeps the greedy line count, so no line runs long
 * over a short one: what CSS `text-wrap: balance` does.
 */
export function balance(
	text: string,
	measure: Measure,
	maxWidth: number,
): string[] {
	const count = wrap(text, measure, maxWidth).length;
	if (count < 2) return wrap(text, measure, maxWidth);
	let narrow = maxWidth / count;
	let wide = maxWidth;
	// Sixteen halvings land within a hundredth of a pixel.
	for (let step = 0; step < 16; step++) {
		const middle = (narrow + wide) / 2;
		if (wrap(text, measure, middle).length > count) narrow = middle;
		else wide = middle;
	}
	return wrap(text, measure, wide);
}

/** Keeps the first `max` lines; a cut ends at a whole word, with an ellipsis that fits. */
export function clamp(
	lines: string[],
	max: number,
	measure: Measure,
	maxWidth: number,
): string[] {
	if (lines.length <= max) return lines;
	if (max < 1) return [];
	const kept = lines.slice(0, max);
	const words = `${kept[max - 1]} ${lines[max]}`.split(" ");
	while (words.length > 1 && measure(`${words.join(" ")}…`) > maxWidth) {
		words.pop();
	}
	kept[max - 1] = `${words.join(" ").replace(/[\s,;:—–-]+$/, "")}…`;
	return kept;
}

export interface ArticleFitOptions {
	/** Title sizes, largest first. */
	sizes: readonly number[];
	measureTitle: (size: number) => Measure;
	measureSubtitle: Measure;
	maxWidth: number;
	/** The first title line's baseline at a size. */
	firstBaseline: (size: number) => number;
	/** The lowest baseline any line may sit on. */
	floor: number;
	/** Title line height, as a multiple of its size. */
	titleLeading: number;
	subtitle: {
		/** From the title's last baseline to the subtitle's first. */
		gap: number;
		lineHeight: number;
		maxLines: number;
	};
}

export interface ArticleFit {
	size: number;
	lines: string[];
	subtitleLines: string[];
}

/**
 * The title's size and lines, and the subtitle's lines. When the words need
 * more room than the card has, the title steps down a size first; then the
 * subtitle drops to one line; last, the title stops at a word.
 */
export function fitArticle(
	title: string,
	subtitle: string | undefined,
	options: ArticleFitOptions,
): ArticleFit {
	const { maxWidth, measureSubtitle, measureTitle } = options;
	const allSubtitle = subtitle ? wrap(subtitle, measureSubtitle, maxWidth) : [];

	const layout = (subtitleMax: number) => {
		const subtitleLines = clamp(
			allSubtitle,
			subtitleMax,
			measureSubtitle,
			maxWidth,
		);
		const depth = subtitleLines.length
			? options.subtitle.gap +
				(subtitleLines.length - 1) * options.subtitle.lineHeight
			: 0;
		// How many title lines fit above the subtitle at a size, never fewer than one.
		const room = (size: number) =>
			Math.max(
				1,
				Math.floor(
					(options.floor - depth - options.firstBaseline(size)) /
						(size * options.titleLeading),
				) + 1,
			);
		return { subtitleLines, room };
	};

	const fits = (subtitleMax: number): ArticleFit | undefined => {
		const { subtitleLines, room } = layout(subtitleMax);
		for (const size of options.sizes) {
			const lines = balance(title, measureTitle(size), maxWidth);
			if (lines.length <= room(size)) return { size, lines, subtitleLines };
		}
		return undefined;
	};

	const cut = (): ArticleFit => {
		const { subtitleLines, room } = layout(1);
		const size = Math.min(...options.sizes);
		const measure = measureTitle(size);
		const lines = clamp(
			wrap(title, measure, maxWidth),
			room(size),
			measure,
			maxWidth,
		);
		return { size, lines, subtitleLines };
	};

	return (
		fits(options.subtitle.maxLines) ??
		(allSubtitle.length > 1 ? fits(1) : undefined) ??
		cut()
	);
}
