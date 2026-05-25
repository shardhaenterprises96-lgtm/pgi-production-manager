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

export default app;
