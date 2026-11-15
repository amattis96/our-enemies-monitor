import { parse, postprocess, preprocess } from "micromark";

export type ApprovalRequirements = { publication: string[]; translation: string[] };
type Review = {
  id: number;
  html_url: string;
  state: string;
  commit_id: string;
  submitted_at: string | null;
  body: string | null;
  user: { login: string; type: string };
};

/** API response is untrusted data; invalid or ambiguous responses fail closed. */
export function checkArticleReview(
  requirements: ApprovalRequirements,
  raw: unknown,
  owner: string,
  author: string,
  head: string,
): string {
  if (!owner || !author || !/^[a-f0-9]{40}$/i.test(head) || !Array.isArray(raw))
    throw new Error("Invalid PR identity, HEAD or reviews payload");
  const reviews: Review[] = raw.map((v: unknown) => {
    if (!v || typeof v !== "object") throw new Error("Malformed review");
    const r = v as Review;
    if (
      !Number.isSafeInteger(r.id) ||
      r.id <= 0 ||
      typeof r.html_url !== "string" ||
      !/^https:\/\//.test(r.html_url) ||
      !["APPROVED", "CHANGES_REQUESTED", "DISMISSED", "COMMENTED", "PENDING"].includes(r.state) ||
      typeof r.commit_id !== "string" ||
      !/^[a-f0-9]{40}$/i.test(r.commit_id) ||
      (r.body !== null && typeof r.body !== "string") ||
      !r.user ||
      typeof r.user.login !== "string" ||
      !r.user.login ||
      typeof r.user.type !== "string" ||
      (r.state !== "PENDING" &&
        (typeof r.submitted_at !== "string" || Number.isNaN(Date.parse(r.submitted_at))))
    )
      throw new Error("Malformed review");
    return r;
  });
  if (!requirements.publication.length && !requirements.translation.length)
    return "No editorial approval required.";
  if (owner.toLowerCase() === author.toLowerCase())
    throw new Error("The PR author cannot be the required maintainer reviewer");
  const decisive = reviews
    .filter(
      (r) =>
        r.user.login.toLowerCase() === owner.toLowerCase() &&
        r.user.type === "User" &&
        ["APPROVED", "CHANGES_REQUESTED", "DISMISSED"].includes(r.state),
    )
    .sort(
      (a, b) =>
        Date.parse(b.submitted_at as string) - Date.parse(a.submitted_at as string) || b.id - a.id,
    );
  const review = decisive[0];
  if (review?.state !== "APPROVED" || review.commit_id !== head)
    throw new Error("No current decisive maintainer approval on the exact HEAD");
  const body = review.body ?? "";
  const events = postprocess(
    parse()
      .document()
      .write(preprocess()(body, undefined, true)),
  );
  const stack: string[] = [];
  const topLevelLines: string[] = [];
  for (const [kind, token] of events) {
    if (kind === "enter") {
      if (
        token.type === "data" &&
        stack.length === 2 &&
        stack[0] === "content" &&
        stack[1] === "paragraph"
      ) {
        const start = token.start.offset;
        const end = token.end.offset;
        if (
          (start === 0 || body[start - 1] === "\n") &&
          (end === body.length || body[end] === "\n" || body.slice(end, end + 2) === "\r\n")
        )
          topLevelLines.push(body.slice(start, end));
      }
      stack.push(token.type);
    } else {
      stack.pop();
    }
  }
  const markers = (name: string): Set<string> => {
    const lines = topLevelLines.filter((line) => new RegExp(`^${name}:`, "i").test(line));
    if (lines.length !== 1) return new Set();
    const match = new RegExp(
      `^${name}:\\s*(ART-[A-Z0-9-]+(?:\\s*,\\s*ART-[A-Z0-9-]+)*)\\s*$`,
      "i",
    ).exec(lines[0] ?? "");
    return new Set(match ? (match[1] ?? "").split(/\s*,\s*/) : []);
  };
  for (const [name, ids] of [
    ["Publication-Approval", requirements.publication],
    ["Translation-Approval", requirements.translation],
  ] as const) {
    if (!ids.length) continue;
    const covered = markers(name);
    const missing = ids.filter((id) => !covered.has(id));
    if (missing.length) throw new Error(`${name} missing or malformed for ${missing.join(", ")}`);
  }
  return `Review ${review.id} ${review.html_url} by ${review.user.login} on ${head}; publication: ${requirements.publication.join(", ") || "none"}; translation: ${requirements.translation.join(", ") || "none"}`;
}
