import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT, 10) : 3306,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DB ?? "lab",
  charset: "utf8mb4",
  waitForConnections: true,
  connectionLimit: 10,
  connectTimeout: 10000,
});

export default pool;
