import { describe, expect, it } from "vitest";
import { archivedResearch } from "../src/site/research.ts";

describe("documentary OSINT archive", () => {
  it("lists recent committed source documents separately from canonical data", () => {
    const sources = archivedResearch();
    expect(sources.some((item) => item.id === "S10" && item.kind === "incremental")).toBe(true);
    expect(sources.some((item) => item.id === "S11" && item.kind === "incremental")).toBe(true);
    expect(sources.some((item) => item.id === "T-AI-001" && item.kind === "thematic")).toBe(true);
    expect(sources.some((item) => item.id === "T-IND-001" && item.kind === "thematic")).toBe(true);
    expect(new Set(sources.map((item) => item.path)).size).toBe(sources.length);
    for (let i = 1; i < sources.length; i++) {
      const previous = sources[i - 1];
      const current = sources[i];
      if (previous && current) expect(previous.createdAt >= current.createdAt).toBe(true);
    }
    for (const item of sources) {
      expect(item.url).toContain("/blob/main/sources/");
      expect(item.title.length).toBeGreaterThan(10);
    }
  });
});
