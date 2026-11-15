/** Save generated text as a file in the browser (Blob + temporary link). */
export function downloadText(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const CSV_TYPE = "text/csv;charset=utf-8";
export const JSON_TYPE = "application/json;charset=utf-8";
