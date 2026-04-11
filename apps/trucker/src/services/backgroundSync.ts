// # Tests R-P9-02, R-P9-03
import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";
import { processQueue } from "./uploadQueue";

export const UPLOAD_TASK_NAME = "loadpilot-upload-sync";

// # Tests R-P9-02
TaskManager.defineTask(UPLOAD_TASK_NAME, async () => {
  // # Tests R-P9-03
  await processQueue();
  return BackgroundFetch.BackgroundFetchResult.NewData;
});

// # Tests R-P9-05
export async function registerBackgroundSync(): Promise<void> {
  try {
    await BackgroundFetch.registerTaskAsync(UPLOAD_TASK_NAME, {
      minimumInterval: 15 * 60,
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch (err: unknown) {
    // Task registration may fail on simulators or unsupported platforms
    const message = err instanceof Error ? err.message : String(err);
    console.warn("Background sync registration failed:", message);
  }
}
