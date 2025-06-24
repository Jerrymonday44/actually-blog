import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

// Configure the connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Function to run migrations
const runMigrations = async () => {
  try {
    console.log("Running migrations...");

    // Example: Create 'blog' table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS blog (
        id SERIAL PRIMARY KEY,
        category VARCHAR(50),
        summary TEXT,
        news TEXT,
        image BYTEA,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        author VARCHAR(100)
      );
    `);

    // Example: Create 'blog_staging' table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS blog_staging (
        id SERIAL PRIMARY KEY,
        category VARCHAR(50),
        summary TEXT,
        news TEXT,
        image JSON,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        author VARCHAR(100)
      );
    `);

    console.log("Migrations completed successfully!");
    process.exit(0); // Exit successfully
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1); // Exit with failure
  }
};

// Run the migrations
runMigrations();

