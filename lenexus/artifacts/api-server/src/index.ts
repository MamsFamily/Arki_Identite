import app from "./app";
import { logger } from "./lib/logger";
import { initDinos } from "./lib/dino-catalogue";
import { initGuides } from "./lib/guide-store";
import { startShopSync } from "./lib/shop-discord";
import { database } from "./lib/tribe-store";

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

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  // An exported workspace may have no real tribe database. Do not seed another
  // product's PostgreSQL or start Discord synchronization in that state.
  try {
    database();
  } catch {
    logger.warn("Existing tribe SQLite unavailable; background synchronization disabled. Configure SQLITE_PATH to the existing database and restart.");
    return;
  }
  startShopSync();
  void initGuides()
    .then(() => logger.info("Community guides initialized"))
    .catch(err => logger.error({ errorType: err instanceof Error ? err.name : "unknown" }, "Community guides initialization failed; requests will retry"));
  // Import missing catalogue entries on every new deployed instance, including
  // before the first signed-in visit. This seeds data only, never changes schema.
  void initDinos()
    .then(() => logger.info("Dinosaur catalogue initialized"))
    .catch(err => logger.error({ err }, "Dinosaur catalogue initialization failed; signed-in catalogue requests will retry"));
});
