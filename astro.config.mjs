import { defineConfig } from "astro/config";
import icon from "astro-icon";

export default defineConfig({
  srcDir: "./src",
  integrations: [
    icon({
      include: {
        gridicons: ["external"],
      },
    }),
  ],
});
