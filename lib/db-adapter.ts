// Database adapter for notification tokens
// This provides an abstraction layer so you can easily switch between
// in-memory storage, file-based storage, or a real database

export interface NotificationToken {
  fid: number;
  token: string;
  url: string;
  address?: string;
  lastVoteTime?: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface DatabaseAdapter {
  getNotificationToken(fid: number): Promise<NotificationToken | null>;
  saveNotificationToken(token: NotificationToken): Promise<void>;
  removeNotificationToken(fid: number): Promise<void>;
  getAllTokens(): Promise<NotificationToken[]>;
}

// In-memory adapter (default, for development)
class InMemoryAdapter implements DatabaseAdapter {
  private tokens = new Map<number, NotificationToken>();

  async getNotificationToken(fid: number): Promise<NotificationToken | null> {
    return this.tokens.get(fid) || null;
  }

  async saveNotificationToken(token: NotificationToken): Promise<void> {
    const existing = this.tokens.get(token.fid);
    const now = Math.floor(Date.now() / 1000);
    
    this.tokens.set(token.fid, {
      ...token,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    });
  }

  async removeNotificationToken(fid: number): Promise<void> {
    this.tokens.delete(fid);
  }

  async getAllTokens(): Promise<NotificationToken[]> {
    return Array.from(this.tokens.values());
  }
}

// File-based adapter (for simple persistence without a database)
// Uses JSON file in project root
import { promises as fs } from 'fs';
import path from 'path';

class FileAdapter implements DatabaseAdapter {
  private filePath = path.join(process.cwd(), '.notification-tokens.json');
  private cache: Map<number, NotificationToken> | null = null;

  private async loadCache(): Promise<Map<number, NotificationToken>> {
    if (this.cache) return this.cache;

    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const tokens: NotificationToken[] = JSON.parse(data);
      this.cache = new Map(tokens.map(t => [t.fid, t]));
      return this.cache;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet, return empty map
        this.cache = new Map();
        return this.cache;
      }
      throw error;
    }
  }

  private async saveCache(): Promise<void> {
    if (!this.cache) return;
    
    const tokens = Array.from(this.cache.values());
    await fs.writeFile(this.filePath, JSON.stringify(tokens, null, 2), 'utf-8');
  }

  async getNotificationToken(fid: number): Promise<NotificationToken | null> {
    const cache = await this.loadCache();
    return cache.get(fid) || null;
  }

  async saveNotificationToken(token: NotificationToken): Promise<void> {
    const cache = await this.loadCache();
    const existing = cache.get(token.fid);
    const now = Math.floor(Date.now() / 1000);
    
    cache.set(token.fid, {
      ...token,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    });
    
    await this.saveCache();
  }

  async removeNotificationToken(fid: number): Promise<void> {
    const cache = await this.loadCache();
    cache.delete(fid);
    await this.saveCache();
  }

  async getAllTokens(): Promise<NotificationToken[]> {
    const cache = await this.loadCache();
    return Array.from(cache.values());
  }
}

// PostgreSQL adapter example (uncomment and configure if using PostgreSQL)
/*
import { Pool } from 'pg';

class PostgreSQLAdapter implements DatabaseAdapter {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  async getNotificationToken(fid: number): Promise<NotificationToken | null> {
    const result = await this.pool.query(
      'SELECT * FROM notification_tokens WHERE fid = $1',
      [fid]
    );
    return result.rows[0] || null;
  }

  async saveNotificationToken(token: NotificationToken): Promise<void> {
    await this.pool.query(
      `INSERT INTO notification_tokens (fid, token, url, address, last_vote_time, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (fid) DO UPDATE SET
         token = EXCLUDED.token,
         url = EXCLUDED.url,
         address = EXCLUDED.address,
         last_vote_time = EXCLUDED.last_vote_time,
         updated_at = NOW()`,
      [token.fid, token.token, token.url, token.address || null, token.lastVoteTime || null]
    );
  }

  async removeNotificationToken(fid: number): Promise<void> {
    await this.pool.query('DELETE FROM notification_tokens WHERE fid = $1', [fid]);
  }

  async getAllTokens(): Promise<NotificationToken[]> {
    const result = await this.pool.query('SELECT * FROM notification_tokens');
    return result.rows;
  }
}
*/

// MongoDB adapter example (uncomment and configure if using MongoDB)
/*
import { MongoClient, Db, Collection } from 'mongodb';

class MongoDBAdapter implements DatabaseAdapter {
  private client: MongoClient;
  private db: Db | null = null;
  private collection: Collection<NotificationToken> | null = null;

  constructor() {
    this.client = new MongoClient(process.env.MONGODB_URI!);
  }

  private async getCollection(): Promise<Collection<NotificationToken>> {
    if (!this.db) {
      await this.client.connect();
      this.db = this.client.db();
      this.collection = this.db.collection<NotificationToken>('notification_tokens');
      // Create index on fid for faster lookups
      await this.collection.createIndex({ fid: 1 }, { unique: true });
    }
    return this.collection!;
  }

  async getNotificationToken(fid: number): Promise<NotificationToken | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ fid });
  }

  async saveNotificationToken(token: NotificationToken): Promise<void> {
    const collection = await this.getCollection();
    const now = Math.floor(Date.now() / 1000);
    
    await collection.updateOne(
      { fid: token.fid },
      {
        $set: {
          ...token,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true }
    );
  }

  async removeNotificationToken(fid: number): Promise<void> {
    const collection = await this.getCollection();
    await collection.deleteOne({ fid });
  }

  async getAllTokens(): Promise<NotificationToken[]> {
    const collection = await this.getCollection();
    return await collection.find({}).toArray();
  }
}
*/

// Factory function to get the appropriate adapter
export function getDatabaseAdapter(): DatabaseAdapter {
  const storageType = process.env.NOTIFICATION_STORAGE_TYPE || 'memory';

  switch (storageType) {
    case 'file':
      return new FileAdapter();
    
    case 'postgresql':
      // Uncomment when ready to use PostgreSQL
      // return new PostgreSQLAdapter();
      throw new Error('PostgreSQL adapter not configured. Set up PostgreSQLAdapter in db-adapter.ts');
    
    case 'mongodb':
      // Uncomment when ready to use MongoDB
      // return new MongoDBAdapter();
      throw new Error('MongoDB adapter not configured. Set up MongoDBAdapter in db-adapter.ts');
    
    case 'memory':
    default:
      return new InMemoryAdapter();
  }
}

