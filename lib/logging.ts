import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";

const LOG_DIRECTORY = path.join(process.cwd(), "storage", "logs");
const LOG_FILE = path.join(LOG_DIRECTORY, "generation-events.jsonl");

export async function logEvent(eventType: string, payload: Record<string, unknown>): Promise<void> {
  await mkdir(LOG_DIRECTORY, { recursive: true });

  await appendFile(
    LOG_FILE,
    `${JSON.stringify({
      eventType,
      recordedAt: new Date().toISOString(),
      payload
    })}\n`,
    "utf8"
  );
}
