import express from "express";
import { registerRoutes } from "../server/routes";
import { initializeDatabase } from "../server/db";
import { storage } from "../server/storage";

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

  await registerRoutes(app);
  initialized = true;
}

export default async function handler(req: any, res: any) {
  await ensureInitialized();
  app(req, res);
}
