import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const writing = defineCollection({
	// Markdown and MDX files in `src/content/writing/`.
	loader: glob({ base: "./src/content/writing", pattern: "**/*.{md,mdx}" }),
	// Type-check frontmatter using a schema
	schema: () =>
		z.object({
			title: z.string(),
			description: z.string(),
			// Transform string to Date object
			publishedDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			// Lowercase, hyphenated slugs, so a topic's name is its URL.
			topics: z
				.array(
					z
						.string()
						.regex(
							/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
							"Topics are lowercase, hyphenated slugs, such as developer-experience",
						),
				)
				.optional(),
		}),
});

export const collections = { writing };
