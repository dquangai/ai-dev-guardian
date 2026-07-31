#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { getStagedDiff, getPushRangeDiff, getPullRequestDiff } from "./git/diff";
import { runGuardianCheck } from "./orchestrator";
import { printReport } from "./report/terminalReporter";
import { renderMarkdownReport } from "./report/markdownReporter";
import { readGitHubContext } from "./ci/githubContext";
import { postOrUpdateComment } from "./ci/githubComment";
import { installPrePushHook } from "./hooks/installHook";
import { confirmOnTTY } from "./ttyConfirm";
// Test tính năng cache
function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

/** GITHUB_BASE_REF ("main") — set by Actions only on the `pull_request` event; needs an `origin/` prefix to be a valid ref in the CI checkout. */
function resolveCiBaseRef(): string {
  const base = process.env.GITHUB_BASE_REF;
  if (!base) {
    throw new Error("Thiếu GITHUB_BASE_REF — --ci chỉ dùng được trong job được trigger bởi event pull_request.");
  }
  return `origin/${base}`;
}

const program = new Command();

program
  .name("guardian")
  .description("AI Dev Guardian — kiểm soát tuân thủ code trước khi push/merge vào codebase")
  .version("0.1.0");

program
  .command("check")
  .description(
    "Kiểm tra diff so với Project Policy. Mặc định đọc ref info từ stdin theo chuẩn " +
    "pre-push hook của Git; dùng --staged để kiểm tra tay các thay đổi đã staged trước khi commit."
  )
  .option("--staged", "Kiểm tra diff của các thay đổi đã staged (index vs HEAD) thay vì đọc stdin")
  .option(
    "--ci",
    "Chạy trong GitHub Actions: diff PR (origin/<base>...HEAD) và post/update kết quả làm comment trên PR"
  )
  .action(async (options: { staged?: boolean; ci?: boolean }) => {
    // Validate CI wiring (GITHUB_TOKEN/GITHUB_REPOSITORY/GITHUB_REF) before
    // spending time/tokens on the check — a broken workflow should fail fast.
    const ciContext = options.ci ? readGitHubContext() : undefined;

    if (!options.staged && !options.ci) {
      const proceed = await confirmOnTTY(
        "Bạn có muốn chạy AI Dev Guardian để kiểm tra code trước khi push không? (Y/n): "
      );
      if (!proceed) {
        console.log("[guardian] Bỏ qua kiểm tra theo lựa chọn của bạn — cho phép push.");
        process.exitCode = 0;
        return;
      }
    }

    const diff = options.ci
      ? await getPullRequestDiff(resolveCiBaseRef())
      : options.staged
        ? await getStagedDiff()
        : await getPushRangeDiff(await readStdin());

    const report = await runGuardianCheck(diff);
    printReport(report);

    if (ciContext) {
      await postOrUpdateComment(ciContext, renderMarkdownReport(report));
    }

    process.exitCode = report.verdict === "BLOCK" ? 1 : 0;
  });

program
  .command("install-hook")
  .description("Cài đặt git pre-push hook để tự động chạy `guardian check` trước mỗi lần push")
  .action(() => {
    try {
      const hookPath = installPrePushHook();
      console.log(`[guardian] Đã cài pre-push hook tại ${hookPath}`);
    } catch (error) {
      console.error(`[guardian] ${error instanceof Error ? error.message : error}`);
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv).catch((error) => {
  console.error("[guardian] Lỗi không mong muốn:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
