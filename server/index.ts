import express from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeDatabase } from "./db";
import { storage } from "./storage";
import dotenv from "dotenv";

dotenv.config();

const isProduction = process.env.NODE_ENV === "production";

function createServer() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + "…";
        }

        log(logLine);
      }
    });

    next();
  });

  return app;
}

async function initializeStorage() {
  const isDatabaseConnected = await initializeDatabase();

  if (
    "waitForConnectionCheck" in storage &&
    typeof storage.waitForConnectionCheck === "function"
  ) {
    await storage.waitForConnectionCheck();
  }

  let storageStatus;
  if (
    "getStorageStatus" in storage &&
    typeof storage.getStorageStatus === "function"
  ) {
    storageStatus = storage.getStorageStatus();
  } else {
    storageStatus = { type: "database", available: true };
  }

  log(
    `Database connection: ${isDatabaseConnected ? "✓ Connected" : "✗ Not connected"}`,
  );
  log(`Storage type: ${storageStatus.type}`);
}

async function startServer() {
  // Validate required env vars in production
  if (isProduction) {
    const required = ["DATABASE_URL", "GOOGLE_API_KEY"];
    const missing = required.filter((v) => !process.env[v]);
    if (missing.length > 0) {
      console.error(
        `Missing required environment variables: ${missing.join(", ")}`,
      );
      process.exit(1);
    }
  }

  await initializeStorage();

  const app = createServer();
  const server = await registerRoutes(app);

  if (!isProduction) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT) || 5000;
  const host = "0.0.0.0";

  server.listen(port, host, () => {
    log(`serving on http://${host}:${port}`);
  });

  return server;
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
