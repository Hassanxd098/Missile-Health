import "dotenv/config";

export const config = {
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || "gemini-3.6-flash",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  // Session behaviour — short access tokens are refreshed with a rotating
  // refresh token; "remember me" sessions live for REFRESH_REMEMBER_DAYS.
  accessTokenMinutes: Number(process.env.ACCESS_TOKEN_MINUTES || 15),
  refreshRememberDays: Number(process.env.REFRESH_REMEMBER_DAYS || 30),
  refreshDefaultDays: Number(process.env.REFRESH_DEFAULT_DAYS || 1),
  idleTimeoutMinutes: Number(process.env.IDLE_TIMEOUT_MINUTES || 30),
};

export function requireConfig(...keys) {
  const missing = keys.filter((key) => !config[key]);
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
}
