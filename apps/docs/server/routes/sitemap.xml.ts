import { queryCollection } from "@nuxt/content/nitro";
import { getGeneratedExampleArtifacts } from "typed-xlsx-examples";

// Built from the real pages when the site is prerendered, so moved or new pages never go stale.
export default defineEventHandler(async (event) => {
  const site = (useAppConfig(event).docus?.url ?? "https://typed-xlsx.vercel.app").replace(
    /\/$/,
    "",
  );
  const pages = await queryCollection(event, "docs").select("path").all();
  const paths = new Set([
    "/",
    "/playground",
    // `.navigation.yml` files are collection entries too, but not pages
    ...pages
      .map((page) => page.path)
      .filter((path) => !path.split("/").some((part) => part.startsWith("."))),
    ...getGeneratedExampleArtifacts().map((artifact) => `/playground/${artifact.id}`),
  ]);

  const urls = [...paths]
    .sort()
    .map((path) => `  <url><loc>${site}${path}</loc></url>`)
    .join("\n");

  setHeader(event, "content-type", "application/xml; charset=utf-8");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
});
