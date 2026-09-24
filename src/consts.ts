export const SITE_TITLE = "Dave Nuñez";
export const SITE_TAGLINE = "Leader / Builder / Integrator";
export const SITE_DESCRIPTION = "Example description";
/** First year of publication: the copyright shows a range from this year once it's past. */
export const SITE_SINCE = 2026;

export const HEADER_NAV_ITEMS = [
	{ label: "Writing", href: "/writing/" },
	{ label: "About", href: "/about/" },
] as const;

export const FOOTER_NAV_ITEMS = [
	{ label: "Topics", href: "/topics/" },
	// `rel="me"`: these profiles are the same person as this site.
	{
		label: "LinkedIn",
		href: "https://www.linkedin.com/in/dave-nunez",
		rel: "me",
	},
	{ label: "GitHub", href: "https://github.com/dnunez24", rel: "me" },
	{ label: "RSS", href: "/rss.xml" },
];
