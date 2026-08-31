import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import routes from "./routes";
import webhookRoutes from "./routes/webhookRoutes";
import viewRoutes from "./routes/viewRoutes";
import registerRoutes from "./routes/registerRoutes";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler";
import { env } from "./config/env";
import { swaggerSpec } from "./config/swagger";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(
    express.json({
      limit: "1mb",
      // Stashed for verifying Meta's X-Hub-Signature-256 on /webhook — see webhookController.
      verify: (req, _res, buf) => {
        (req as Request).rawBody = buf;
      },
    })
  );
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
  app.use("/webhook", webhookRoutes);
  app.use(
    "/view",
    (_req: Request, res: Response, next: NextFunction) => {
      // the Google Docs viewer iframe doesn't fit under the API's default CSP
      res.removeHeader("Content-Security-Policy");
      next();
    },
    viewRoutes
  );
  app.use(
    "/register",
    (_req: Request, res: Response, next: NextFunction) => {
      // the registration page's inline <style> doesn't fit under the API's default CSP
      res.removeHeader("Content-Security-Policy");
      next();
    },
    registerRoutes
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
