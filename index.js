import express from 'express';          // Import Express framework to build the server
import cors from 'cors';                // Import CORS to allow cross-origin requests
import bcrypt from 'bcrypt';            // Import bcrypt for password hashing and comparison
import pool from './db.js';             // Import database connection pool (MySQL in this case)
import nodemailer from 'nodemailer';    // Import Nodemailer to send emails
import dotenv from 'dotenv';            // Import dotenv to load environment variables

dotenv.config();                        // Load environment variables from .env file

const app = express();                  // Create an Express application
app.use(express.json());                // Middleware to parse JSON request bodies
app.use(cors({ origin: "*" }));         // Allow requests from any origin (CORS setup)

// Nodemailer transporter configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',                     // Use Gmail as the email service
  auth: {
    user: process.env.EMAIL_USER,       // Gmail address stored in environment variable
    pass: process.env.EMAIL_PASS        // Gmail App Password stored in environment variable
  }
});

// Start server on port 3000
app.listen(3000, () => {
  console.log('Server is running on port 3000'); // Log message when server starts
});

// Test route to check if server is running
app.get('/', (req, res) => {
  res.status(200).json({ message: 'hii hello running' }); // Respond with JSON message
});

// Login route
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body; // Extract email and password from request body
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]); // Find user by email

    if (rows.length === 0) {              // If no user found
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];                 // Get the first matching user
    const isMatch = await bcrypt.compare(password, user.passwordHash); // Compare entered password with stored hash

    if (!isMatch) {                       // If password does not match
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    res.status(200).json({
  message: 'Login successful',
  userId: user.Id,
  name: user.name,
  email: user.email
});// Successful login response
  } catch (err) {
    console.error(err);                   // Log error to console
    res.status(500).json({ error: 'Login failed' }); // Send error response
  }
});

// Register route
app.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body; // Extract user details from request
    const hashedPassword = await bcrypt.hash(password, 10); // Hash password with salt rounds = 10

    const [result] = await pool.query(
      'INSERT INTO users (name, email, passwordHash) VALUES (?, ?, ?)', // Insert new user into DB
      [name, email, hashedPassword]
    );

    res.status(201).json({
      message: 'User registered successfully',
      userId: result.insertId             // Return newly created user ID
    });
  } catch (err) {
    console.error(err);                   // Log error
    res.status(500).json({ error: 'Registration failed' }); // Send error response
  }
});

// Forgot Password route
app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;            // Extract email from request

  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]); // Check if user exists
  if (rows.length === 0) {               // If user not found
    return res.status(404).json({ error: 'User not found' });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // Generate 6-digit OTP

  await pool.query(
    'UPDATE users SET resetOtp = ?, resetExpires = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE email = ?', 
    [otp, email]                         // Save OTP and expiry time in DB
  );

const mailOptions = {
  from: process.env.EMAIL_USER,        // Sender email
  to: email,                           // Recipient email
  subject: '🔐 Password Reset OTP',    // More engaging subject line
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #f9f9f9;">
      <h2 style="color: #333; text-align: center;">Password Reset Request</h2>
      <p style="font-size: 16px; color: #555;">
        Hello,<br><br>
        We received a request to reset your password. Please use the following One-Time Password (OTP) to proceed:
      </p>
      <div style="text-align: center; margin: 20px 0;">
        <span style="display: inline-block; font-size: 24px; font-weight: bold; color: #007bff; background: #fff; padding: 10px 20px; border: 1px dashed #007bff; border-radius: 6px;">
          ${otp}
        </span>
      </div>
      <p style="font-size: 14px; color: #777;">
        ⚠️ This OTP will expire in <strong>10 minutes</strong>. If you did not request a password reset, please ignore this email.
      </p>
      <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />
      <p style="font-size: 12px; color: #999; text-align: center;">
        This is an automated message. Please do not reply.<br>
        © ${new Date().getFullYear()} Your Company Name
      </p>
    </div>
  `
};

  try {
    await transporter.sendMail(mailOptions); // Send OTP email
    res.json({ message: 'OTP sent to email' }); // Success response
  } catch (err) {
    console.error(err);                   // Log error
    res.status(500).json({ error: 'Failed to send OTP email' }); // Error response
  }
});

// Verify OTP route
app.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;       // Extract email and OTP from request

  const [rows] = await pool.query(
    'SELECT * FROM users WHERE email = ? AND resetOtp = ? AND resetExpires > NOW()', 
    [email, otp]                         // Check if OTP matches and is not expired
  );

  if (rows.length === 0) {               // If no match found
    return res.status(400).json({ error: 'Invalid or expired OTP' });
  }

  res.json({ message: 'OTP verified successfully' }); // Success response
});

// Reset Password route
app.post('/reset-password', async (req, res) => {
  const { email, newPassword } = req.body; // Extract email and new password
  const hashedPassword = await bcrypt.hash(newPassword, 10); // Hash new password

  await pool.query(
    'UPDATE users SET passwordHash = ?, resetOtp = NULL, resetExpires = NULL WHERE email = ?', 
    [hashedPassword, email]              // Update password and clear OTP fields
  );

  res.json({ message: 'Password reset successful' }); // Success response
});