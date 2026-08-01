// Vercel catch-all — handles /api/* preserving the original URL
import app from "./index.js";

export default function handler(req, res) {
  const segments = req.query?.catchAll;
  if (segments) {
    req.url = `/api/${Array.isArray(segments) ? segments.join("/") : segments}`;
  }
  return app(req, res);
}
