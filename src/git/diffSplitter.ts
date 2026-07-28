const FILE_HEADER_PATTERN = /^diff --git a\/(.+?) b\/(.+)$/;

/**
 * Splits a unified diff (as produced by `git diff`) into one segment per
 * file, keyed by the file's post-change ("b/") path. Each segment keeps its
 * own "diff --git" header plus all following hunks, unchanged.
 */
export function splitDiffByFile(diffText: string): Map<string, string> {
  const result = new Map<string, string>();
  let currentFile: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (currentFile !== null) result.set(currentFile, buffer.join("\n"));
  };

  for (const line of diffText.split("\n")) {
    const headerMatch = FILE_HEADER_PATTERN.exec(line);
    if (headerMatch) {
      flush();
      currentFile = headerMatch[2];
      buffer = [line];
      continue;
    }
    buffer.push(line);
  }
  flush();

  return result;
}
