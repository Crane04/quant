import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import routes from "./routes";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler";
import { env } from "./config/env";
import { swaggerSpec } from "./config/swagger";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  if (env.NODE_ENV !== "test") {
    app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));
  }

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  app.get("/health", (_req, res) => {
    res.json({ success: true, status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/api-docs.json", (_req, res) => res.json(swaggerSpec));
  app.use(
    "/api-docs",
    (_req: Request, res: Response, next: NextFunction) => {
      // swagger-ui's inline scripts/styles don't fit under the API's default CSP
      res.removeHeader("Content-Security-Policy");
      next();
    },
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec)
  );

  app.use("/api/v1", routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
