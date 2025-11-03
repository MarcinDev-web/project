import { Pool, type PoolConfig } from 'pg';

export function createDbPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  // Enhanced pool configuration for security
  const isProduction = process.env.NODE_ENV === 'production';
  const config: PoolConfig = {
    connectionString,
    max: 20, // Maximum pool size
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 5000, // Return error after 5 seconds if connection cannot be established
  };

  // In production, ensure SSL is used
  if (isProduction && !connectionString.includes('sslmode=')) {
    console.warn('⚠️  WARNING: DATABASE_URL should use SSL (sslmode=require) in production');
  }

  return new Pool(config);
}

export async function ensureSchema(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Marketplace items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS marketplace_items (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('build', 'avatar')),
        title TEXT NOT NULL,
        description TEXT,
        author_id TEXT NOT NULL,
        author_name TEXT,
        thumbnail_url TEXT,
        file_url TEXT NOT NULL,
        tags TEXT[] DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        downloads INTEGER NOT NULL DEFAULT 0,
        likes INTEGER NOT NULL DEFAULT 0,
        public BOOLEAN NOT NULL DEFAULT true,
        price_currency TEXT,
        price_amount NUMERIC,
        forum_thread_id TEXT
      );
    `);

    // Add forum_thread_id column if it doesn't exist (migration)
    await client.query(`
      ALTER TABLE marketplace_items 
      ADD COLUMN IF NOT EXISTS forum_thread_id TEXT;
    `);

    // Indexes for marketplace_items
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_marketplace_type ON marketplace_items(type);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_marketplace_author ON marketplace_items(author_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_marketplace_created ON marketplace_items(created_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_marketplace_tags ON marketplace_items USING GIN(tags);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_marketplace_search 
      ON marketplace_items 
      USING GIN(to_tsvector('english', title || ' ' || COALESCE(description, '') || ' ' || array_to_string(tags, ' ')));
    `);

    // Marketplace builds table (for Phase 3)
    await client.query(`
      CREATE TABLE IF NOT EXISTS marketplace_builds (
        marketplace_id TEXT PRIMARY KEY REFERENCES marketplace_items(id) ON DELETE CASCADE,
        project_data BYTEA NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Game sessions table (optional enhancement)
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_sessions (
        game_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (game_id, user_id)
      );
    `);

    // Marketplace likes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS marketplace_likes (
        item_id TEXT NOT NULL REFERENCES marketplace_items(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (item_id, user_id)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_marketplace_likes_item ON marketplace_likes(item_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_marketplace_likes_user ON marketplace_likes(user_id);
    `);

    // Shop items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS shop_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL CHECK (category IN ('consumable', 'cosmetic', 'upgrade', 'collectible')),
        price_currency TEXT NOT NULL,
        price_amount NUMERIC NOT NULL,
        image_url TEXT,
        available BOOLEAN NOT NULL DEFAULT true,
        stock INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_shop_items_category ON shop_items(category);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_shop_items_available ON shop_items(available);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_shop_items_currency ON shop_items(price_currency);
    `);

    // Assets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS shop_assets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL CHECK (type IN ('material', 'model', 'texture', 'script')),
        category TEXT,
        price_currency TEXT NOT NULL,
        price_amount NUMERIC NOT NULL,
        preview_url TEXT,
        file_url TEXT NOT NULL,
        metadata JSONB,
        author_id TEXT NOT NULL,
        available BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_shop_assets_type ON shop_assets(type);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_shop_assets_category ON shop_assets(category);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_shop_assets_available ON shop_assets(available);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_shop_assets_author ON shop_assets(author_id);
    `);

    // Purchases table
    await client.query(`
      CREATE TABLE IF NOT EXISTS purchases (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        total_currency TEXT NOT NULL,
        total_amount NUMERIC NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_purchases_created ON purchases(created_at DESC);
    `);

    // Purchase items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_items (
        purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
        item_id TEXT NOT NULL,
        item_type TEXT NOT NULL CHECK (item_type IN ('shop-item', 'asset', 'marketplace-item')),
        name TEXT NOT NULL,
        price_currency TEXT NOT NULL,
        price_amount NUMERIC NOT NULL,
        PRIMARY KEY (purchase_id, item_id, item_type)
      );
    `);

    // User owned items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_owned_items (
        user_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        item_type TEXT NOT NULL CHECK (item_type IN ('shop-item', 'asset', 'marketplace-item')),
        purchased_at TIMESTAMP NOT NULL,
        PRIMARY KEY (user_id, item_id, item_type)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_owned_items_user ON user_owned_items(user_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_owned_items_type ON user_owned_items(item_type);
    `);

    // User projects table (studio projects)
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        project_data BYTEA NOT NULL,
        thumbnail_url TEXT,
        is_published BOOLEAN NOT NULL DEFAULT false,
        version INTEGER NOT NULL DEFAULT 1,
        tags TEXT[] DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_projects_user ON user_projects(user_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_projects_updated ON user_projects(updated_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_projects_published ON user_projects(is_published) WHERE is_published = true;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_projects_tags ON user_projects USING GIN(tags);
    `);

    // Studio teams table
    await client.query(`
      CREATE TABLE IF NOT EXISTS studio_teams (
        id TEXT PRIMARY KEY,
        studio_owner_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_studio_teams_owner ON studio_teams(studio_owner_id);
    `);

    // Team members table
    await client.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        team_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
        joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
        invited_by TEXT NOT NULL,
        PRIMARY KEY (team_id, user_id)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
    `);

    // Team invitations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS team_invitations (
        id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL,
        inviter_id TEXT NOT NULL,
        invitee_user_id TEXT,
        invitee_email TEXT,
        invitee_username TEXT,
        token TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'expired')) DEFAULT 'pending',
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_team_invitations_team ON team_invitations(team_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_team_invitations_user ON team_invitations(invitee_user_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(token);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_team_invitations_status ON team_invitations(status);
    `);

    // Project team access table
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_team_access (
        project_id TEXT NOT NULL,
        team_id TEXT NOT NULL,
        access_level TEXT NOT NULL CHECK (access_level IN ('read', 'write')),
        user_id TEXT,
        PRIMARY KEY (project_id, team_id)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_project_team_access_project ON project_team_access(project_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_project_team_access_team ON project_team_access(team_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_project_team_access_user ON project_team_access(user_id);
    `);

    // Studio settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS studio_settings (
        user_id TEXT PRIMARY KEY,
        focus TEXT NOT NULL CHECK (focus IN ('games', 'assets', 'balanced')) DEFAULT 'balanced',
        goals JSONB DEFAULT '{}'::jsonb,
        cadence_target INTEGER DEFAULT 2,
        show_revenue BOOLEAN NOT NULL DEFAULT true,
        feature_flags JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_studio_settings_focus ON studio_settings(focus);
    `);

    // Studio daily metrics table
    await client.query(`
      CREATE TABLE IF NOT EXISTS studio_metrics_daily (
        user_id TEXT NOT NULL,
        date DATE NOT NULL,
        portfolio_size INTEGER,
        releases INTEGER,
        updates INTEGER,
        downloads INTEGER,
        ratings_count INTEGER,
        avg_rating NUMERIC,
        sales_count INTEGER,
        gross_revenue NUMERIC,
        net_revenue NUMERIC,
        score NUMERIC,
        PRIMARY KEY (user_id, date)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_studio_metrics_date ON studio_metrics_daily(date);
    `);

    // Token blacklist table for persistent token revocation
    await client.query(`
      CREATE TABLE IF NOT EXISTS token_blacklist (
        jti TEXT PRIMARY KEY,
        expires_at BIGINT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires 
      ON token_blacklist(expires_at);
    `);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
