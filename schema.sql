-- Database schema for Tasks application

CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Optional sample tasks for testing
INSERT INTO tasks (title) 
VALUES 
    ('Complete Assignment 6'),
    ('Configure PostgreSQL database')
ON CONFLICT DO NOTHING;
