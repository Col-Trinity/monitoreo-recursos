const fmt = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

export const log = {
  info: (msg: string) => console.log(msg),
  step: (msg: string) => console.log(`${fmt.bold}${msg}${fmt.reset}`),
  ok: (msg: string) => console.log(`${fmt.green}✓${fmt.reset} ${msg}`),
  warn: (msg: string) => console.log(`${fmt.yellow}!${fmt.reset} ${msg}`),
  err: (msg: string) => console.error(`${fmt.red}✗${fmt.reset} ${msg}`),
  dim: (msg: string) => console.log(`${fmt.dim}${msg}${fmt.reset}`),
  plan: (verb: "CREATE" | "UPDATE" | "ARCHIVE" | "SKIP", msg: string) => {
    const color =
      verb === "CREATE"
        ? fmt.green
        : verb === "UPDATE"
          ? fmt.cyan
          : verb === "ARCHIVE"
            ? fmt.yellow
            : fmt.dim;
    console.log(`  ${color}${verb.padEnd(7)}${fmt.reset} ${msg}`);
  },
};

export function parseArgs(): { cmd: string; rest: string[]; apply: boolean } {
  const argv = process.argv.slice(2);
  const apply = argv.includes("--apply");
  const rest = argv.filter((a) => a !== "--apply" && a !== "--dry-run");
  const [cmd, ...args] = rest;
  return { cmd: cmd ?? "help", rest: args, apply };
}
