const DEFAULT_ROW_LIMIT = 5000;
const DEFAULT_TIME_BUDGET_MS = 8;

export async function processRowsInChunks(rows, processRow, {
  signal,
  onProgress,
  rowLimit = DEFAULT_ROW_LIMIT,
  timeBudgetMs = DEFAULT_TIME_BUDGET_MS,
  now = () => performance.now(),
  yieldControl = () => new Promise((resolve) => setTimeout(resolve, 0)),
} = {}) {
  const output = [];
  let index = 0;

  while (index < rows.length) {
    throwIfAborted(signal);
    const startedAt = now();
    let processed = 0;
    do {
      processRow(rows[index], index, output);
      index += 1;
      processed += 1;
    } while (
      index < rows.length
      && processed < rowLimit
      && now() - startedAt < timeBudgetMs
    );

    onProgress?.(rows.length ? index / rows.length : 1);
    if (index < rows.length) await yieldControl();
  }

  onProgress?.(1);
  return output;
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  const error = new Error("Operation cancelled");
  error.name = "AbortError";
  throw error;
}
