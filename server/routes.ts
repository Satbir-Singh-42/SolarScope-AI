import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import * as fs from "fs";
import * as os from "os";
import { storage } from "./storage";
import { users, analyses, chatMessages } from "../shared/schema";
import { eq } from "drizzle-orm";
import { analyzeInstallationWithAI, analyzeFaultsWithAI } from "./ai-service";
import { setupAuth } from "./auth";

// AI Chat service function with conversation history
async function generateSolarAdvice(
  message: string,
  conversationHistory: string[] = [],
): Promise<{ response: string; category: string }> {
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || "" });

    // Include conversation history for context
    const historyContext =
      conversationHistory.length > 0
        ? `\nCONVERSATION HISTORY:\n${conversationHistory.slice(-6).join("\n")}\n` // Last 6 messages for context
        : "";

    const solarAdvicePrompt = `
    You are SolarScope AI, a solar panel expert. Provide SHORT, practical advice (max 60 words).

    EXPERTISE: installation, fault detection, maintenance, performance, ROI calculations, safety, Indian helplines.

    INDIAN HELPLINES:
    - MNRE: 1800-180-3333
    - SECI: 011-2436-0707  
    - Solar Mission: 1800-11-3003
    - BEE: 1800-11-2722
    - PM Surya Ghar: 1800-11-4455

    RESPONSE FORMAT: {"response": "brief advice", "category": "installation|fault|maintenance|performance|general|helpline"}

    ${historyContext}

    USER: ${message}

    Provide BRIEF advice in 60 words max.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [solarAdvicePrompt],
      config: {
        maxOutputTokens: 512,
        temperature: 0.3,
        topP: 0.8,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("No response from AI");
    }

    const cleanedText = responseText
      .replace(/```json\s*/g, "")
      .replace(/```\s*$/g, "")
      .replace(/[\x00-\x1F\x7F]/g, "") // Remove control characters
      .trim();

    try {
      const result = JSON.parse(cleanedText);
      return {
        response:
          result.response ||
          "I'm here to help with solar panel questions. Could you please provide more details about what you'd like to know?",
        category: result.category || "general",
      };
    } catch (parseError) {
      // If JSON parsing fails, return the cleaned text directly
      console.log(
        "JSON parsing failed, returning cleaned text directly:",
        parseError,
      );
      return {
        response: cleanedText,
        category: "general",
      };
    }
  } catch (error) {
    console.error("AI Chat generation error:", error);
    throw error; // Re-throw the error to be handled by the route
  }
}

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

// Helper function to save buffer to temporary file for AI analysis with cleanup
function saveBufferToTemp(buffer: Buffer, filename: string): string {
  const tempDir = os.tmpdir();
  const tempPath = path.join(tempDir, `solarscope-${Date.now()}-${filename}`);
  fs.writeFileSync(tempPath, buffer);

  // Schedule cleanup after 10 minutes to prevent disk space issues
  setTimeout(
    () => {
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
          console.log(`Cleaned up temporary file: ${tempPath}`);
        }
      } catch (error) {
        console.warn(`Failed to cleanup temp file ${tempPath}:`, error);
      }
    },
    10 * 60 * 1000,
  ); // 10 minutes

  return tempPath;
}

// Configure multer for serverless deployment (memory storage) with optimized limits
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024, // Reduced to 8MB for better performance
    files: 1, // Only allow 1 file at a time
    fieldSize: 1024 * 1024, // 1MB field size limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication middleware
  setupAuth(app);

  // Health check endpoint - OPTIMIZED to prevent API wastage
  app.get("/api/health", async (_req, res) => {
    let aiStatus = "offline";
    let aiError = null;
    let dbStatus = "disconnected";
    let dbError = null;

    // Check API key presence without making actual API calls to save quota
    try {
      const apiKey = process.env.GOOGLE_API_KEY;

      if (!apiKey || apiKey.trim() === "") {
        aiError = "Google API key not configured";
      } else if (apiKey.length < 30) {
        aiError = "Google API key appears invalid (too short)";
      } else {
        // Only check initialization, no actual API calls
        const { GoogleGenAI } = await import("@google/genai");
        new GoogleGenAI({ apiKey }); // Just test initialization
        aiStatus = "online";
      }
    } catch (error: any) {
      console.log("AI service check failed:", error.message);
      if (
        error.message?.includes("API Key") ||
        error.message?.includes("INVALID_ARGUMENT")
      ) {
        aiError = "Invalid or missing Google API key";
      } else {
        aiError = "AI service initialization failed";
      }
    }

    // Test database connection
    let storageType = "memory";
    try {
      if (process.env.DATABASE_URL) {
        // Test database connectivity by fetching one message
        await storage.getChatMessages(1);

        // Check if storage is HybridStorage to get actual status
        if ("getStorageStatus" in storage) {
          const storageStatus = (storage as any).getStorageStatus();
          storageType = storageStatus.type;
          dbStatus =
            storageStatus.type === "database"
              ? "connected"
              : "fallback_to_memory";

          if (storageStatus.type === "memory") {
            dbError =
              "Database connection failed - using memory storage fallback";
          }
        } else {
          dbStatus = "connected";
          storageType = "postgresql";
        }
      } else {
        dbStatus = "not_configured";
        dbError = "DATABASE_URL not provided - using memory storage";
        storageType = "memory";
      }
    } catch (error) {
      console.warn("Database check failed:", error);
      dbStatus = "error";
      dbError =
        error instanceof Error
          ? error.message
          : "Database connection failed - using memory storage";
      storageType = "memory";
    }

    const overallStatus =
      aiStatus === "online" &&
      (dbStatus === "connected" ||
        dbStatus === "not_configured" ||
        dbStatus === "fallback_to_memory")
        ? "healthy"
        : "degraded";

    res.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      service: "SolarScope AI",
      version: "1.0.0",
      ai: {
        status: aiStatus,
        error: aiError,
      },
      database: {
        status: dbStatus,
        error: dbError,
        storage_type: storageType,
      },
    });
  });

  // Development-only debug endpoints
  if (process.env.NODE_ENV !== "production") {
    // Clear all users except testing user
    app.post("/api/clear-users", async (_req, res) => {
      try {
        await storage.clearAllUsersExceptTesting();
        res.json({
          success: true,
          message: "All users cleared except testing user",
          testing_user: {
            username: "test_user",
            email: "test@example.com",
            password: "password123",
          },
        });
      } catch (error) {
        console.error("Clear users failed:", error);
        res.status(500).json({
          error: "Failed to clear users",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    // Fix testing user password hash
    app.post("/api/fix-test-user", async (_req, res) => {
      try {
        const { hashPassword } = await import("./auth");
        const properHash = await hashPassword("password123");

        if ("updateUserPassword" in storage) {
          await (storage as any).updateUserPassword(
            "test@example.com",
            properHash,
          );
        } else {
          const { db } = await import("./db");
          const { users } = await import("@shared/schema");
          const { eq } = await import("drizzle-orm");

          await db
            .update(users)
            .set({ password: properHash })
            .where(eq(users.email, "test@example.com"));
        }

        res.json({
          success: true,
          message: "Testing user password hash fixed",
          new_hash: properHash,
        });
      } catch (error) {
        console.error("Fix test user failed:", error);
        res.status(500).json({
          error: "Failed to fix test user",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    // Debug endpoint to check database status
    app.get("/api/debug/database", async (_req, res) => {
      try {
        const { db, pool } = await import("./db");

        if (!db || !pool) {
          return res.json({
            status: "disconnected",
            error: "Database connection not available",
          });
        }

        await pool.query("SELECT 1 as test");

        const userCountResult = await db.select().from(users);
        const analysisCountResult = await db.select().from(analyses);
        const chatCountResult = await db.select().from(chatMessages);

        const sampleUsers = userCountResult.slice(0, 5).map((user: any) => ({
          id: user.id,
          username: user.username,
          email: user.email,
          createdAt: user.createdAt,
        }));

        res.json({
          status: "connected",
          tables: {
            users: userCountResult.length,
            analyses: analysisCountResult.length,
            chatMessages: chatCountResult.length,
          },
          sampleUsers,
          databaseUrl: process.env.DATABASE_URL
            ? "configured"
            : "not_configured",
        });
      } catch (error) {
        console.error("Database debug failed:", error);
        res.status(500).json({
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    // Force recreate testing user with correct hash
    app.post("/api/debug/recreate-test-user", async (_req, res) => {
      try {
        const { db } = await import("./db");

        if (!db) {
          return res.json({ error: "Database not available" });
        }

        await db.delete(users).where(eq(users.email, "test@example.com"));

        const { scrypt, randomBytes } = await import("crypto");
        const { promisify } = await import("util");
        const scryptAsync = promisify(scrypt);

        const salt = randomBytes(16).toString("hex");
        const buf = (await scryptAsync("password123", salt, 64)) as Buffer;
        const hashedPassword = `${buf.toString("hex")}.${salt}`;

        const [newUser] = await db
          .insert(users)
          .values({
            username: "test_user",
            email: "test@example.com",
            password: hashedPassword,
          })
          .returning();

        res.json({
          success: true,
          message: "Testing user recreated with correct password hash",
          user: {
            id: newUser.id,
            username: newUser.username,
            email: newUser.email,
            createdAt: newUser.createdAt,
          },
        });
      } catch (error) {
        console.error("Recreate test user failed:", error);
        res.status(500).json({
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });
  }

  // Image validation endpoint
  app.post(
    "/api/validate-image",
    upload.single("image"),
    async (req: MulterRequest, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No image file provided" });
        }

        const { type } = req.body;
        const tempFilePath = saveBufferToTemp(
          req.file.buffer,
          req.file.originalname || "image.jpg",
        );

        try {
          // Basic file validation
          if (!fs.existsSync(tempFilePath)) {
            return res
              .status(400)
              .json({ error: "Failed to process uploaded image" });
          }

          const stats = fs.statSync(tempFilePath);
          const fileSizeInMB = stats.size / (1024 * 1024);

          // Check file size (max 20MB)
          if (fileSizeInMB > 20) {
            return res.status(400).json({
              error: `Image size ${fileSizeInMB.toFixed(2)}MB exceeds 20MB limit`,
            });
          }

          // Check if it's a valid image file
          const validImageTypes = [
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/tiff",
            "image/webp",
          ];
          if (!validImageTypes.includes(req.file.mimetype)) {
            return res.status(400).json({
              error:
                "Invalid image format. Please upload JPG, PNG, or TIFF files.",
            });
          }

          // Use AI classification to validate image content
          try {
            const { classifyImage } = await import("./ai-service");
            const isValid = await classifyImage(
              tempFilePath,
              type === "installation" ? "rooftop" : "solar-panel",
            );

            if (isValid) {
              res.json({
                isValid: true,
                message: "Image validated successfully",
              });
            } else {
              res.status(400).json({
                error:
                  type === "installation"
                    ? "Invalid image for installation analysis. Please upload a rooftop or building image."
                    : "Invalid image for fault detection. Please upload an image showing solar panels or photovoltaic equipment.",
              });
            }
          } catch (aiError) {
            console.error("AI classification error:", aiError);
            // Fallback to basic validation if AI fails
            res.json({
              isValid: true,
              message: "Image validated successfully (basic validation)",
            });
          }
        } catch (error) {
          console.error("Image validation error:", error);
          res.status(400).json({
            error:
              error instanceof Error
                ? error.message
                : "Image validation failed",
          });
        } finally {
          // Clean up temp file
          try {
            fs.unlinkSync(tempFilePath);
          } catch (e) {
            console.error("Error cleaning up temp file:", e);
          }
        }
      } catch (error) {
        console.error("Image validation error:", error);
        res
          .status(500)
          .json({ error: "Internal server error during image validation" });
      }
    },
  );

  // Upload image and analyze for installation planning
  app.post(
    "/api/analyze/installation",
    upload.single("image"),
    async (req: MulterRequest, res) => {
      try {
        console.log("Received installation analysis request");
        console.log("File:", req.file);
        console.log("Body:", req.body);

        if (!req.file) {
          console.error("No file uploaded");
          return res.status(400).json({ message: "No image uploaded" });
        }

        // Save buffer to temporary file for AI analysis
        const imagePath = saveBufferToTemp(
          req.file.buffer,
          req.file.originalname || "image.jpg",
        );
        const userId = req.user ? req.user.id : null; // Use authenticated user's ID or null for non-authenticated
        const sessionId = req.user ? null : req.sessionID; // Use session ID for non-authenticated users

        // Extract roof input parameters
        const roofInput = {
          roofSize: req.body.roofSize ? parseInt(req.body.roofSize) : undefined,
          roofShape: req.body.roofShape || "auto-detect",
          panelSize: req.body.panelSize || "auto-optimize",
        };

        console.log("Starting installation analysis for:", imagePath);

        // Real AI analysis with roof input
        const results = await analyzeInstallationWithAI(imagePath, roofInput);

        console.log("Installation analysis completed successfully");

        // Store analysis result in database (for both authenticated and non-authenticated users)
        let analysis = null;
        try {
          analysis = await storage.createAnalysis({
            userId,
            sessionId,
            type: "installation",
            imagePath,
            results,
          });
          if (userId) {
            console.log("Analysis stored successfully for user:", userId);
          } else {
            console.log("Analysis stored successfully for session:", sessionId);
          }
        } catch (dbError) {
          console.warn(
            "Database storage failed, continuing with AI results:",
            dbError,
          );
          // Continue without database storage - AI analysis was successful
        }

        res.json({ analysis, results });
      } catch (error) {
        console.error("Installation analysis error:", error);
        res.status(500).json({
          message: "Analysis failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  // Upload image and analyze for fault detection
  app.post(
    "/api/analyze/fault-detection",
    upload.single("image"),
    async (req: MulterRequest, res) => {
      try {
        console.log("Received fault detection request");
        console.log("File:", req.file);
        console.log("Body:", req.body);

        if (!req.file) {
          console.error("No file uploaded");
          return res.status(400).json({ message: "No image uploaded" });
        }

        // Save buffer to temporary file for AI analysis
        const imagePath = saveBufferToTemp(
          req.file.buffer,
          req.file.originalname || "image.jpg",
        );
        const userId = req.user ? req.user.id : null; // Use authenticated user's ID or null for non-authenticated
        const sessionId = req.user ? null : req.sessionID; // Use session ID for non-authenticated users

        console.log("Starting AI fault analysis for:", imagePath);

        // Real AI analysis
        const results = await analyzeFaultsWithAI(
          imagePath,
          req.file.originalname,
        );

        console.log("AI fault analysis completed:", results);

        // Store analysis result in database (for both authenticated and non-authenticated users)
        let analysis = null;
        try {
          analysis = await storage.createAnalysis({
            userId,
            sessionId,
            type: "fault-detection",
            imagePath,
            results,
          });
          if (userId) {
            console.log("Fault analysis stored successfully for user:", userId);
          } else {
            console.log(
              "Fault analysis stored successfully for session:",
              sessionId,
            );
          }
        } catch (dbError) {
          console.warn(
            "Database storage failed, continuing with AI results:",
            dbError,
          );
          // Continue without database storage - AI analysis was successful
        }

        res.json({ analysis, results });
      } catch (error) {
        console.error("Fault detection error:", error);
        res.status(500).json({
          message: "Analysis failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  // Get current user's analyses (requires authentication)
  app.get("/api/analyses", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const analyses = await storage.getAnalysesByUser(req.user.id);
      res.json(analyses);
    } catch (error) {
      res.status(500).json({
        message: "Failed to fetch analyses",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get analyses for current session (for non-authenticated users)
  app.get("/api/analyses/session", async (req, res) => {
    try {
      const analyses = await storage.getAnalysesBySession(req.sessionID);
      res.json(analyses);
    } catch (error) {
      res.status(500).json({
        message: "Failed to fetch session analyses",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get user analyses by userId (for compatibility)
  app.get("/api/analyses/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const analyses = await storage.getAnalysesByUser(userId);
      res.json(analyses);
    } catch (error) {
      res.status(500).json({
        message: "Failed to fetch analyses",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get specific analysis
  app.get("/api/analysis/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const analysis = await storage.getAnalysis(id);
      if (!analysis) {
        return res.status(404).json({ message: "Analysis not found" });
      }
      res.json(analysis);
    } catch (error) {
      res.status(500).json({
        message: "Failed to fetch analysis",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Chat endpoints
  app.get("/api/chat/messages", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

      // If user is authenticated, get only their messages
      if (req.user) {
        const messages = await storage.getChatMessagesByUser(
          req.user.id,
          limit,
        );
        res.json(messages);
      } else {
        // For non-authenticated users, get their session-specific messages
        const messages = await storage.getChatMessagesBySession(
          req.sessionID,
          limit,
        );
        res.json(messages);
      }
    } catch (error) {
      res.status(500).json({
        message: "Failed to fetch chat messages",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/chat/send", async (req, res) => {
    try {
      const { message, category = "general" } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({ message: "Message content is required" });
      }

      // Use authenticated user or null for non-authenticated users
      const userId = req.user?.id || null;
      const username = req.user?.username || "Anonymous";

      const sessionId = req.user ? null : req.sessionID; // Use session ID for non-authenticated users

      // Create and store the message
      const chatMessage = await storage.createChatMessage({
        userId,
        sessionId,
        username,
        message: message.trim(),
        type: "user",
        category,
      });

      res.json(chatMessage);
    } catch (error) {
      res.status(500).json({
        message: "Failed to send message",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // AI Chat endpoint with conversation history
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { message, conversationHistory } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({ message: "Message content is required" });
      }

      console.log("AI Chat request received:", message);

      // Store user message in database (for both authenticated and non-authenticated users)
      const userId = req.user?.id || null;
      const sessionId = req.user ? null : req.sessionID;

      let userMessage = null;
      try {
        userMessage = await storage.createChatMessage({
          userId,
          sessionId,
          username: req.user?.username || "Anonymous",
          message: message.trim(),
          type: "user",
          category: "general",
        });
        if (userId) {
          console.log("User message stored in database for user:", userId);
        } else {
          console.log(
            "User message stored in database for session:",
            sessionId,
          );
        }
      } catch (dbError) {
        console.warn("Failed to store user message in database:", dbError);
      }

      // Use Google AI to generate solar panel advice with conversation history
      const aiResponse = await generateSolarAdvice(
        message.trim(),
        conversationHistory || [],
      );

      // Store AI response in database (for both authenticated and non-authenticated users)
      let aiMessage = null;
      try {
        aiMessage = await storage.createChatMessage({
          userId,
          sessionId,
          username: "AI Assistant",
          message: aiResponse.response,
          type: "ai",
          category: aiResponse.category,
        });
        if (userId) {
          console.log("AI response stored in database for user:", userId);
        } else {
          console.log("AI response stored in database for session:", sessionId);
        }
      } catch (dbError) {
        console.warn("Failed to store AI response in database:", dbError);
      }

      res.json(aiResponse);
    } catch (error) {
      console.error("AI Chat error:", error);
      res.status(500).json({
        error: "AI service temporarily unavailable. Please try again later.",
        category: "error",
      });
    }
  });

  // Clear current session data (for non-authenticated users)
  app.post("/api/clear-session", async (req, res) => {
    try {
      await storage.clearSessionData(req.sessionID);
      res.json({ message: "Session data cleared successfully" });
    } catch (error) {
      res.status(500).json({
        message: "Failed to clear session data",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
