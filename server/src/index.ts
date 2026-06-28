import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { attachUser } from "./middleware/auth.js";
import eventsRouter from "./routes/events.js";
import authRouter from "./routes/auth.js";
import { errorHandler } from "./lib/errors.js";

const app = express();
const PORT = process.env.PORT ?? 3000;

const allowedOrigins = new Set([
  "http://localhost:5173",
  ...(process.env.CLIENT_ORIGIN ? [process.env.CLIENT_ORIGIN] : []),
]);
// Accept any Vercel preview URL for this project (hash changes per deploy)
const vercelPreview = /^https:\/\/google-calendar-[a-z0-9]+-adrika-sarawats-projects\.vercel\.app$/;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin) || vercelPreview.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin not allowed — ${origin}`));
      }
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Attach userId to every request (null for guests)
app.use(attachUser);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/events", eventsRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
