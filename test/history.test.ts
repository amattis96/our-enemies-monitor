import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ run: vi.fn(), stat: vi.fn() }));
vi.mock("node:child_process", () => ({ execFileSync: mocks.run }));
vi.mock("node:fs", () => ({ lstatSync: mocks.stat }));
vi.mock("../src/pipeline/paths.ts", () => ({ REPO_ROOT: "/archive" }));

import { dataHistory } from "../src/site/history.ts";

const missing = () => {
  throw Object.assign(new Error("missing"), { code: "ENOENT" });
};
describe("Git history failures", () => {
  beforeEach(() => {
    mocks.run.mockReset();
    mocks.stat.mockReset();
    mocks.stat.mockImplementation(missing);
  });
  it("warns only for a proven source archive", () => {
    mocks.run.mockImplementation(() => {
      throw Object.assign(new Error(), {
        status: 128,
        stderr: "fatal: not a git repository (or any of the parent directories): .git\n",
      });
    });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(dataHistory()).toEqual([]);
    expect(warning).toHaveBeenCalledOnce();
    warning.mockRestore();
  });
  it("fails for missing Git, corrupt metadata, denied access and ambiguous errors", () => {
    for (const failure of [
      { code: "ENOENT" },
      { code: "EACCES" },
      { status: 128, stderr: "fatal: corrupt repository" },
    ]) {
      mocks.run.mockImplementation(() => {
        throw Object.assign(new Error(), failure);
      });
      expect(() => dataHistory()).toThrow("context probe failed");
    }
    mocks.stat.mockReturnValue({});
    mocks.run.mockImplementation(() => {
      throw Object.assign(new Error(), {
        status: 128,
        stderr: "fatal: not a git repository (or any of the parent directories): .git",
      });
    });
    expect(() => dataHistory()).toThrow("context probe failed");
  });
  it("fails when explicit GIT_DIR is set even without local metadata", () => {
    vi.stubEnv("GIT_DIR", "/missing/repository");
    try {
      mocks.run.mockImplementation(() => {
        throw Object.assign(new Error(), {
          status: 128,
          stderr: "fatal: not a git repository (or any of the parent directories): .git",
        });
      });
      expect(() => dataHistory()).toThrow("context probe failed");
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("fails when metadata exists only in an ancestor", () => {
    mocks.stat.mockImplementation((file: string) => {
      if (file === "/.git") return {};
      return missing();
    });
    mocks.run.mockImplementation(() => {
      throw Object.assign(new Error(), {
        status: 128,
        stderr: "fatal: not a git repository (or any of the parent directories): .git",
      });
    });
    expect(() => dataHistory()).toThrow("context probe failed");
    expect(mocks.stat).toHaveBeenCalledWith("/archive/.git");
    expect(mocks.stat).toHaveBeenCalledWith("/.git");
  });
  it("accepts a worktree git file and fails on log overflow without output leakage", () => {
    mocks.stat.mockReturnValue({});
    mocks.run.mockReturnValueOnce("true\n").mockImplementationOnce(() => {
      throw Object.assign(new Error("huge secret"), { code: "ENOBUFS" });
    });
    expect(() => dataHistory()).toThrow("Git history log failed (ENOBUFS)");
    mocks.run
      .mockReturnValueOnce("true\n")
      .mockReturnValueOnce("\x1eabc\t2026-01-01\tchange\nA\tdata/events/EXT-001.json\n");
    expect(dataHistory()[0]?.records[0]?.id).toBe("EXT-001");
  });
});
