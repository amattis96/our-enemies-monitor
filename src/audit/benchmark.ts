import { z } from "zod";

/**
 * B12 question benchmark (FABLE_D §9.3, A13). The case file is versioned under
 * docs/audit/baseline/; the scorer is deterministic text matching, a first
 * filter for a human grader, not a judgement of factual accuracy.
 */

const Phrase = z.string().min(1);

export const BenchmarkCaseSchema = z.strictObject({
  id: z.string().regex(/^B\d{1,2}$/),
  topic: z.string().min(1),
  question: z.strictObject({ it: z.string().min(1), en: z.string().min(1) }),
  expected_answer: z.string().min(1),
  supporting_ids: z.array(z.string().min(1)),
  /** Every group must be matched by at least one of its alternatives. */
  required: z.array(z.array(Phrase).min(1)),
  /** Any match is an error typical of the case. */
  forbidden: z.array(Phrase),
  typical_error: z.string().min(1),
});

export const BenchmarkCasesSchema = z.strictObject({
  case_set: z.literal("fable-d-b1-b20"),
  version: z.number().int().positive(),
  as_of_commit: z.string().min(7),
  notes: z.array(z.string()),
  cases: z.array(BenchmarkCaseSchema).min(1),
});

export const BenchmarkAnswersSchema = z.strictObject({
  case_set: z.literal("fable-d-b1-b20"),
  case_set_version: z.number().int().positive(),
  model: z.string(),
  run_date: z.string(),
  data_commit: z.string(),
  access: z.string(),
  answers: z.array(
    z.strictObject({
      id: z.string(),
      text: z.string(),
      requests: z.number().int().nonnegative().nullable(),
      context_chars: z.number().int().nonnegative().nullable(),
    }),
  ),
});

export type BenchmarkCases = z.infer<typeof BenchmarkCasesSchema>;
export type BenchmarkAnswers = z.infer<typeof BenchmarkAnswersSchema>;

/** Structured record IDs; free-form entity IDs are not checked for invention. */
const STRUCTURED_ID =
  /(?<![A-Za-z0-9-])(TL-\d{4}|EXT-\d{3}|G-\d{4}|H\d{2,3}|S\d{2,3}|F\d{2}|P\d{2}|X-\d{3}|WEB-EXT-\d{3})(?![A-Za-z0-9-])/g;

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const NEGATION = /(?<![a-z])(non|not|no|mai|never|ne|nor)(?![a-z])|n't(?![a-z])/;

/** Whole-phrase match not preceded (within 20 chars) by a negation. */
export function assertsPhrase(folded: string, phrase: string): boolean {
  const target = normalize(phrase);
  let from = 0;
  for (;;) {
    const at = folded.indexOf(target, from);
    if (at < 0) return false;
    const before = folded[at - 1] ?? " ";
    const after = folded[at + target.length] ?? " ";
    const bounded = !/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after);
    if (bounded && !NEGATION.test(folded.slice(Math.max(0, at - 20), at))) return true;
    from = at + 1;
  }
}

const mentions = (text: string, id: string) =>
  new RegExp(`(?<![A-Za-z0-9-])${id.replace(/[-]/g, "\\-")}(?![A-Za-z0-9-])`).test(text);

export function scoreAnswer(
  testCase: BenchmarkCases["cases"][number],
  text: string,
  knownIds: ReadonlySet<string>,
) {
  const folded = normalize(text);
  const cited = testCase.supporting_ids.filter((id) => mentions(text, id));
  const missingGroups = testCase.required.filter(
    (group) => !group.some((phrase) => folded.includes(normalize(phrase))),
  );
  const forbiddenHits = testCase.forbidden.filter((phrase) => assertsPhrase(folded, phrase));
  const asked = `${testCase.question.it} ${testCase.question.en}`;
  const invented = [...new Set([...text.matchAll(STRUCTURED_ID)].map((m) => m[1] ?? ""))]
    .filter((id) => id && !knownIds.has(id) && !mentions(asked, id))
    .sort();
  return {
    id: testCase.id,
    completeness:
      testCase.supporting_ids.length === 0 ? 1 : cited.length / testCase.supporting_ids.length,
    cited_ids: cited,
    missing_required: missingGroups.map((group) => group.join(" | ")),
    forbidden_hits: forbiddenHits,
    invented_ids: invented,
    pass: missingGroups.length === 0 && forbiddenHits.length === 0 && invented.length === 0,
  };
}

export function scoreAnswers(
  casesInput: unknown,
  answersInput: unknown,
  knownIds: ReadonlySet<string>,
) {
  const cases = BenchmarkCasesSchema.parse(casesInput);
  const answers = BenchmarkAnswersSchema.parse(answersInput);
  if (answers.case_set_version !== cases.version) {
    throw new Error(
      `answers target case set v${answers.case_set_version}, cases are v${cases.version}`,
    );
  }
  const byId = new Map(answers.answers.map((a) => [a.id, a]));
  const rows = cases.cases.map((testCase) => {
    const answer = byId.get(testCase.id);
    if (!answer || answer.text.trim() === "")
      return { id: testCase.id, status: "missing" as const };
    return {
      ...scoreAnswer(testCase, answer.text, knownIds),
      status: "answered" as const,
      requests: answer.requests,
      context_chars: answer.context_chars,
    };
  });
  const answered = rows.filter((r) => r.status === "answered");
  const mean = (values: number[]) =>
    values.length === 0
      ? null
      : Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 1000) / 1000;
  return {
    case_set: cases.case_set,
    case_set_version: cases.version,
    model: answers.model,
    run_date: answers.run_date,
    data_commit: answers.data_commit,
    access: answers.access,
    summary: {
      cases: cases.cases.length,
      answered: answered.length,
      passed: answered.filter((r) => r.pass).length,
      forbidden_hits: answered.reduce((s, r) => s + r.forbidden_hits.length, 0),
      invented_ids: answered.reduce((s, r) => s + r.invented_ids.length, 0),
      mean_completeness: mean(answered.map((r) => r.completeness)),
      mean_requests: mean(answered.flatMap((r) => (r.requests === null ? [] : [r.requests]))),
      mean_context_chars: mean(
        answered.flatMap((r) => (r.context_chars === null ? [] : [r.context_chars])),
      ),
    },
    rows,
  };
}
