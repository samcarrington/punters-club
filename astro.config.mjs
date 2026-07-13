import { defineConfig } from "astro/config";
import partytown from "@astrojs/partytown";
import icon from "astro-icon";

export default defineConfig({
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
    partytown({
      config: {
        forward: ["dataLayer.push"],
      },
    }),
    icon({
      include: {
        gridicons: ["external"],
      },
    }),
  ],
});
