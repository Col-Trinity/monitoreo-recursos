import { readFileSync } from "fs";

const PIDS_FILE = "/tmp/playwright-pids.json";

export default async function globalTeardown() {
  try {
    const pids: number[] = JSON.parse(readFileSync(PIDS_FILE, "utf8"));
    for (const pid of pids) {
      try {
        process.kill(-pid, "SIGTERM"); // -pid mata el proceso group completo
      } catch {
        // ya terminó, ignorar
      }
    }
  } catch {
    // archivo no existe, ignorar
  }
}
