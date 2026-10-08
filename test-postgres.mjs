import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local" });

const { Client } = pg;

const client = new Client({
  host: process.env.TEST_DB_HOST,
  port: Number(process.env.TEST_DB_PORT || 5432),
  database: process.env.TEST_DB_NAME,
  user: process.env.TEST_DB_USER,
  password: process.env.TEST_DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false,
  },
  connectionTimeoutMillis: 10000,
});

console.log("Testing database connection...");
console.log("Host:", process.env.TEST_DB_HOST);
console.log("Port:", process.env.TEST_DB_PORT);
console.log("Database:", process.env.TEST_DB_NAME);
console.log("User:", process.env.TEST_DB_USER);

try {
  await client.connect();

  console.log("✅ DATABASE CONNECTION WORKS!");

  const result = await client.query(`
    SELECT current_database(), current_user
  `);

  console.log(result.rows);

  await client.end();
} catch (error) {
  console.log("❌ DATABASE CONNECTION FAILED");
  console.error(error);
}