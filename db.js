import mysql2 from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql2.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// // Optional test
// pool.getConnection()
//   .then(conn => {
//     console.log("Connected to MySQL!");
//     conn.release();
//   })
//   .catch(err => {
//     console.error("MySQL connection failed:", err);
//   });

export default pool;