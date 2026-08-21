const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

pool.on("error", (err) => {
    console.error("Unexpected PostgreSQL pool error:", err);
});

async function testConnection() {
    const client = await pool.connect();

    try {
        await client.query("SELECT NOW()");
        console.log("Connected to PostgreSQL successfully.");
    } finally {
        client.release();
    }
}

module.exports = {
    pool,
    testConnection
};
