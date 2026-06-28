// In development the Vite proxy rewrites /api/* → http://localhost:3000/api/*
// so API_BASE is empty and relative paths work.
// In production set VITE_API_URL=https://your-app.onrender.com in Vercel's
// environment variables so requests go directly to the Render backend.
export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
