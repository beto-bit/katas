CREATE TABLE IF NOT EXISTS nodes (
    id SERIAL PRIMARY KEY,
    label VARCHAR(100) NOT NULL,
    name VARCHAR(500) NOT NULL,
    properties JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_nodes_label ON nodes(label);
CREATE INDEX IF NOT EXISTS idx_nodes_name ON nodes(name);
CREATE INDEX IF NOT EXISTS idx_nodes_properties ON nodes USING GIN (properties);

CREATE TABLE IF NOT EXISTS edges (
    id SERIAL PRIMARY KEY,
    source_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    target_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    relation_type VARCHAR(100) NOT NULL,
    weight FLOAT,
    properties JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(relation_type);
CREATE INDEX IF NOT EXISTS idx_edges_source_target ON edges(source_id, target_id);

CREATE TABLE IF NOT EXISTS uploads (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    filetype VARCHAR(50) NOT NULL,
    year INTEGER,
    month INTEGER,
    status VARCHAR(50) DEFAULT 'pending',
    processed_at TIMESTAMP,
    error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
