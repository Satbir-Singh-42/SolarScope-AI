import express from "express";
import { registerRoutes } from "./routes";
import { initializeDatabase } from "./db";
import { storage } from "./storage";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));

// Trust Vercel's reverse proxy for secure cookies
app.set("trust proxy", 1);

// Request logging
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
      console.log(logLine);
    }
  });

  next();
});

// Singleton initialization — runs once per cold start
let initPromise: Promise<void> | null = null;

function ensureInitialized(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await initializeDatabase();

    if (
      "waitForConnectionCheck" in storage &&
      typeof storage.waitForConnectionCheck === "function"
    ) {
      await storage.waitForConnectionCheck();
    }

    await registerRoutes(app);
  })();

  return initPromise;
}

// Vercel serverless handler
export default async function handler(req: any, res: any) {
  await ensureInitialized();
  app(req, res);
}
