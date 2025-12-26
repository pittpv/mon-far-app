// Database adapter for notification tokens
// This provides an abstraction layer so you can easily switch between
// in-memory storage, file-based storage, or a real database

export interface VoteRecord {
  address: string;
  network: string; // Network identifier (e.g., "mainnet", "base", "monad")
  voteTime: number;
  cooldownEndTime: number;
}

export interface NotificationToken {
  fid: number;
  token: string;
  url: string;
  // Legacy fields: deprecated, only used during data migration
  // After migration-remove-legacy-fields.sql is run, these will always be undefined
  // All vote data should be stored in votes array
  address?: string;
  lastVoteTime?: number;
  // Primary field: array of votes to support multiple addresses per FID
  votes?: VoteRecord[];
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

import { Pool } from 'pg';

// Global pool for serverless environments (reused across invocations)
declare global {
  // eslint-disable-next-line no-var
  var pgPool: Pool | undefined;
}

class PostgreSQLAdapter implements DatabaseAdapter {
  private pool: Pool;

  constructor() {
    // Support multiple ways to get connection string:
    // 1. Direct DATABASE_URL (preferred - format: postgresql://user:pass@host:port/db)
    // 2. Construct from Supabase POSTGRES_* variables (direct connection on port 5432)
    // 3. POSTGRES_PRISMA_URL (with pgbouncer on port 6543 - may not support transactions)
    let connectionString = process.env.DATABASE_URL;
    
    // Prefer constructing direct connection from Supabase variables (port 5432)
    // This avoids pgbouncer which may not support transactions
    if (!connectionString && process.env.POSTGRES_HOST) {
      const host = process.env.POSTGRES_HOST;
      const password = process.env.POSTGRES_PASSWORD;
      const database = process.env.POSTGRES_DATABASE || 'postgres';
      
      // For Supabase, user format is: postgres.[project-ref]
      // Extract from POSTGRES_HOST if it's in format db.[project-ref].supabase.co
      let user = process.env.POSTGRES_USER;
      if (!user && host.includes('.supabase.co')) {
        const projectRef = host.split('.')[0].replace('db.', '');
        user = `postgres.${projectRef}`;
      }
      user = user || 'postgres';
      
      // Use direct connection port 5432 (not pgbouncer port 6543)
      const port = process.env.POSTGRES_PORT || '5432';
      
      connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}?sslmode=require`;
      console.log('🔌 Using direct PostgreSQL connection (port 5432)');
    }
    
    // Fallback to Prisma URL if nothing else available (but warn about pgbouncer)
    if (!connectionString) {
      connectionString = process.env.POSTGRES_PRISMA_URL;
      if (connectionString) {
        console.warn('⚠️ Using POSTGRES_PRISMA_URL with pgbouncer. This may not support transactions. Consider using direct connection.');
      }
    }
    
    if (!connectionString) {
      throw new Error(
        'PostgreSQL connection string not found. Please set DATABASE_URL or POSTGRES_* variables. ' +
        'For Supabase, ensure POSTGRES_HOST, POSTGRES_PASSWORD, and POSTGRES_DATABASE are set.'
      );
    }
    
    // Normalize connection string (handle different formats)
    // Both postgres:// and postgresql:// work, but normalize to postgresql:// for consistency
    if (connectionString.startsWith('psql://')) {
      connectionString = connectionString.replace('psql://', 'postgresql://');
    }
    if (connectionString.startsWith('postgres://')) {
      // postgres:// is equivalent to postgresql://, but normalize for consistency
      connectionString = connectionString.replace('postgres://', 'postgresql://');
    }
    
    console.log('🔌 Connecting to PostgreSQL:', connectionString.replace(/:[^:@]+@/, ':****@')); // Hide password in logs
    
    // Use global pool for serverless environments (reused across invocations)
    // This is important for Vercel Edge/Serverless to reuse connections
    if (!globalThis.pgPool) {
      globalThis.pgPool = new Pool({
        connectionString,
        // SSL configuration for Supabase
        ssl: {
          rejectUnauthorized: false, // Required for Supabase
        },
        // Connection pool settings for serverless
        max: 1, // Limit connections for serverless
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
      
      // Handle pool errors
      globalThis.pgPool.on('error', (err) => {
        console.error('❌ PostgreSQL pool error:', err);
      });
    }
    
    this.pool = globalThis.pgPool;
  }

  async getNotificationToken(fid: number): Promise<NotificationToken | null> {
    const result = await this.pool.query(
      'SELECT * FROM notification_tokens WHERE fid = $1',
      [fid]
    );
    
    if (!result.rows[0]) {
      return null;
    }
    
    const row = result.rows[0];
    
    // Parse votes JSON if it exists
    let votes: VoteRecord[] | undefined;
    if (row.votes) {
      try {
        votes = typeof row.votes === 'string' ? JSON.parse(row.votes) : row.votes;
      } catch (error) {
        console.warn(`⚠️ Failed to parse votes JSON for FID ${fid}:`, error);
        votes = undefined;
      }
    }
    
    return {
      fid: row.fid,
      token: row.token,
      url: row.url,
      // Legacy fields: only include if they exist in database (for backward compatibility)
      // After migration-remove-legacy-fields.sql, these will be undefined
      address: row.address || undefined,
      lastVoteTime: row.last_vote_time ? Math.floor(new Date(row.last_vote_time).getTime() / 1000) : undefined,
      votes,
      createdAt: row.created_at ? Math.floor(new Date(row.created_at).getTime() / 1000) : undefined,
      updatedAt: row.updated_at ? Math.floor(new Date(row.updated_at).getTime() / 1000) : undefined,
    };
  }

  async saveNotificationToken(token: NotificationToken): Promise<void> {
    try {
      // Convert votes array to JSON for storage
      const votesJson = token.votes ? JSON.stringify(token.votes) : null;
      
      // Check if legacy columns exist (for backward compatibility during migration)
      // After migration-remove-legacy-fields.sql is run, these columns won't exist
      const hasLegacyColumns = token.address !== undefined || token.lastVoteTime !== undefined;
      
      if (hasLegacyColumns) {
        // Legacy mode: include address and last_vote_time columns
        await this.pool.query(
          `INSERT INTO notification_tokens (fid, token, url, address, last_vote_time, votes, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
           ON CONFLICT (fid) DO UPDATE SET
             token = EXCLUDED.token,
             url = EXCLUDED.url,
             -- Preserve existing address and last_vote_time if new values are NULL
             address = COALESCE(EXCLUDED.address, notification_tokens.address),
             last_vote_time = COALESCE(EXCLUDED.last_vote_time, notification_tokens.last_vote_time),
             -- Preserve votes array if new value is NULL, otherwise update it
             votes = COALESCE(EXCLUDED.votes, notification_tokens.votes),
             updated_at = NOW()`,
          [
            token.fid, 
            token.token, 
            token.url, 
            token.address || null, 
            token.lastVoteTime || null,
            votesJson
          ]
        );
      } else {
        // New mode: only votes array (after legacy columns are removed)
        await this.pool.query(
          `INSERT INTO notification_tokens (fid, token, url, votes, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())
           ON CONFLICT (fid) DO UPDATE SET
             token = EXCLUDED.token,
             url = EXCLUDED.url,
             -- Preserve votes array if new value is NULL, otherwise update it
             votes = COALESCE(EXCLUDED.votes, notification_tokens.votes),
             updated_at = NOW()`,
          [
            token.fid, 
            token.token, 
            token.url, 
            votesJson
          ]
        );
      }
      console.log(`✅ PostgreSQL: Saved token for FID ${token.fid}, votes: ${token.votes?.length || 0}`);
    } catch (error) {
      console.error(`❌ PostgreSQL: Failed to save token for FID ${token.fid}:`, error);
      throw error;
    }
  }

  async removeNotificationToken(fid: number): Promise<void> {
    await this.pool.query('DELETE FROM notification_tokens WHERE fid = $1', [fid]);
  }

  async getAllTokens(): Promise<NotificationToken[]> {
    const result = await this.pool.query('SELECT * FROM notification_tokens');
    return result.rows;
  }
}


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
      // Warn if running on Vercel or other serverless platforms
      if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY) {
        console.warn(
          '⚠️ WARNING: File storage does NOT work on serverless platforms (Vercel/Netlify/AWS Lambda). ' +
          'Files are not persisted between function invocations. ' +
          'Please use PostgreSQL or MongoDB instead by setting NOTIFICATION_STORAGE_TYPE=postgresql or mongodb'
        );
      }
      return new FileAdapter();
    
    case 'postgresql':
      return new PostgreSQLAdapter();
    
    case 'mongodb':
      // Uncomment when ready to use MongoDB
      // return new MongoDBAdapter();
      throw new Error('MongoDB adapter not configured. Set up MongoDBAdapter in db-adapter.ts');
    
    case 'memory':
    default:
      return new InMemoryAdapter();
  }
}

