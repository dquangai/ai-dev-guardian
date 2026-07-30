import chalk from "chalk";
import type { CheckReport, Violation } from "./types";

/** Icon nhiều byte (emoji) chiếm 2 cột hiển thị trên terminal — cần biết để canh lề khung. */
const WIDE_CHARS = new Set(["⛔", "⚠", "💬"]);

function textWidth(str: string): number {
  const plain = str.replace(/\x1b\[[0-9;]*m/g, "");
  let width = 0;
  for (const ch of plain) width += WIDE_CHARS.has(ch) ? 2 : 1;
  return width;
}

function wrapText(text: string, maxWidth: number): string[] {
  const limit = Math.max(8, maxWidth);
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (textWidth(next) > limit) {
      if (cur) lines.push(cur);
      cur = textWidth(word) > limit ? word.slice(0, limit) : word;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

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

function riskIcon(risk: Violation["riskLevel"]): string {
  switch (risk) {
    case "critical":
    case "high":
      return "⛔";
    case "medium":
      return "⚠";
    default:
      return "ℹ";
  }
}

function boxWidth(): number {
  const columns = process.stdout.columns ?? 80;
  return Math.max(40, Math.min(72, columns - 4));
}

/** Vẽ khung bo góc màu (kiểu Claude Code): viền màu theo severity/verdict, nội dung canh lề đúng kể cả khi có icon 2 cột. */
function drawBox(title: string, color: (text: string) => string, lines: (string | null)[], width: number): string {
  const label = ` ${title} `;
  const dashCount = Math.max(1, width - textWidth(label) - 1);
  const top = color(`╭─${label}${"─".repeat(dashCount)}╮`);
  const bottom = color(`╰${"─".repeat(width)}╯`);
  const body = lines.map((line) => {
    if (line === null) return `${color("│")}${" ".repeat(width)}${color("│")}`;
    const pad = Math.max(0, width - textWidth(line) - 1);
    return `${color("│")} ${line}${" ".repeat(pad)}${color("│")}`;
  });
  return [top, ...body, bottom].join("\n");
}

/** Một dòng "label   giá trị" đã wrap theo bề rộng khung, các dòng tiếp theo thụt lề bằng độ rộng label. */
function fieldLines(label: string, text: string, width: number, accent?: (text: string) => string): string[] {
  const prefix = `${label} `;
  const indent = textWidth(prefix);
  const wrapped = wrapText(text, width - indent - 2);
  return wrapped.map((line, i) => {
    const content = accent ? accent(line) : line;
    return i === 0 ? `${chalk.dim(prefix)}${content}` : `${" ".repeat(indent)}${content}`;
  });
}

function renderViolationBox(v: Violation, index: number, width: number): string {
  const color = riskColor(v.riskLevel);
  const icon = riskIcon(v.riskLevel);
  const title = `${index + 1} · ${v.riskLevel.toUpperCase()}`;

  const lines: (string | null)[] = [];
  lines.push(...wrapText(`${icon} ${v.errorWhat}`, width - 2));
  lines.push(null);
  lines.push(...fieldLines("policy  ", v.policyViolated, width));
  lines.push(...fieldLines("vì sao  ", v.why, width));
  lines.push(...fieldLines("cách sửa", v.howToFix, width));
  lines.push(null);
  lines.push(
    ...(v.promptToFix
      ? fieldLines("💬 prompt", v.promptToFix, width, chalk.cyan)
      : fieldLines("💬 prompt", "(không có gợi ý)", width, chalk.dim)),
  );

  return drawBox(title, color, lines, width);
}

export function renderReport(report: CheckReport): string {
  const width = boxWidth();
  const verdictColor = report.verdict === "PASS" ? chalk.green : chalk.red;
  const badge =
    report.verdict === "PASS" ? chalk.bgGreen.black.bold(" PASS ") : chalk.bgRed.white.bold(" BLOCK ");
  const summaryText =
    report.violations.length === 0
      ? "Không phát hiện vi phạm policy nào."
      : `${report.violations.length} vi phạm được phát hiện trước khi push.`;

  const banner = drawBox("GUARDIAN CHECK", verdictColor, [`${badge} ${summaryText}`], width);

  if (report.violations.length === 0) {
    return banner;
  }

  const boxes = report.violations.map((v, i) => renderViolationBox(v, i, width));
  return [banner, ...boxes].join("\n\n");
}

export function printReport(report: CheckReport): void {
  console.log(renderReport(report));
}
