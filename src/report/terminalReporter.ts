import chalk from "chalk";
import type { CheckReport, Violation } from "./types";

function riskColor(risk: Violation["riskLevel"]): (text: string) => string {
  switch (risk) {
    case "critical":
    case "high":
      return chalk.red;
    case "medium":
      return chalk.yellow;
    default:
      return chalk.gray;
  }
}

function renderViolation(v: Violation, index: number): string {
  const color = riskColor(v.riskLevel);
  const lines = [
    chalk.bold(`${index + 1}. ${v.errorWhat}`),
    `   ${chalk.dim("Vi phạm policy nào:")} ${v.policyViolated}`,
    `   ${chalk.dim("Mức độ rủi ro:")} ${color(v.riskLevel.toUpperCase())}`,
    `   ${chalk.dim("Tại sao sai:")} ${v.why}`,
    `   ${chalk.dim("Cách sửa:")} ${v.howToFix}`,
    `   ${chalk.dim("Tự động tạo bản sửa:")} ${v.autoFix ?? chalk.dim("chưa hỗ trợ trong MVP")}`,
  ];
  return lines.join("\n");
}

export function renderReport(report: CheckReport): string {
  const banner =
    report.verdict === "PASS"
      ? chalk.bgGreen.black.bold(" PASS ")
      : chalk.bgRed.white.bold(" BLOCK ");

  if (report.violations.length === 0) {
    return `${banner}  Không phát hiện vi phạm policy nào.`;
  }

  const summary = `${banner}  ${report.violations.length} vi phạm được phát hiện:\n`;
  const body = report.violations.map(renderViolation).join("\n\n");
  return `${summary}\n${body}`;
}

export function printReport(report: CheckReport): void {
  console.log(renderReport(report));
}
