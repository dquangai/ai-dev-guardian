import fs from "node:fs";
import readline from "node:readline";

// Under a git hook, process.stdin is already consumed by git piping ref info
// into it — reading a real interactive answer requires bypassing stdin and
// talking to the controlling terminal device directly.
const TTY_DEVICE_PATH = process.platform === "win32" ? "\\\\.\\CONIN$" : "/dev/tty";

// A TTY device can exist (open succeeds) with nobody actually there to answer
// it — e.g. some CI runners still allocate a pty. Bound the wait so that case
// fails open instead of hanging the push forever.
const PROMPT_TIMEOUT_MS = 20_000;

/**
 * "" (Enter) follows defaultYes; explicit "n"/"no" declines; anything else
 * (including garbage input) proceeds — a security gate should fail open
 * toward running the check on ambiguous input, not toward skipping it.
 */
export function parseYesNoAnswer(answer: string, defaultYes: boolean): boolean {
  const normalized = answer.trim().toLowerCase();
  if (normalized === "") return defaultYes;
  return normalized !== "n" && normalized !== "no";
}

/**
 * Prompts on the controlling terminal directly (not process.stdin — see
 * above). Falls back to `defaultYes` without prompting if no TTY is
 * reachable (CI, another non-interactive invocation, etc.) so an automated
 * push keeps being gated by Guardian instead of hanging forever waiting for
 * a human who isn't there.
 */
export async function confirmOnTTY(promptText: string, defaultYes = true): Promise<boolean> {
  // Fast path: no interactive terminal attached at all (CI, output piped to a
  // file, ...) — don't even attempt to open the TTY device.
  if (!process.stdout.isTTY) return defaultYes;

  let ttyFd: number;
  try {
    ttyFd = fs.openSync(TTY_DEVICE_PATH, "r+");
  } catch {
    return defaultYes;
  }

  const input = fs.createReadStream("", { fd: ttyFd, autoClose: false });
  const output = fs.createWriteStream("", { fd: ttyFd, autoClose: false });
  const rl = readline.createInterface({ input, output, terminal: true });

  try {
    const answer = await Promise.race([
      new Promise<string>((resolve) => rl.question(promptText, resolve)),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), PROMPT_TIMEOUT_MS).unref()),
    ]);

    if (answer === null) {
      output.write("\n[guardian] Không có phản hồi, tiếp tục chạy kiểm tra mặc định.\n");
      return defaultYes;
    }
    return parseYesNoAnswer(answer, defaultYes);
  } finally {
    rl.close();
    input.destroy();
    output.destroy();
    try {
      fs.closeSync(ttyFd);
    } catch {
      // already closed by stream teardown
    }
  }
}
