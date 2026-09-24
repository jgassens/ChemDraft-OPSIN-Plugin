import { runPluginWorker } from "@chemdraft/plugin-api";

import { opsinWorkerRegistration } from "./workerRegistration";

runPluginWorker(opsinWorkerRegistration);
