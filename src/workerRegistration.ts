import { opsinPluginManifest } from "./manifest";
import { createOpsinCommandHandlers } from "./register";

/** The pure worker wiring; kept separate so it can be verified without starting a Worker runtime. */
export const opsinWorkerRegistration = {
  manifest: opsinPluginManifest,
  commandHandlers: createOpsinCommandHandlers()
};
