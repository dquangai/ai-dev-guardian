import { parse as parseAstGrep } from "@ast-grep/napi";
import { astGrepLangFor, detectLanguage } from "./fileContext";

// Whole quoted literal (with quotes/backticks) — not "string_fragment", which
// is the inner content only and is nested inside these, so wrapping it too
// would double-tag the same text.
const ANNOTATED_KINDS = ["comment", "string", "template_string"];
apikey
interface AnnotationTarget {
  tag: "comment" | "string";
  start: number;
  end: number;
}

/**
 * Wraps every comment and string-literal node in `<comment>`/`<string>` tags
 * before the source is shown to the LLM — so the model can structurally tell
 * "this is prose/data" from "this is executing code" instead of guessing
 * from context. Root-cause fix for a reproducible failure mode: the model
 * quoting a real comment or string (passes evidence-grounding, since the
 * text is real) while misreading its *meaning* — e.g. treating the English
 * word "any" inside a comment sentence as the TypeScript `any` type.
 *
 * TS/JS/JSX/TSX only (ast-grep's built-in languages) — Python/C/Go and any
 * parse failure fall back to the original, unannotated source. Fail-safe:
 * never throws, this is a best-effort prompt-quality enrichment.
 */
export function annotateForLLM(file: string, sourceCode: string): string {
  if (detectLanguage(file) !== "ts") return sourceCode;

  try {
    const root = parseAstGrep(astGrepLangFor(file), sourceCode).root();

    const targets: AnnotationTarget[] = [];
    for (const kind of ANNOTATED_KINDS) {
      for (const node of root.findAll({ rule: { kind } })) {
        const range = node.range();
        targets.push({
          tag: kind === "comment" ? "comment" : "string",
          start: range.start.index,
          end: range.end.index,
        });
      }
    }

    // Insert from the end of the file backwards so earlier offsets stay valid
    // as later (higher-offset) tags are spliced in.
    targets.sort((a, b) => b.start - a.start);

    let result = sourceCode;
    for (const { tag, start, end } of targets) {
      result = `${result.slice(0, end)}</${tag}>${result.slice(end)}`;
      result = `${result.slice(0, start)}<${tag}>${result.slice(start)}`;
    }
    return result;
  } catch {
    return sourceCode;
  }
}
