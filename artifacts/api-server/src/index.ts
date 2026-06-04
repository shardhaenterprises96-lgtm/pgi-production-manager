import app from "./app";
import { ensureDatabaseReady } from "./lib/bootstrap";
import { logger } from "./lib/logger";
import { startSubscriptionScheduler } from "./lib/subscription-scheduler";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start(): Promise<void> {
  await ensureDatabaseReady();

  startSubscriptionScheduler();

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

start().catch((err) => {
  logger.error({ err }, "Fatal error during server startup");
  process.exit(1);
});
