/**
 * Vercel Serverless Function Entry Point
 *
 * This file is auto-detected by Vercel in the api/ directory.
 * Vercel compiles it with its own bundler.
 *
 * DO NOT import this file directly — it's only used during deployment.
 */
import express from "express";
import { registerApiRoutes } from "../server/routes";
import { initializeDatabase } from "../server/db";
import { storage } from "../server/storage";

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));
app.set("trust proxy", 1);

let initialized = false;
let initError: Error | null = null;

async function ensureInitialized() {
  if (initialized) return;
  if (initError) throw initError;

  try {
    await initializeDatabase();

    if (
      "waitForConnectionCheck" in storage &&
      typeof storage.waitForConnectionCheck === "function"
    ) {
      await storage.waitForConnectionCheck();
    }

    registerApiRoutes(app);
    initialized = true;
  } catch (error) {
    initError = error instanceof Error ? error : new Error(String(error));
    console.error("Serverless function initialization failed:", initError);
    throw initError;
  }
}

export default async function handler(req: any, res: any) {
  try {
    await ensureInitialized();
    app(req, res);
  } catch (error) {
    console.error("Serverless handler error:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : String(error),
      stack: process.env.NODE_ENV !== "production"
        ? (error instanceof Error ? error.stack : undefined)
        : undefined,
    });
  }
}
