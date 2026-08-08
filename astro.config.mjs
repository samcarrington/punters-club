import { defineConfig } from "astro/config";
import icon from "astro-icon";
import { SITE } from "./src/lib/constants.ts";

export default defineConfig({
  site: SITE.url,
  srcDir: "./src",
  image: {
    domains: [
      "thumbnailer.mixcloud.com",
      "pickasso.spotifycdn.com",
      "mosaic.scdn.co",
      "resources.tidal.com",
    ],
  },
  integrations: [
    icon({
      include: {
        gridicons: ["external"],
        lucide: ["cookie"],
      },
    }),
  ],
});
