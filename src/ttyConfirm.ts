import readline from "node:readline";

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
 * Prompts on process.stdin/stdout — but ONLY when both are already a real
 * interactive terminal. Under a git hook, stdin is always a pipe carrying
 * ref info (never a TTY), so this safely no-ops to `defaultYes` there
 * instead of trying to bypass stdin by opening a raw platform TTY device —
 * that approach (CONIN$ on Windows) crashed in the wild with
 * "EBADF: bad file descriptor, write", since CONIN$ is an input-only handle
 * and isn't reliably writable through Node's fs stream layer. Not worth the
 * risk: no custom device/stream plumbing here, just the standard library,
 * wrapped so a prompting failure can never crash the push.
 */
export async function confirmOnTTY(promptText: string, defaultYes = true): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return defaultYes;

  try {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise<string>((resolve) => rl.question(promptText, resolve));
    rl.close();
    return parseYesNoAnswer(answer, defaultYes);
  } catch {
    return defaultYes;
  }
}
