const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use(cookieParser());

//  CORS: allow both local dev + your deployed frontend
const allowedOrigins = [
  process.env.CLIENT_URL,      // e.g. https://resume-ai-one-mu.vercel.app
  "http://localhost:5173",     // Vite dev
];

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (Postman, server-to-server)
      if (!origin) return callback(null, true);

      // normalize (remove trailing slash)
      const normalizedOrigin = origin.replace(/\/$/, "");
      const normalizedAllowed = allowedOrigins
        .filter(Boolean)
        .map((o) => o.replace(/\/$/, ""));

      if (normalizedAllowed.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
  })
);

// require all the routes here
const authRouter = require("./routes/auth");
const interviewRouter = require("./routes/interview.routes");

// using all the routes here
app.use("/api/auth", authRouter);
app.use("/api/interview", interviewRouter);

module.exports = app;