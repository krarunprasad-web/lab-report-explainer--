import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 4173;

app.use(
  createProxyMiddleware({
    target: "https://lab-report-backend-production.up.railway.app",
    changeOrigin: true,
    secure: true,
    pathFilter: ["/api"],
  })
);

app.use(express.static(path.join(__dirname, "dist")));

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Frontend server listening on 0.0.0.0:${port}`);
});