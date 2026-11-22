import { build } from "esbuild";
import { chromium } from "playwright-core";
import sharp from "sharp";
import assert from "node:assert/strict";
import { CHROME } from "./lib/chrome.mjs";

const [{ text: code }] = (await build({
  stdin: {
    resolveDir: process.cwd(),
    loader: "tsx",
    contents: `
      import { createRoot } from "react-dom/client";
      import { FogOfWar } from "./src/table/FogOfWar";
      const root = createRoot(document.getElementById("root"));
      const upper = [0, 0, 133, 0, 133, 52, 0, 52];
      const left = [0, 0, 65, 0, 65, 52, 0, 52];
      window.drawFog = (visible) => root.render(
        <FogOfWar width={200} height={100} softness={4} explored={[upper]} vision={visible ? [left] : []} />,
      );
      window.drawFog(true);
    `,
  },
  bundle: true,
  define: { "process.env.NODE_ENV": '"production"' },
  jsx: "automatic",
  write: false,
})).outputFiles;

const browser = await chromium.launch({ executablePath: CHROME });
try {
  for (const [api, origin] of [["webgl", "http://192.168.1.20"], ["webgpu", "https://maelstrom.test"]]) {
    const page = await browser.newPage({ viewport: { width: 200, height: 100 } });
    await page.route(origin + "/", (route) => route.fulfill({
      contentType: "text/html",
      body: '<style>body{margin:0;background:white}.sight{position:absolute;top:0;left:0}</style><div id="root"></div>',
    }));
    await page.goto(origin);
    if (api === "webgpu" && !await page.evaluate(async () => Boolean(await navigator.gpu?.requestAdapter()))) {
      if (process.env.KRAKEN_REQUIRE_WEBGPU === "1") throw new Error("Chrome did not expose a WebGPU adapter");
      console.log("skip WebGPU fog: Chrome did not expose an adapter");
      await page.close();
      continue;
    }
    if (api === "webgpu") {
      await page.evaluate(() => {
        const requestDevice = GPUAdapter.prototype.requestDevice;
        GPUAdapter.prototype.requestDevice = async function (...args) {
          const device = await requestDevice.apply(this, args);
          window.loseFogDevice = () => device.destroy();
          return device;
        };
      });
    }
    await page.addScriptTag({ content: code });
    await page.locator(`canvas[data-fog-renderer="${api}"]`).waitFor({ timeout: 10000 });

    const verify = async (visible) => {
      const { data, info } = await sharp(await page.screenshot()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const pixel = (x, y) => data[(y * info.width + x) * info.channels];
      const sample = [pixel(30, 25), pixel(100, 25), pixel(30, 80), pixel(165, 25)];
      assert.ok(visible ? sample[0] >= 250 : Math.abs(sample[0] - 115) <= 4, `${api} current sight: ${sample}`);
      assert.ok(Math.abs(sample[1] - 115) <= 4, `${api} explored territory is dimmed: ${sample}`);
      assert.ok(sample[2] <= 2 && sample[3] <= 2, `${api} unexplored territory remains black: ${sample}`);
      assert.ok(pixel(132, 25) > 10 && pixel(132, 25) < 105, `${api} explored border has a soft edge`);
    };
    await verify(true);
    await page.evaluate(() => window.drawFog(false));
    await verify(false);
    if (api === "webgl") {
      await page.evaluate(() => document.querySelector("canvas").getContext("webgl2").getExtension("WEBGL_lose_context").loseContext());
    } else {
      await page.evaluate(() => window.loseFogDevice());
    }
    await page.locator("svg.sight").waitFor();
    await verify(false);
    await page.close();
    console.log(`ok ${api} fog: current sight, explored and unseen pixels, soft edges, updates, and loss fallback`);
  }
} finally {
  await browser.close();
}
