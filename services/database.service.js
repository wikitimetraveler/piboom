/**
 * Database Service - Connection Pool Manager
 * 
 * @file       database.service.js
 * @author     David Lane
 * @version    1.0.0
 * @since      2024
 * 
 * @description
 * Centralized database connection pool management service using PostgreSQL.
 * Provides singleton pattern for database connections, connection pooling,
 * and graceful initialization with environment variable configuration.
 * 
 * Features:
 * - PostgreSQL connection pooling via pg library
 * - Singleton pattern for connection reuse
 * - Environment-based configuration (DATABASE_URL)
 * - Graceful initialization (continues without database if not configured)
 * - Connection lifecycle management
 * - Error handling for database operations
 * 
 * Configuration:
 * - DATABASE_URL environment variable for connection string
 * - Optional SSL configuration
 * - Connection pool sizing and timeouts
 * 
 * Technical Implementation:
 * - Uses pg (node-postgres) library
 * - Pool-based connection management
 * - Lazy initialization pattern
 * - Export functions for database access
 * 
 * Usage:
 * - Initialize: initializeDatabase()
 * - Get pool: getPool()
 * - Close connections: closePool()
 * 
 * Error Handling:
 * - Gracefully handles missing DATABASE_URL
 * - Returns null pool when database unavailable
 * - Continues application execution without database
 * 
 * @dependencies
 * - pg (node-postgres)
 * - Environment variable: DATABASE_URL
 * 
 * ==============================================================================
 */

import pg from 'pg';
const { Pool } = pg;

let pool = null;

export function initializeDatabase() {
  // DATABASE_URL is REQUIRED - fail if not provided
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    console.error('   Application cannot start without database connection');
    throw new Error('DATABASE_URL not configured');
  }

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Required for Render PostgreSQL
    },
    // Connection pool settings optimized for remote database
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 60000, // Increased to 60 seconds for slow connections
    query_timeout: 0, // No query timeout (remote DB can be slow)
    statement_timeout: 60000, // Increased to 60 second statement timeout
    // Additional settings for better connection handling
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000
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
    throw new Error('Database pool not initialized - cannot create tables');
  }

  try {
    console.log('🔧 Creating database tables...');
    
    // Test connection first with timeout handling
    try {
      await Promise.race([
        pool.query('SELECT NOW()'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout after 30 seconds')), 30000)
        )
      ]);
      console.log('✅ Database connection verified');
    } catch (connError) {
      if (connError.message.includes('timeout')) {
        throw new Error('Database connection timeout - database is not available or too slow');
      }
      throw new Error(`Database connection failed: ${connError.message}`);
    }

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

    // Create indexes on records for faster searches
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_records_artist ON records(artist)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_records_album ON records(album)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_records_user ON records(user_id)
    `);
    
    // Add composite index for common query pattern (user + sort by date)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_records_user_date ON records(user_id, added_date DESC)
    `);
    
    // Add index for sorting by date (most common sort)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_records_added_date ON records(added_date DESC)
    `);
    
    // Add index for year filtering
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_records_year ON records(year)
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

    // Add AI analysis column if it doesn't exist (migration)
    await pool.query(`
      ALTER TABLE records 
      ADD COLUMN IF NOT EXISTS ai_analysis TEXT
    `);

    // Add location fields if they don't exist
    await pool.query(`
      ALTER TABLE records
      ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS location_label TEXT
    `);

    // Create catches table for fish logging
    await pool.query(`
      CREATE TABLE IF NOT EXISTS catches (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(100),
        species VARCHAR(255) NOT NULL,
        description TEXT,
        notes TEXT,
        image_url TEXT,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        location_label TEXT,
        caught_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_catches_user ON catches(user_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_catches_caught_at ON catches(caught_at DESC)
    `);

    // Rock / meteorite specimens (Nature — Rocky The Rock Star)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rock_specimens (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(100),
        specimen_name VARCHAR(255) NOT NULL,
        likely_type VARCHAR(255),
        notes TEXT,
        image_url TEXT,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        location_label TEXT,
        ai_analysis TEXT,
        found_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_rock_specimens_user ON rock_specimens(user_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_rock_specimens_found_at ON rock_specimens(found_at DESC)
    `);

    // Bikes inventory
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bikes (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(100),
        model VARCHAR(255),
        brand VARCHAR(255),
        size VARCHAR(100),
        color VARCHAR(100),
        motor VARCHAR(255),
        battery VARCHAR(255),
        price DECIMAL(12,2),
        status VARCHAR(50) DEFAULT 'available',
        photos JSONB,
        description TEXT,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        location_label TEXT,
        sold_customer_id INTEGER,
        sold_price DECIMAL(12,2),
        sold_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_bikes_user ON bikes(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_bikes_status ON bikes(status)`);

    // Customers table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(100),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(100),
        photo_url TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_customers_user ON customers(user_id)`);

    // Add family member link (genealogy integration)
    await pool.query(`
      ALTER TABLE records 
      ADD COLUMN IF NOT EXISTS family_member_id INTEGER
    `);

    await pool.query(`
      ALTER TABLE records 
      ADD COLUMN IF NOT EXISTS family_member_name VARCHAR(255)
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

    // Add AI analysis column to trees if it doesn't exist (migration)
    await pool.query(`
      ALTER TABLE trees 
      ADD COLUMN IF NOT EXISTS ai_analysis TEXT
    `);

    // Create indexes on trees table for faster queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_trees_name ON trees(tree_name)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_trees_user ON trees(user_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_trees_location ON trees(latitude, longitude)
    `);
    
    // Add composite index for common query (user + sort by date)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_trees_user_date ON trees(user_id, added_date DESC)
    `);
    
    // Add index for sorting by date
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_trees_added_date ON trees(added_date DESC)
    `);

    // Create critters table for critter collection (animals)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS critters (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(100),
        animal_name VARCHAR(255) NOT NULL,
        scientific_name VARCHAR(255),
        confidence VARCHAR(50),
        features TEXT[],
        habitat VARCHAR(255),
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
    await pool.query(`
      ALTER TABLE critters 
      ADD COLUMN IF NOT EXISTS ai_analysis TEXT
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_critters_name ON critters(animal_name)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_critters_user ON critters(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_critters_location ON critters(latitude, longitude)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_critters_added_date ON critters(added_date DESC)`);

    // Create conversations table for LangChain memory
    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        session_id VARCHAR(255) NOT NULL,
        assistant_type VARCHAR(50) DEFAULT 'levi',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, session_id)
      )
    `);

    // Create messages table for conversation history
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
        user_id VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for fast message retrieval
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id)
    `);

    // Create grateful_dead_shows table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS grateful_dead_shows (
        id SERIAL PRIMARY KEY,
        show_date DATE NOT NULL,
        venue_name VARCHAR(255) NOT NULL,
        city VARCHAR(255),
        state VARCHAR(100),
        country VARCHAR(100),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        setlist TEXT,
        attendance INTEGER,
        recording_available BOOLEAN DEFAULT false,
        archive_identifier VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(show_date, venue_name, city)
      )
    `);

    // Create indexes for grateful_dead_shows
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_gd_shows_date ON grateful_dead_shows(show_date)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_gd_shows_venue ON grateful_dead_shows(venue_name)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_gd_shows_location ON grateful_dead_shows(latitude, longitude)
    `);

    // Create user_show_attendance table for "I Was There" feature
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_show_attendance (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        show_id INTEGER REFERENCES grateful_dead_shows(id) ON DELETE CASCADE,
        was_there BOOLEAN DEFAULT true,
        personal_notes TEXT,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        photos TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, show_id)
      )
    `);

    // Create indexes for user_show_attendance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_attendance_user ON user_show_attendance(user_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_attendance_show ON user_show_attendance(show_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_attendance_was_there ON user_show_attendance(was_there)
    `);

    // Create artists table for expandable concert collections
    await pool.query(`
      CREATE TABLE IF NOT EXISTS artists (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        genre VARCHAR(100),
        formed_year INTEGER,
        disbanded_year INTEGER,
        country VARCHAR(100),
        bio TEXT,
        image_url VARCHAR(500),
        spotify_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create venues table for expandable concert collections
    await pool.query(`
      CREATE TABLE IF NOT EXISTS venues (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        city VARCHAR(255),
        state VARCHAR(100),
        country VARCHAR(100),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        capacity INTEGER,
        venue_type VARCHAR(100),
        website VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(name, city, state)
      )
    `);

    // Create concerts table for expandable concert collections
    await pool.query(`
      CREATE TABLE IF NOT EXISTS concerts (
        id SERIAL PRIMARY KEY,
        artist_id INTEGER REFERENCES artists(id) ON DELETE CASCADE,
        venue_id INTEGER REFERENCES venues(id) ON DELETE CASCADE,
        concert_date DATE NOT NULL,
        tour_name VARCHAR(255),
        setlist TEXT,
        attendance INTEGER,
        recording_available BOOLEAN DEFAULT false,
        archive_identifier VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(artist_id, venue_id, concert_date)
      )
    `);

    // Create user_concert_collections table for user's personal concert history
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_concert_collections (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        concert_id INTEGER REFERENCES concerts(id) ON DELETE CASCADE,
        was_there BOOLEAN DEFAULT true,
        personal_notes TEXT,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        photos TEXT[],
        ticket_price DECIMAL(10, 2),
        seat_location VARCHAR(255),
        weather_notes TEXT,
        companions TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, concert_id)
      )
    `);

    // Create indexes for new tables
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_artists_name ON artists(name)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_venues_location ON venues(city, state, country)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_concerts_artist ON concerts(artist_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_concerts_venue ON concerts(venue_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_concerts_date ON concerts(concert_date)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_collections_user ON user_concert_collections(user_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_collections_concert ON user_concert_collections(concert_id)
    `);

    // Create loans table for loan pipeline disaster risk analysis
    await pool.query(`
      CREATE TABLE IF NOT EXISTS loans (
        id SERIAL PRIMARY KEY,
        loan_number VARCHAR(50) UNIQUE NOT NULL,
        borrower_name VARCHAR(255) NOT NULL,
        property_address VARCHAR(500) NOT NULL,
        city VARCHAR(100) NOT NULL,
        state VARCHAR(2) NOT NULL,
        county VARCHAR(100) NOT NULL,
        zip_code VARCHAR(10) NOT NULL,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        loan_amount DECIMAL(12, 2) NOT NULL,
        loan_type VARCHAR(50) DEFAULT 'Conventional',
        milestone VARCHAR(100) NOT NULL,
        disaster_risk_score INTEGER DEFAULT 0,
        disaster_declaration_count INTEGER DEFAULT 0,
        fema_data JSONB,
        last_risk_analysis TIMESTAMP,
        encompass_loan_guid VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for loans table
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_loans_state_county ON loans(state, county)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_loans_milestone ON loans(milestone)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_loans_risk_score ON loans(disaster_risk_score)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_loans_encompass_guid ON loans(encompass_loan_guid)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_fema_data ON loans USING GIN (fema_data)
    `);
    
    // Add flood zone columns if they don't exist (migration)
    await pool.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name='loans' AND column_name='flood_zone') THEN
          ALTER TABLE loans ADD COLUMN flood_zone VARCHAR(20);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name='loans' AND column_name='flood_zone_type') THEN
          ALTER TABLE loans ADD COLUMN flood_zone_type VARCHAR(100);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name='loans' AND column_name='dfirm_id') THEN
          ALTER TABLE loans ADD COLUMN dfirm_id VARCHAR(50);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name='loans' AND column_name='base_flood_elevation') THEN
          ALTER TABLE loans ADD COLUMN base_flood_elevation DECIMAL(10, 2);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name='loans' AND column_name='flood_zone_data') THEN
          ALTER TABLE loans ADD COLUMN flood_zone_data JSONB;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name='loans' AND column_name='last_flood_zone_check') THEN
          ALTER TABLE loans ADD COLUMN last_flood_zone_check TIMESTAMP;
        END IF;
      END $$;
    `);
    
    // Create index for flood zone
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_loans_flood_zone ON loans(flood_zone)
    `);

    // Create test_executions table for unit test tracking
    await pool.query(`
      CREATE TABLE IF NOT EXISTS test_executions (
        id SERIAL PRIMARY KEY,
        file_name VARCHAR(255) NOT NULL,
        test_number VARCHAR(50) NOT NULL,
        tested_by VARCHAR(50) NOT NULL CHECK (tested_by IN ('DEVELOPER', 'UAT TESTER', 'POST RELEASE TESTER')),
        tested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(file_name, test_number, tested_by)
      )
    `);

    // Create indexes for test_executions
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_test_executions_file_name ON test_executions(file_name)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_test_executions_test_number ON test_executions(test_number)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_test_executions_tested_by ON test_executions(tested_by)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_test_executions_tested_at ON test_executions(tested_at DESC)
    `);

    // Create unit_test_files table for stored unit test Excel library
    // file_content BYTEA stores Excel bytes so library works from any machine (shared DB)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS unit_test_files (
        id SERIAL PRIMARY KEY,
        file_name VARCHAR(255) NOT NULL UNIQUE,
        original_name VARCHAR(255),
        field_ids JSONB DEFAULT '[]',
        row_count INTEGER,
        file_content BYTEA,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_unit_test_files_field_ids ON unit_test_files USING GIN (field_ids)
    `);
    // Migration: add file_content column if table existed without it (old installs)
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'unit_test_files' AND column_name = 'file_content') THEN
          ALTER TABLE unit_test_files ADD COLUMN file_content BYTEA;
        END IF;
      END $$
    `);

    console.log('✅ Database tables created successfully (including conversation memory, Grateful Dead shows, expandable concert collections, loan pipeline, test executions, and unit test files)');
    
    // Migrate existing Grateful Dead data to new structure (run in background)
    migrateGratefulDeadData().catch(error => {
      console.error('❌ Error during Grateful Dead data migration:', error.message);
      console.log('   Migration will be retried on next startup');
    });
  } catch (error) {
    console.error('❌ Error creating tables:', error.message);
    console.error('   Database operations will be unavailable');
    throw error;
  }
}

/**
 * Migrate existing Grateful Dead data to the new expandable concert structure
 */
async function migrateGratefulDeadData() {
  const pool = getPool();
  if (!pool) return;

  try {
    console.log('🔄 Starting Grateful Dead data migration...');
    
    // Check if migration is already complete
    const migrationCheck = await pool.query(`
      SELECT COUNT(*) as count FROM concerts c 
      JOIN artists a ON c.artist_id = a.id 
      WHERE a.name = 'Grateful Dead'
    `);
    
    if (parseInt(migrationCheck.rows[0].count) > 0) {
      console.log('✅ Grateful Dead data already migrated, skipping...');
      return;
    }

    // Check if Grateful Dead artist already exists
    const artistResult = await pool.query(`
      SELECT id FROM artists WHERE name = 'Grateful Dead'
    `);

    let gratefulDeadArtistId;
    if (artistResult.rows.length === 0) {
      // Create Grateful Dead artist
      const newArtistResult = await pool.query(`
        INSERT INTO artists (name, genre, formed_year, disbanded_year, country, bio)
        VALUES ('Grateful Dead', 'Rock', 1965, 1995, 'United States', 'American rock band formed in 1965 in Palo Alto, California.')
        RETURNING id
      `);
      gratefulDeadArtistId = newArtistResult.rows[0].id;
      console.log('✅ Created Grateful Dead artist record');
    } else {
      gratefulDeadArtistId = artistResult.rows[0].id;
      console.log('✅ Found existing Grateful Dead artist record');
    }

    // Check if grateful_dead_shows table exists and has data
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'grateful_dead_shows'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('ℹ️  No grateful_dead_shows table found, skipping migration');
      return;
    }

    // Get count of shows to migrate
    const countResult = await pool.query(`SELECT COUNT(*) as count FROM grateful_dead_shows`);
    const totalShows = parseInt(countResult.rows[0].count);
    
    if (totalShows === 0) {
      console.log('ℹ️  No Grateful Dead shows found to migrate');
      return;
    }

    console.log(`🔄 Migrating ${totalShows} Grateful Dead shows...`);

    // Migrate venues and concerts in batches
    const batchSize = 100;
    let processed = 0;

    for (let offset = 0; offset < totalShows; offset += batchSize) {
      const showsResult = await pool.query(`
        SELECT * FROM grateful_dead_shows ORDER BY show_date LIMIT $1 OFFSET $2
      `, [batchSize, offset]);

      for (const show of showsResult.rows) {
        try {
          // Check if venue exists
          let venueResult = await pool.query(`
            SELECT id FROM venues 
            WHERE name = $1 AND city = $2 AND (state = $3 OR (state IS NULL AND $3 IS NULL))
          `, [show.venue_name, show.city, show.state]);

          let venueId;
          if (venueResult.rows.length === 0) {
            // Create venue
            const newVenueResult = await pool.query(`
              INSERT INTO venues (name, city, state, country, latitude, longitude)
              VALUES ($1, $2, $3, $4, $5, $6)
              RETURNING id
            `, [show.venue_name, show.city, show.state, show.country, show.latitude, show.longitude]);
            venueId = newVenueResult.rows[0].id;
          } else {
            venueId = venueResult.rows[0].id;
          }

          // Check if concert exists
          const concertResult = await pool.query(`
            SELECT id FROM concerts 
            WHERE artist_id = $1 AND venue_id = $2 AND concert_date = $3
          `, [gratefulDeadArtistId, venueId, show.show_date]);

          if (concertResult.rows.length === 0) {
            // Create concert
            await pool.query(`
              INSERT INTO concerts (artist_id, venue_id, concert_date, setlist, attendance, recording_available, archive_identifier, notes)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
              gratefulDeadArtistId, 
              venueId, 
              show.show_date, 
              show.setlist, 
              show.attendance, 
              show.recording_available, 
              show.archive_identifier, 
              show.notes
            ]);
          }
          
          processed++;
          
          // Log progress every 50 shows
          if (processed % 50 === 0) {
            console.log(`🔄 Migrated ${processed}/${totalShows} shows...`);
          }
          
        } catch (showError) {
          console.error(`❌ Error migrating show ${show.id}:`, showError.message);
          // Continue with next show
        }
      }
    }

    console.log(`✅ Grateful Dead data migration completed: ${processed} shows migrated`);
  } catch (error) {
    console.error('❌ Error migrating Grateful Dead data:', error.message);
    throw error; // Re-throw to be caught by the caller
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

