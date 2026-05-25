import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import router from "./routes";
import { logger } from "./lib/logger";

const SESSION_SECRET = process.env.SESSION_SECRET ?? "shradha-oil-dev-secret";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin: true, credentials: true }));
// 10mb limit to allow base64-encoded product images (~2MB raw → ~2.7MB encoded)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser(SESSION_SECRET));

// Simple signed-cookie session middleware
app.use((req, _res, next) => {
  const raw = (req as any).signedCookies?.session;
  if (raw) {
    try {
      (req as any).session = JSON.parse(raw);
    } catch {
      (req as any).session = null;
    }
  } else {
    (req as any).session = null;
  }
  next();
});

// Response helper to set session cookie
app.use((_req, res, next) => {
  const origJson = res.json.bind(res);
  (res as any).json = function (body: any) {
    const session = (_req as any).session;
    if (session !== undefined) {
      if (session === null) {
        res.clearCookie("session", { path: "/" });
      } else {
        res.cookie("session", JSON.stringify(session), {
          signed: true,
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 8 * 60 * 60 * 1000, // 8h
        });
      }
    }
    return origJson(body);
  };
  next();
});

app.use("/api", router);

// Idempotent seed for multi-location/shop foundation
(async () => {
  try {
    const { pool } = await import("@workspace/db");
    const client = await pool.connect();
    try {
      await client.query(`
        INSERT INTO locations (id, code, name, type)
        VALUES (1, 'FACTORY', 'Factory / Main Warehouse', 'factory'),
               (2, 'SHOP1', 'Shop 1 — Main Outlet', 'shop')
        ON CONFLICT (code) DO NOTHING;
      `);
      await client.query(`SELECT setval(pg_get_serial_sequence('locations','id'), GREATEST((SELECT MAX(id) FROM locations), 1));`);
      await client.query(`
        INSERT INTO users (username, password_hash, role, name, location_id)
        VALUES ('shop1', 'pass123', 'shop', 'Shop 1 Counter', 2)
        ON CONFLICT (username) DO NOTHING;
      `);
      logger.info("Seed: locations + shop1 user ensured");
    } finally {
      client.release();
    }
  } catch (err) {
    logger.warn({ err }, "Seed skipped (tables may not exist yet)");
  }
})();

export default app;
