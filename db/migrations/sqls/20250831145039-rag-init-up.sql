-- Create files table
CREATE TABLE IF NOT EXISTS files (
  id SERIAL PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  last_modified TIMESTAMP NOT NULL,
  last_indexed TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create memory table
CREATE TABLE IF NOT EXISTS memory (
  id SERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  last_modified TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create memory_chunks table
CREATE TABLE IF NOT EXISTS memory_chunks (
  id SERIAL PRIMARY KEY,
  file_id INT REFERENCES files(id) ON DELETE CASCADE,
  memory_id INT REFERENCES memory(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);