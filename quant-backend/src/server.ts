import { createApp } from "./app";
import { connectDB } from "./config/db";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { ensureDefaultAdmin } from "./services/adminAuthService";

async function main() {
  await connectDB();
  await ensureDefaultAdmin();

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`Quant API listening on port ${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}, shutting down`);
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error("Fatal startup error", err);
  process.exit(1);
});
