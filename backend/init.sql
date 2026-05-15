-- Database initialization script for Umnico Extension Backend

-- Create integrations table
CREATE TABLE IF NOT EXISTS integrations (
    id SERIAL PRIMARY KEY,
    sa_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    umnico_id VARCHAR(255) UNIQUE NOT NULL,
    telegram_fullname VARCHAR(255),
    sa_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create postbacks table
CREATE TABLE IF NOT EXISTS postbacks (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    offer VARCHAR(255),
    sub_id VARCHAR(255),
    payout NUMERIC(10, 2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create referral_links table
CREATE TABLE IF NOT EXISTS referral_links (
    id SERIAL PRIMARY KEY,
    integration_id INTEGER REFERENCES integrations(id) ON DELETE CASCADE,
    url VARCHAR(500) NOT NULL,
    label VARCHAR(255) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_leads_umnico_id ON leads(umnico_id);
CREATE INDEX IF NOT EXISTS idx_leads_sa_id ON leads(sa_id);
CREATE INDEX IF NOT EXISTS idx_postbacks_lead_id ON postbacks(lead_id);
CREATE INDEX IF NOT EXISTS idx_integrations_sa_id ON integrations(sa_id);
CREATE INDEX IF NOT EXISTS idx_referral_links_integration_id ON referral_links(integration_id);
