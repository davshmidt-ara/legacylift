/** Path the site is served under: "" at a domain's root, "/legacylift" on GitHub Pages. */
export const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Full address of a page on this site, e.g. siteUrl("/app"). */
export const siteUrl = (path: string) => `${window.location.origin}${BASE_PATH}${path}`;
