/**
 * Vercel Serverless Function Entry Point
 *
 * This file is the esbuild entry point. During `npm run build`,
 * esbuild bundles this + all server code into `api/index.mjs`.
 * Vercel auto-detects `api/index.mjs` as a serverless function.
 *
 * DO NOT import this file directly — it's only used by the build.
 */
import express from "express";
import dotenv from "dotenv";
import { registerApiRoutes } from "../server/routes";
import { initializeDatabase } from "../server/db";
import { storage } from "../server/storage";

dotenv.config();

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));
app.set("trust proxy", 1);

let initialized = false;

async function ensureInitialized() {
  if (initialized) return;

  await initializeDatabase();

  if (
    "waitForConnectionCheck" in storage &&
    typeof storage.waitForConnectionCheck === "function"
  ) {
    await storage.waitForConnectionCheck();
  }

  registerApiRoutes(app);
  initialized = true;
}

export default async function handler(req: any, res: any) {
  await ensureInitialized();
  app(req, res);
}
