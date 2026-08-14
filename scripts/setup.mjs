#!/usr/bin/env node
// Onboarding cho dev mới clone repo này: cài dependency, build CLI + dashboard,
// khai báo API key vào .env, `npm link` để lệnh `guardian` global trỏ vào dist/
// của chính repo này, rồi cài pre-push hook. Idempotent — chạy lại an toàn.
//
// Không phải cho team KHÁC muốn áp dụng ai-dev-guardian vào project của họ —
// trường hợp đó dùng `npm install -g ai-dev-guardian` (bản đã publish), xem
// README.md#install. Script này chỉ dành cho người build/dev trên chính repo
// ai-dev-guardian.

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import chalk from "chalk";

// fileURLToPath, not import.meta.dirname — package.json declares "engines": {"node": ">=18"}
// and import.meta.dirname only exists from Node 20.11/21.2+.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function step(n, title) {
  console.log("");
  console.log(chalk.bold.cyan(`[${n}/6] ${title}`));
}

function run(cmd, options = {}) {
  console.log(chalk.gray(`  $ ${cmd}`));
  execSync(cmd, { cwd: ROOT, stdio: "inherit", ...options });
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer.trim());
  }));
}

async function ensureEnvFile() {
  const envPath = path.join(ROOT, ".env");
  const examplePath = path.join(ROOT, ".env.example");

  if (!fs.existsSync(envPath)) {
    fs.copyFileSync(examplePath, envPath);
    console.log(chalk.green("  Đã tạo .env từ .env.example."));
  }

  const envContent = fs.readFileSync(envPath, "utf-8");
  const hasAnthropic = /^ANTHROPIC_API_KEY=.+/m.test(envContent);
  const hasOpenAI = /^OPENAI_API_KEY=.+/m.test(envContent);

  if (hasAnthropic || hasOpenAI) {
    console.log(chalk.green("  Đã có API key trong .env — bỏ qua bước hỏi."));
    return;
  }

  if (!process.stdin.isTTY) {
    console.log(
      chalk.yellow(
        "  Không phát hiện ANTHROPIC_API_KEY/OPENAI_API_KEY, và đang chạy non-interactive " +
          "(không có TTY) — bỏ qua, tự điền tay vào .env sau. LLM Policy Check sẽ tự bỏ qua " +
          "cho tới khi có key."
      )
    );
    return;
  }

  console.log(
    chalk.yellow(
      "  Chưa có ANTHROPIC_API_KEY hoặc OPENAI_API_KEY trong .env — cần ít nhất 1 key để " +
        "LLM Policy Check hoạt động (thiếu vẫn chạy được 3 check còn lại: Secret Scan, " +
        "Architecture Check, Semgrep)."
    )
  );
  const key = await ask("  Dán Anthropic API key (bỏ trống để bỏ qua, tự điền sau): ");
  if (!key) {
    console.log(chalk.gray("  Bỏ qua — nhớ tự điền ANTHROPIC_API_KEY hoặc OPENAI_API_KEY vào .env sau."));
    return;
  }
  const updated = envContent.replace(/^ANTHROPIC_API_KEY=.*$/m, `ANTHROPIC_API_KEY=${key}`);
  fs.writeFileSync(envPath, updated, "utf-8");
  console.log(chalk.green("  Đã ghi ANTHROPIC_API_KEY vào .env."));
}

async function main() {
  console.log(chalk.bold("AI Dev Guardian — Setup dev environment cho repo này\n"));

  if (!fs.existsSync(path.join(ROOT, ".git"))) {
    console.error(chalk.red("Không tìm thấy .git — chạy script này ở thư mục gốc repo ai-dev-guardian."));
    process.exitCode = 1;
    return;
  }

  step(1, "Cài dependency (root + web)");
  run("npm install");
  run("npm run web:install");

  step(2, "Build CLI (dist/) + Web Dashboard (web/dist/)");
  run("npm run build:all");

  step(3, "Cấu hình .env (API key LLM)");
  await ensureEnvFile();

  step(4, "npm link — expose lệnh `guardian` global, trỏ vào dist/ của repo này");
  try {
    run("npm link");
  } catch (error) {
    console.log(
      chalk.yellow(
        "  npm link thất bại (thường do quyền ghi thư mục global npm) — không chặn setup, " +
          "nhưng lệnh `guardian` sẽ KHÔNG chạy được cho tới khi bạn tự chạy lại `npm link` " +
          "(có thể cần sudo, hoặc dùng nvm để tránh cần sudo)."
      )
    );
  }

  step(5, "Cài git pre-push hook cho repo này");
  try {
    run("node dist/cli.js install-hook");
  } catch (error) {
    console.log(chalk.yellow(`  Cài hook thất bại: ${error instanceof Error ? error.message : error}`));
  }

  step(6, "Verify — chạy thử guardian check trên staged changes hiện tại");
  try {
    run("node dist/cli.js check --staged");
  } catch {
    // check --staged thoát mã 1 khi verdict BLOCK — không phải lỗi setup, chỉ log kết quả thật.
    console.log(chalk.gray("  (exit code khác 0 ở đây là do có vi phạm thật trong staged changes, không phải lỗi setup)"));
  }

  console.log("");
  console.log(chalk.bold.green("Setup xong."));
  console.log(
    chalk.gray(
      "  Từ giờ mỗi `git push` sẽ tự hỏi và chạy `guardian check`. Dùng `guardian dashboard` để mở " +
        "giao diện quản lý policy/audit, hoặc `guardian check --staged` để kiểm tra tay bất cứ lúc nào."
    )
  );
}

main().catch((error) => {
  console.error(chalk.red(`\nSetup dừng do lỗi: ${error instanceof Error ? error.message : error}`));
  process.exitCode = 1;
});
