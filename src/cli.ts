#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { getStagedDiff, getPushRangeDiff } from "./git/diff";
import { runGuardianCheck } from "./orchestrator";
import { printReport } from "./report/terminalReporter";
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
  .action(async (options: { staged?: boolean }) => {
    if (!options.staged) {
      const proceed = await confirmOnTTY(
        "Bạn có muốn chạy AI Dev Guardian để kiểm tra code trước khi push không? (Y/n): "
      );
      if (!proceed) {
        console.log("[guardian] Bỏ qua kiểm tra theo lựa chọn của bạn — cho phép push.");
        process.exitCode = 0;
        return;
      }
    }

    const diff = options.staged ? await getStagedDiff() : await getPushRangeDiff(await readStdin());
    const report = await runGuardianCheck(diff);
    printReport(report);
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
