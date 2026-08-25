import express from "express";
import path from "path";
import compression from "compression";
import { state, startEngine, stopEngine, closeManualPosition, loadStateFromFirebase, scheduleStateSync } from "./src/server/engine";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  // Body parser
  app.use(compression());
  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Backend Engine API
  app.get("/api/state", (req, res) => {
    const activeCoin = req.query.activeCoin as string;
    
    // Bandwidth Optimization: Only send the massive 'candles' array for the active coin being viewed
    const optimizedState = {
      ...state,
      coins: state.coins.map(c => {
        if (c.symbol === activeCoin) return c;
        
        // Strip out the candles array for non-active coins to save ~2.3MB per request
        const { candles, ...rest } = c;
        return { ...rest, candles: [] };
      })
    };
    
    res.json(optimizedState);
  });

  app.post("/api/engine/start", (req, res) => {
    startEngine();
    res.json({ success: true, message: "Engine started" });
  });

  app.post("/api/engine/stop", (req, res) => {
    stopEngine();
    res.json({ success: true, message: "Engine stopped" });
  });

  app.post("/api/engine/close-position", (req, res) => {
    const { id } = req.body;
    if (id) {
       closeManualPosition(id);
       res.json({ success: true });
    } else {
       res.status(400).json({ success: false, message: "Missing id" });
    }
  });

  app.post("/api/settings", (req, res) => {
    state.settings = { ...state.settings, ...req.body };
    scheduleStateSync();
    res.json({ success: true });
  });

  // Start engine automatically on server boot
  await loadStateFromFirebase();
  startEngine();

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
