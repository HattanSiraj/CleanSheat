import Papa from "papaparse";

export function parseCsvInChunks(source, {
  download = false,
  onProgress,
} = {}) {
  return new Promise((resolve, reject) => {
    const rows = [];
    const errors = [];

    Papa.parse(source, {
      download,
      header: true,
      skipEmptyLines: true,
      chunk(results) {
        for (const row of results.data) rows.push(row);
        for (const error of results.errors) errors.push(error);
        onProgress?.({
          rowCount: rows.length,
          cursor: results.meta.cursor ?? 0,
          progress: getProgress(source, results.meta.cursor),
        });
      },
      complete() {
        resolve({ data: rows, errors });
      },
      error(error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    });
  });
}

function getProgress(source, cursor = 0) {
  const size = typeof source === "object" ? Number(source?.size) : 0;
  return size > 0 ? Math.min(1, cursor / size) : null;
}
