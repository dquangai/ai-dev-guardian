import fs from "node:fs";
import path from "node:path";

const HOOK_CONTENT = `#!/bin/sh
# Installed by AI Dev Guardian — runs `+ "`guardian check`" + ` before allowing a push.
# See: npx guardian install-hook
exec npx guardian check
`;

/**
 * Writes .git/hooks/pre-push so every push is gated by \`guardian check\`.
 * Throws if cwd is not the root of a git working tree.
 */
export function installPrePushHook(cwd: string = process.cwd()): string {
  const gitDir = path.join(cwd, ".git");
  if (!fs.existsSync(gitDir)) {
    throw new Error(
      "Không tìm thấy .git — hãy chạy lệnh này ở thư mục gốc của một git repository."
    );
  }

  const hooksDir = path.join(gitDir, "hooks");
  fs.mkdirSync(hooksDir, { recursive: true });

  const hookPath = path.join(hooksDir, "pre-push");
  fs.writeFileSync(hookPath, HOOK_CONTENT, { mode: 0o755 });
  fs.chmodSync(hookPath, 0o755);

  return hookPath;
}
