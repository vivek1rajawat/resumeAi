
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");


const app = express();

/**
 * IMPORTANT for Render/Proxies (also helps secure cookies)
 */
app.set("trust proxy", 1);

/**
 * Body parsers
 */
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

/**
 * Cookies
 */
app.use(cookieParser());

/**
 * Basic request logger (so Render logs definitely show activity)
 */
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

/**
 * CORS: allow local + production frontend
 */
const allowedOrigins = [
  process.env.CLIENT_URL, // e.g. https://resume-ai-one-mu.vercel.app
  "http://localhost:5173",
];

function normalizeOrigin(v) {
  return (v || "").replace(/\/$/, "");
}

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (Postman, curl, server-to-server)
      if (!origin) return callback(null, true);

      const normalizedOrigin = normalizeOrigin(origin);
      const normalizedAllowed = allowedOrigins
        .filter(Boolean)
        .map(normalizeOrigin);

      if (normalizedAllowed.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      console.error(
        "CORS blocked origin:",
        origin,
        "allowed:",
        normalizedAllowed
      );
      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/**
 * NOTE:
 * Express/router versions sometimes throw PathError for app.options("*").
 * Using regex is safest.
 */
app.options(/.*/, cors());

/**
 * Routes (IMPORTANT: make sure these files exist with exact casing on Render/Linux)
 * Backend/src/routes/auth.js
 * Backend/src/routes/interview.routes.js   (or .ts accordingly)
 */
const authRouter = require("./routes/auth");
const interviewRouter = require("./routes/interview.routes");

app.use("/api/auth", authRouter);
app.use("/api/interview", interviewRouter);

/**
 * 404 handler (helps debugging)
 */
app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
    path: req.originalUrl,
  });
});

/**
 * Global error handler (THIS will print stack traces in Render logs)
 */
app.use((err, req, res, next) => {
  console.error("GLOBAL_ERROR:", err);
  console.error(err?.stack);
  res.status(err?.status || 500).json({
    message: err?.message || "Internal server error",
  });
});

module.exports = app;