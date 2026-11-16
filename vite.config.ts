import { defineConfig, loadEnv, type Plugin } from "vite";
import { readFileSync } from "node:fs";
import { renderHtml } from "./src/markup.ts";

/** writes the text from src/content.ts into index.html, so it is real HTML in the page */
function contentHtml(): Plugin {
  return { name: "lock-content-html", transformIndexHtml: { order: "pre", handler: (html) => renderHtml(html) } };
}

/** `npm run dev` only: answers /api/contact with the same code Vercel runs (api/contact.ts) */
function devApi(): Plugin {
  return {
    name: "lock-dev-api",
    configureServer(server) {
      server.middlewares.use("/api/contact", async (req, res) => {
        try {
          const mod = await server.ssrLoadModule("/api/contact.ts");
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
          const hasBody = req.method !== "GET" && req.method !== "HEAD";
          const request = new Request(`http://${req.headers.host || "localhost"}/api/contact`, { method: req.method, headers, body: hasBody ? Buffer.concat(chunks) : undefined });
          const out = await (mod.default as { fetch(r: Request): Promise<Response> | Response }).fetch(request);
          res.statusCode = out.status;
          out.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(await out.text());
        } catch (err) {
          server.config.logger.error(String(err));
          res.statusCode = 500;
          res.end('{"ok":false,"error":"server"}');
        }
      });
    },
  };
}

/** `npm run preview` only: sends the same security headers as the live site (vercel.json), so they are tested before going live */
function previewHeaders(): Plugin {
  return {
    name: "lock-preview-headers",
    configurePreviewServer(server) {
      const rules = (JSON.parse(readFileSync("vercel.json", "utf8")).headers || []) as { source: string; headers: { key: string; value: string }[] }[];
      server.middlewares.use((req, res, next) => {
        for (const r of rules) if (new RegExp("^" + r.source + "$").test(req.url || "/")) for (const h of r.headers) res.setHeader(h.key, h.value);
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), "")); // .env values for the dev copy of the email function
  return {
    plugins: [contentHtml(), devApi(), previewHeaders()],
    build: { target: "es2020", chunkSizeWarningLimit: 900 },
    server: { host: "127.0.0.1" },
  };
});
