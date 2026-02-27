import {
  analyses,
  users,
  chatMessages,
  type User,
  type InsertUser,
  type Analysis,
  type InsertAnalysis,
  type ChatMessage,
  type InsertChatMessage,
} from "../shared/schema";
import { eq, desc, and, isNull } from "drizzle-orm";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPg from "connect-pg-simple";
import { config } from "dotenv";

// Load environment variables before storage initialization
config();

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createAnalysis(analysis: InsertAnalysis): Promise<Analysis>;
  getAnalysesByUser(userId: number): Promise<Analysis[]>;
  getAnalysesBySession(sessionId: string): Promise<Analysis[]>;
  getAnalysis(id: number): Promise<Analysis | undefined>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getChatMessages(limit?: number): Promise<ChatMessage[]>;
  getChatMessagesByUser(userId: number, limit?: number): Promise<ChatMessage[]>;
  getChatMessagesBySession(
    sessionId: string,
    limit?: number,
  ): Promise<ChatMessage[]>;
  clearSessionData(sessionId: string): Promise<void>;
  clearAllUsersExceptTesting(): Promise<void>;
  sessionStore: any;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private analyses: Map<number, Analysis>;
  private chatMessages: Map<number, ChatMessage>;
  private currentUserId: number;
  private currentAnalysisId: number;
  private currentChatMessageId: number;
  public sessionStore: any;

  constructor() {
    this.users = new Map();
    this.analyses = new Map();
    this.chatMessages = new Map();
    this.currentUserId = 1;
    this.currentAnalysisId = 1;
    this.currentChatMessageId = 1;

    // Initialize memory session store
    const MemoryStore = createMemoryStore(session);
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // 24 hours
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((user) => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id, createdAt: new Date() };
    this.users.set(id, user);
    return user;
  }

  async createAnalysis(insertAnalysis: InsertAnalysis): Promise<Analysis> {
    const id = this.currentAnalysisId++;

    // Get the next sequence number for this user and type
    let nextSequenceNumber = 1;
    if (insertAnalysis.userId) {
      const userAnalyses = Array.from(this.analyses.values())
        .filter(
          (a) =>
            a.userId === insertAnalysis.userId &&
            a.type === insertAnalysis.type,
        )
        .sort((a, b) => b.userSequenceNumber - a.userSequenceNumber);

      if (userAnalyses.length > 0) {
        nextSequenceNumber = userAnalyses[0].userSequenceNumber + 1;
      }
    }

    const analysis: Analysis = {
      ...insertAnalysis,
      id,
      userSequenceNumber: nextSequenceNumber,
      originalImageUrl: insertAnalysis.originalImageUrl || null,
      analysisImageUrl: insertAnalysis.analysisImageUrl || null,
      createdAt: new Date(),
      userId: insertAnalysis.userId ?? null,
      sessionId: insertAnalysis.sessionId ?? null,
    };
    this.analyses.set(id, analysis);
    return analysis;
  }

  async getAnalysesByUser(userId: number): Promise<Analysis[]> {
    return Array.from(this.analyses.values()).filter(
      (analysis) => analysis.userId === userId,
    );
  }

  async getAnalysesBySession(sessionId: string): Promise<Analysis[]> {
    return Array.from(this.analyses.values()).filter(
      (analysis) => analysis.sessionId === sessionId,
    );
  }

  async getAnalysis(id: number): Promise<Analysis | undefined> {
    return this.analyses.get(id);
  }

  async createChatMessage(
    insertMessage: InsertChatMessage,
  ): Promise<ChatMessage> {
    const id = this.currentChatMessageId++;
    const message: ChatMessage = {
      ...insertMessage,
      id,
      createdAt: new Date(),
      userId: insertMessage.userId ?? null,
      sessionId: insertMessage.sessionId ?? null,
      category: insertMessage.category ?? null,
      type: insertMessage.type || "user",
    };
    this.chatMessages.set(id, message);
    return message;
  }

  async getChatMessages(limit: number = 50): Promise<ChatMessage[]> {
    const messages = Array.from(this.chatMessages.values()).sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );

    // Return the most recent messages up to the limit
    return messages.slice(-limit);
  }

  async getChatMessagesByUser(
    userId: number,
    limit: number = 50,
  ): Promise<ChatMessage[]> {
    const userMessages = Array.from(this.chatMessages.values())
      .filter((msg) => msg.userId === userId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    // Return the most recent user messages up to the limit
    return userMessages.slice(-limit);
  }

  async getChatMessagesBySession(
    sessionId: string,
    limit: number = 50,
  ): Promise<ChatMessage[]> {
    const sessionMessages = Array.from(this.chatMessages.values())
      .filter((msg) => msg.sessionId === sessionId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    // Return the most recent session messages up to the limit
    return sessionMessages.slice(-limit);
  }

  async clearSessionData(sessionId: string): Promise<void> {
    // Remove analyses for this session
    for (const [id, analysis] of this.analyses.entries()) {
      if (analysis.sessionId === sessionId) {
        this.analyses.delete(id);
      }
    }

    // Remove chat messages for this session
    for (const [id, message] of this.chatMessages.entries()) {
      if (message.sessionId === sessionId) {
        this.chatMessages.delete(id);
      }
    }
  }

  async clearAllUsersExceptTesting(): Promise<void> {
    this.users.clear();
    this.currentUserId = 1;

    // Also clear all analyses and chat messages to start fresh
    this.analyses.clear();
    this.chatMessages.clear();
    this.currentAnalysisId = 1;
    this.currentChatMessageId = 1;
  }

  // Helper method to get current storage status
  getStorageStatus(): { type: "database" | "memory"; available: boolean } {
    return {
      type: "memory",
      available: true,
    };
  }
}

export class DatabaseStorage implements IStorage {
  public sessionStore: any;

  constructor() {
    // Initialize session store after database connection
    this.initializeSessionStore();
  }

  private async initializeSessionStore() {
    try {
      const { pool } = await import("./db");

      if (pool) {
        const PostgresSessionStore = connectPg(session);
        this.sessionStore = new PostgresSessionStore({
          pool: pool,
          createTableIfMissing: true,
          tableName: "session",
        });
        console.log("PostgreSQL session store initialized");
      } else {
        // Fallback to memory store if database not available
        const MemoryStore = await import("memorystore").then((m) => m.default);
        this.sessionStore = new (MemoryStore(session) as any)({
          checkPeriod: 86400000, // 24 hours
        });
        console.log("Memory session store initialized (fallback)");
      }
    } catch (error) {
      console.warn(
        "Session store initialization failed, using memory fallback:",
        error,
      );
      const MemoryStore = await import("memorystore").then((m) => m.default);
      this.sessionStore = new (MemoryStore(session) as any)({
        checkPeriod: 86400000, // 24 hours
      });
    }
  }

  async getDb() {
    const { db } = await import("./db");
    if (!db) {
      throw new Error("Database connection not available");
    }
    return db;
  }

  async getUser(id: number): Promise<User | undefined> {
    const db = await this.getDb();
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const db = await this.getDb();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const db = await this.getDb();
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const db = await this.getDb();
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async createAnalysis(insertAnalysis: InsertAnalysis): Promise<Analysis> {
    const db = await this.getDb();

    // Calculate the next sequence number for this user and type
    let nextSequenceNumber = 1;
    if (insertAnalysis.userId) {
      const userAnalyses = await db
        .select()
        .from(analyses)
        .where(
          and(
            eq(analyses.userId, insertAnalysis.userId),
            eq(analyses.type, insertAnalysis.type),
          ),
        )
        .orderBy(desc(analyses.userSequenceNumber));

      if (userAnalyses.length > 0) {
        nextSequenceNumber = userAnalyses[0].userSequenceNumber + 1;
      }
    }

    const analysisData = {
      ...insertAnalysis,
      userSequenceNumber: nextSequenceNumber,
    };

    const [analysis] = await db
      .insert(analyses)
      .values(analysisData)
      .returning();
    return analysis;
  }

  async getAnalysesByUser(userId: number): Promise<Analysis[]> {
    try {
      const db = await this.getDb();
      return await db
        .select()
        .from(analyses)
        .where(eq(analyses.userId, userId))
        .orderBy(desc(analyses.createdAt));
    } catch (error) {
      console.error("Database getAnalysesByUser error:", error);
      throw error;
    }
  }

  async getAnalysesBySession(sessionId: string): Promise<Analysis[]> {
    const db = await this.getDb();
    return await db
      .select()
      .from(analyses)
      .where(eq(analyses.sessionId, sessionId))
      .orderBy(desc(analyses.createdAt));
  }

  async getAnalysis(id: number): Promise<Analysis | undefined> {
    const db = await this.getDb();
    const [analysis] = await db
      .select()
      .from(analyses)
      .where(eq(analyses.id, id));
    return analysis || undefined;
  }

  async createChatMessage(
    insertMessage: InsertChatMessage,
  ): Promise<ChatMessage> {
    const db = await this.getDb();
    try {
      const [message] = await db
        .insert(chatMessages)
        .values(insertMessage)
        .returning();
      console.log("Database insert successful, message ID:", message.id);
      return message;
    } catch (error) {
      console.error("Database insert failed:", error);
      throw error;
    }
  }

  async getChatMessages(limit: number = 50): Promise<ChatMessage[]> {
    const db = await this.getDb();
    return await db
      .select()
      .from(chatMessages)
      .where(isNull(chatMessages.userId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
  }

  async getChatMessagesByUser(
    userId: number,
    limit: number = 50,
  ): Promise<ChatMessage[]> {
    const db = await this.getDb();
    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.userId, userId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
  }

  async getChatMessagesBySession(
    sessionId: string,
    limit: number = 50,
  ): Promise<ChatMessage[]> {
    const db = await this.getDb();
    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
  }

  async clearSessionData(sessionId: string): Promise<void> {
    const db = await this.getDb();
    // Remove analyses for this session
    await db.delete(analyses).where(eq(analyses.sessionId, sessionId));
    // Remove chat messages for this session
    await db.delete(chatMessages).where(eq(chatMessages.sessionId, sessionId));
  }

  async clearAllUsersExceptTesting(): Promise<void> {
    const db = await this.getDb();
    await db.delete(users);
    await db.delete(analyses);
    await db.delete(chatMessages);
  }

  // Helper method to get current storage status
  getStorageStatus(): { type: "database" | "memory"; available: boolean } {
    return {
      type: "database",
      available: true,
    };
  }
}

// Hybrid storage class that tries database first, falls back to memory
class HybridStorage implements IStorage {
  private memoryStorage: MemStorage;
  private databaseStorage: DatabaseStorage | null;
  private isDatabaseAvailable: boolean = false;
  private connectionCheckPromise: Promise<void>;
  public sessionStore: any;

  constructor() {
    this.memoryStorage = new MemStorage();

    // Only initialize database storage if we have a proper connection
    // This will be determined by the db.ts initialization
    this.databaseStorage = new DatabaseStorage();
    this.sessionStore = this.memoryStorage.sessionStore; // Default to memory
    this.connectionCheckPromise = this.checkDatabaseConnection();
  }

  // Wait for database connection check to complete
  async waitForConnectionCheck(): Promise<void> {
    await this.connectionCheckPromise;
  }

  private async checkDatabaseConnection(): Promise<void> {
    if (!this.databaseStorage) return;

    try {
      // Wait for database initialization to complete
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Test database connection with timeout
      const connectionTest = Promise.race([
        this.databaseStorage.getDb().then((db) => db.execute("SELECT 1")),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Connection timeout")), 5000),
        ),
      ]);

      await connectionTest;

      this.isDatabaseAvailable = true;
      console.log("✓ Database connection verified - using PostgreSQL storage");

      // Switch to database session store
      this.sessionStore = this.databaseStorage.sessionStore;
    } catch (error) {
      console.warn(
        "Database connection failed, using memory storage:",
        error instanceof Error ? error.message : "Unknown error",
      );
      this.isDatabaseAvailable = false;
      this.databaseStorage = null; // Clear failed connection
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    if (this.isDatabaseAvailable && this.databaseStorage) {
      try {
        return await this.databaseStorage.getUser(id);
      } catch (error) {
        console.warn("Database getUser failed, falling back to memory:", error);
        this.isDatabaseAvailable = false;
      }
    }
    return await this.memoryStorage.getUser(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    if (this.isDatabaseAvailable && this.databaseStorage) {
      try {
        return await this.databaseStorage.getUserByUsername(username);
      } catch (error) {
        console.warn(
          "Database getUserByUsername failed, falling back to memory:",
          error,
        );
        this.isDatabaseAvailable = false;
      }
    }
    return await this.memoryStorage.getUserByUsername(username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    if (this.isDatabaseAvailable && this.databaseStorage) {
      try {
        return await this.databaseStorage.getUserByEmail(email);
      } catch (error) {
        console.warn(
          "Database getUserByEmail failed, falling back to memory:",
          error,
        );
        this.isDatabaseAvailable = false;
      }
    }
    return await this.memoryStorage.getUserByEmail(email);
  }

  async createUser(user: InsertUser): Promise<User> {
    if (this.isDatabaseAvailable && this.databaseStorage) {
      try {
        return await this.databaseStorage.createUser(user);
      } catch (error) {
        console.warn(
          "Database createUser failed, falling back to memory:",
          error,
        );
        this.isDatabaseAvailable = false;
      }
    }
    return await this.memoryStorage.createUser(user);
  }

  async createAnalysis(analysis: InsertAnalysis): Promise<Analysis> {
    if (this.isDatabaseAvailable && this.databaseStorage) {
      try {
        return await this.databaseStorage.createAnalysis(analysis);
      } catch (error) {
        console.warn(
          "Database createAnalysis failed, falling back to memory:",
          error,
        );
        this.isDatabaseAvailable = false;
      }
    }
    return await this.memoryStorage.createAnalysis(analysis);
  }

  async getAnalysesByUser(userId: number): Promise<Analysis[]> {
    if (this.isDatabaseAvailable && this.databaseStorage) {
      try {
        return await this.databaseStorage.getAnalysesByUser(userId);
      } catch (error) {
        console.warn(
          "Database getAnalysesByUser failed, falling back to memory:",
          error,
        );
        this.isDatabaseAvailable = false;
      }
    }
    return await this.memoryStorage.getAnalysesByUser(userId);
  }

  async getAnalysis(id: number): Promise<Analysis | undefined> {
    if (this.isDatabaseAvailable && this.databaseStorage) {
      try {
        return await this.databaseStorage.getAnalysis(id);
      } catch (error) {
        console.warn(
          "Database getAnalysis failed, falling back to memory:",
          error,
        );
        this.isDatabaseAvailable = false;
      }
    }
    return await this.memoryStorage.getAnalysis(id);
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    if (this.isDatabaseAvailable && this.databaseStorage) {
      try {
        return await this.databaseStorage.createChatMessage(message);
      } catch (error) {
        console.warn(
          "Database createChatMessage failed, falling back to memory:",
          error,
        );
        this.isDatabaseAvailable = false;
      }
    }
    return await this.memoryStorage.createChatMessage(message);
  }

  async getChatMessages(limit: number = 50): Promise<ChatMessage[]> {
    if (this.isDatabaseAvailable && this.databaseStorage) {
      try {
        return await this.databaseStorage.getChatMessages(limit);
      } catch (error) {
        console.warn(
          "Database getChatMessages failed, falling back to memory:",
          error,
        );
        this.isDatabaseAvailable = false;
      }
    }
    return await this.memoryStorage.getChatMessages(limit);
  }

  async getChatMessagesByUser(
    userId: number,
    limit: number = 50,
  ): Promise<ChatMessage[]> {
    if (this.isDatabaseAvailable && this.databaseStorage) {
      try {
        return await this.databaseStorage.getChatMessagesByUser(userId, limit);
      } catch (error) {
        console.warn(
          "Database getChatMessagesByUser failed, falling back to memory:",
          error,
        );
        this.isDatabaseAvailable = false;
      }
    }
    return await this.memoryStorage.getChatMessagesByUser(userId, limit);
  }

  async getAnalysesBySession(sessionId: string): Promise<Analysis[]> {
    if (this.isDatabaseAvailable && this.databaseStorage) {
      try {
        return await this.databaseStorage.getAnalysesBySession(sessionId);
      } catch (error) {
        console.warn(
          "Database getAnalysesBySession failed, falling back to memory:",
          error,
        );
        this.isDatabaseAvailable = false;
      }
    }
    return await this.memoryStorage.getAnalysesBySession(sessionId);
  }

  async getChatMessagesBySession(
    sessionId: string,
    limit: number = 50,
  ): Promise<ChatMessage[]> {
    if (this.isDatabaseAvailable && this.databaseStorage) {
      try {
        return await this.databaseStorage.getChatMessagesBySession(
          sessionId,
          limit,
        );
      } catch (error) {
        console.warn(
          "Database getChatMessagesBySession failed, falling back to memory:",
          error,
        );
        this.isDatabaseAvailable = false;
      }
    }
    return await this.memoryStorage.getChatMessagesBySession(sessionId, limit);
  }

  async clearSessionData(sessionId: string): Promise<void> {
    if (this.isDatabaseAvailable && this.databaseStorage) {
      try {
        await this.databaseStorage.clearSessionData(sessionId);
        return;
      } catch (error) {
        console.warn(
          "Database clearSessionData failed, falling back to memory:",
          error,
        );
        this.isDatabaseAvailable = false;
      }
    }
    await this.memoryStorage.clearSessionData(sessionId);
  }

  async clearAllUsersExceptTesting(): Promise<void> {
    if (this.isDatabaseAvailable && this.databaseStorage) {
      try {
        await this.databaseStorage.clearAllUsersExceptTesting();
        return;
      } catch (error) {
        console.warn(
          "Database clearAllUsersExceptTesting failed, falling back to memory:",
          error,
        );
        this.isDatabaseAvailable = false;
      }
    }
    await this.memoryStorage.clearAllUsersExceptTesting();
  }

  // Helper method to get current storage status
  getStorageStatus(): { type: "database" | "memory"; available: boolean } {
    return {
      type: this.isDatabaseAvailable ? "database" : "memory",
      available: true,
    };
  }
}

// Storage initialization with hybrid fallback
export const storage = (() => {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    console.log(
      "✓ DATABASE_URL found - using hybrid storage with PostgreSQL fallback",
    );
    return new HybridStorage();
  }

  console.log("Using memory storage for development");
  return new MemStorage();
})();
