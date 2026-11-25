import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { checkI18nBudget, DEFAULT_I18N_BUDGET, type LanguageBudgetUsage } from "../i18n/budget.ts";
import { EUROPEAN_TARGET_LANGUAGES } from "../i18n/multilingual.ts";
import { REPO_ROOT } from "../pipeline/paths.ts";
import { loadReadModel } from "../site/read-model.ts";

function dirSizeBytes(dir: string): number {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    total += st.isDirectory() ? dirSizeBytes(full) : st.size;
  }
  return total;
}

function run(): void {
  const { values } = parseArgs({
    options: {
      json: { type: "boolean", default: false },
    },
  });

  const model = loadReadModel();
  const basePages =
    model.events.length +
    model.dataset.entities.length +
    model.dataset.hypotheses.length +
    model.dataset.sources.length +
    30;

  const pagefindDir = path.join(REPO_ROOT, "web/dist/pagefind");
  const measuredIndexBytes = dirSizeBytes(pagefindDir);

  const activeLanguages: string[] = ["it", "en"];
  const usages: LanguageBudgetUsage[] = activeLanguages.map((lang) => ({
    lang,
    pages: basePages,
    indexBytes:
      measuredIndexBytes > 0
        ? Math.ceil(measuredIndexBytes / activeLanguages.length)
        : basePages * 512,
    estimatedBuildSeconds: Number((basePages * 0.015).toFixed(2)),
  }));

  const result = checkI18nBudget(usages, DEFAULT_I18N_BUDGET);

  if (values.json) {
    console.log(
      JSON.stringify(
        {
          ...result,
          configured_target_languages: EUROPEAN_TARGET_LANGUAGES,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(
      `i18n build budget: ${result.ok ? "OK" : "FAILED"} (${result.totalPages} total pages, ~${result.totalEstimatedBuildSeconds.toFixed(1)}s est.)`,
    );
    for (const v of result.violations) {
      console.error(`  - ${v}`);
    }
  }

  if (!result.ok) {
    process.exitCode = 1;
  }
}

run();
