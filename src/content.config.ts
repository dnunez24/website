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
			topics: z.array(z.string()).optional(),
		}),
});

export const collections = { writing };
