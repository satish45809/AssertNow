CREATE TABLE IF NOT EXISTS salesforce_connections (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    my_domain TEXT NOT NULL,
    client_id TEXT NOT NULL,
    client_secret TEXT NOT NULL,
    instance_url TEXT,
    access_token TEXT,
    token_expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflows (
    id SERIAL PRIMARY KEY,
    connection_id INTEGER REFERENCES salesforce_connections(id) ON DELETE SET NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    version INTEGER DEFAULT 1,
    definition JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_test_logs (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER REFERENCES workflows(id) ON DELETE SET NULL,
    connection_id INTEGER REFERENCES salesforce_connections(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'RUNNING',
    trigger_type VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
    step_logs JSONB NOT NULL DEFAULT '[]'::jsonb,
    error_message TEXT,
    duration_ms INTEGER,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_workflows_connection_id ON workflows(connection_id);
CREATE INDEX IF NOT EXISTS idx_test_logs_workflow_id ON workflow_test_logs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_test_logs_status ON workflow_test_logs(status);