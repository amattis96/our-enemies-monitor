/** Site-relative URL honoring the configured base path. */
export function href(path = ""): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const clean = path.replace(/^\//, "");
  return `${base}/${clean}`;
}

export function nodeHref(id: string, kind: string | undefined): string {
  return kind === "event" ? href(`events/${id}/`) : href(`entities/${id}/`);
}
