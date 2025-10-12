import pg from 'pg';
const { Pool } = pg;

let pool = null;

export function initializeDatabase() {
  // Only initialize if DATABASE_URL is provided
  if (!process.env.DATABASE_URL) {
    console.log('⚠️  No DATABASE_URL found - database features disabled');
    return null;
  }

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Required for Render PostgreSQL
    },
    // Connection pool settings
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000, // Increased timeout
  });

  // Handle pool errors
  pool.on('error', (err) => {
    console.error('❌ Unexpected database pool error:', err.message);
  });

  console.log('✅ Database connection pool initialized');
  return pool;
}

export async function createTables() {
  if (!pool) {
    console.log('⚠️  Database not initialized - skipping table creation');
    return;
  }

  try {
    console.log('🔧 Creating database tables...');
    
    // Test connection first
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection verified');

    // Create users table with passwords
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        avatar VARCHAR(255),
        color VARCHAR(50),
        description TEXT,
        created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default users with passwords if they don't exist
    await pool.query(`
      INSERT INTO users (id, name, password, avatar, color, description)
      VALUES 
        ('cosmic-turtle', 'The Cosmic Turtle', 'Dufus', '/images/cosmic turtle.png', '#00CED1', 'Cosmic explorer of sound'),
        ('wizened-wizard', 'The Wizened Wizard', 'Giraffe Pizza', '/images/genie.png', '#9370DB', 'Master of musical mysteries'),
        ('jerry-garcia', 'Jerry Garcia', 'Fooze', '/images/jerry.png', '#FF6347', 'Grateful for great tunes'),
        ('easy-levi', 'Easy Rider Levi', 'Zip Knot', '/images/levi.png', '#4682B4', 'Biker hippie trucker'),
        ('fuzz-maestro', 'Fuzz Maestro', 'Fly Dog', '/images/fuzz.png', '#FF8C00', 'Keeper of the fuzz')
      ON CONFLICT (id) DO NOTHING
    `);

    // Create records table for vinyl/album collection
    await pool.query(`
      CREATE TABLE IF NOT EXISTS records (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(100),
        artist VARCHAR(255) NOT NULL,
        album VARCHAR(255) NOT NULL,
        year VARCHAR(50),
        genre VARCHAR(100),
        label VARCHAR(255),
        notes TEXT,
        cover_url TEXT,
        spotify_id VARCHAR(100),
        musicbrainz_id VARCHAR(100),
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(artist, album, user_id)
      )
    `);

    // Create index on artist and album for faster searches
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_records_artist ON records(artist)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_records_album ON records(album)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_records_user ON records(user_id)
    `);

    // Add story/provenance column if it doesn't exist (migration)
    await pool.query(`
      ALTER TABLE records 
      ADD COLUMN IF NOT EXISTS story TEXT
    `);

    // Add valuation column if it doesn't exist (migration)
    await pool.query(`
      ALTER TABLE records 
      ADD COLUMN IF NOT EXISTS valuation DECIMAL(10,2)
    `);

    // Create trees table for tree collection
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trees (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(100),
        tree_name VARCHAR(255) NOT NULL,
        scientific_name VARCHAR(255),
        confidence VARCHAR(50),
        features TEXT[],
        region VARCHAR(255),
        fun_facts TEXT[],
        conservation_status VARCHAR(100),
        description TEXT,
        photo_url TEXT,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        location_name VARCHAR(255),
        notes TEXT,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes on trees table
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_trees_name ON trees(tree_name)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_trees_user ON trees(user_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_trees_location ON trees(latitude, longitude)
    `);

    console.log('✅ Database tables created successfully');
  } catch (error) {
    console.error('❌ Error creating tables:', error.message);
    console.error('   Database operations will be unavailable');
  }
}

export function getPool() {
  return pool;
}

export default {
  initializeDatabase,
  createTables,
  getPool
};

