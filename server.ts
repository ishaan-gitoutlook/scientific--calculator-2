import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  const distPath = path.join(process.cwd(), 'dist');
  const indexPath = path.join(distPath, 'index.html');
  
  // Check if we should run in production mode
  const isProd = process.env.NODE_ENV === "production" || fs.existsSync(indexPath);

  // API routes go here
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      env: process.env.NODE_ENV,
      isProd,
      distExists: fs.existsSync(distPath),
      indexExists: fs.existsSync(indexPath)
    });
  });

  if (isProd) {
    console.log(`Starting in production mode serving static files from: ${distPath}`);
    
    // Serve static files from dist
    app.use(express.static(distPath));
    
    // Serve index.html for all other routes (SPA fallback)
    app.get('*', (req, res) => {
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send(`Production build not found at ${indexPath}. Please run 'npm run build'.`);
      }
    });
  } else {
    console.log("Starting in development mode with Vite middleware...");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
