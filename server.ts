import express from "express";
import path from "path";
import compression from "compression";
import { state, stateVersion, startEngine, stopEngine, closeManualPosition, resetAccountBalance, loadStateFromFirebase, scheduleStateSync } from "./src/server/engine";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  // Gzip compression for all HTTP responses (reduces response size by 75-85%)
  app.use(compression({
    level: 6,
    threshold: 512
  }));
  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Backend Engine API with 304 Not Modified support
  app.get("/api/state", (req, res) => {
    const clientVersion = req.query.v ? parseInt(req.query.v as string) : -1;
    const activeCoin = req.query.activeCoin as string;
    
    // If client already has the latest state version, return 304 with 0 bytes payload!
    if (clientVersion > 0 && clientVersion === stateVersion) {
      return res.status(304).end();
    }

    res.setHeader("Cache-Control", "no-cache");
    
    const optimizedState = {
      ...state,
      version: stateVersion,
      coins: state.coins.map(c => {
        if (c.symbol === activeCoin) return c;
        // Strip out the candles array for non-active coins to save ~2MB per request
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

  app.post("/api/engine/reset-balance", (req, res) => {
    const amount = typeof req.body?.amount === 'number' && !isNaN(req.body.amount) ? req.body.amount : 10000;
    resetAccountBalance(amount);
    res.json({ success: true, balance: state.balance, message: `Balance successfully reset to $${amount.toLocaleString()}` });
  });

  app.post("/api/settings", (req, res) => {
    state.settings = { ...state.settings, ...req.body };
    scheduleStateSync();
    res.json({ success: true, settings: state.settings });
  });

  // Start engine automatically on server boot with state restoration
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
    
    // Cache static assets (JS, CSS, images) for 7 days to eliminate repeat bundle downloads
    app.use(express.static(distPath, {
      maxAge: "7d",
      immutable: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache, must-revalidate");
        } else {
          res.setHeader("Cache-Control", "public, max-age=604800, immutable");
        }
      }
    }));

    app.get("*all", (req, res) => {
      res.setHeader("Cache-Control", "no-cache, must-revalidate");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
