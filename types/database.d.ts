/**
 * Type definitions for database service
 */

import { Pool, PoolClient, QueryResult } from 'pg';

export type DatabasePool = Pool | null;

export interface DatabaseQueryResult<T = any> extends QueryResult<T> {}

export interface DatabaseService {
  initializeDatabase: () => Promise<void>;
  getPool: () => DatabasePool;
  closePool: () => Promise<void>;
  createTables: () => Promise<void>;
}

