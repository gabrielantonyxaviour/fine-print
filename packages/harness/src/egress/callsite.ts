import * as nodePath from 'node:path';

/**
 * Returns the first stack frame whose file is inside targetRoot
 * and not inside node_modules or the harness package itself.
 * Returns `relative/path.ts:line` or undefined if none found.
 */
export function callSiteFrom(stack: string | undefined, targetRoot: string): string | undefined {
  if (!stack) return undefined;

  const absRoot = nodePath.resolve(targetRoot);
  const lines = stack.split('\n');

  for (const line of lines) {
    // Node.js stack frames look like:
    //   at funcName (file:///path/to/file.ts:10:5)
    //   at file:///path/to/file.ts:10:5
    const match = line.match(/\(?(file:\/\/\/[^):\s]+):(\d+):\d+\)?/) ??
                  line.match(/\(?(\/[^):\s]+\.(?:ts|js|mjs|cjs)):(\d+):\d+\)?/);
    if (!match) continue;

    const [, rawFile, lineNo] = match;
    if (!rawFile || !lineNo) continue;

    const filePath = rawFile.startsWith('file:///') ? rawFile.slice(7) : rawFile;
    const absFile = nodePath.resolve(filePath);

    // Must be inside targetRoot
    if (!absFile.startsWith(absRoot + nodePath.sep) && absFile !== absRoot) continue;

    // Must not be in node_modules
    if (absFile.includes(`${nodePath.sep}node_modules${nodePath.sep}`)) continue;

    // Must not be in the harness package itself
    // The harness package lives at packages/harness
    const harnessRoot = nodePath.resolve(new URL('../..', import.meta.url).pathname);
    if (absFile.startsWith(harnessRoot + nodePath.sep) && !absFile.startsWith(absRoot + nodePath.sep)) continue;

    const relative = nodePath.relative(absRoot, absFile);
    return `${relative}:${lineNo}`;
  }

  return undefined;
}
