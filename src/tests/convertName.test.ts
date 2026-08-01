import { describe, expect, it, vi } from "vitest";
import type { PluginCommandContext } from "@chemdraft/plugin-api";

import { convertName } from "../application/convertName";
import { MAX_NAME_LENGTH, validateName } from "../domain/contracts";

/** A context carrying only what this plugin uses: the host's chemistry capability. */
function contextWith(nameToStructure?: unknown): PluginCommandContext {
  return {
    plugin: { id: "org.test", name: "t", version: "0", permissions: [] },
    documents: {} as never,
    ...(nameToStructure === undefined ? {} : { chemistry: { nameToStructure } as never }),
    hasPermission: () => true,
    requirePermission: () => undefined
  } as unknown as PluginCommandContext;
}

const engine = { id: "opsin", version: "2.9.0" };

describe("validateName", () => {
  it("refuses only what cannot usefully be sent", () => {
    expect(validateName("")).toMatchObject({ ok: false });
    expect(validateName("   ")).toMatchObject({ ok: false });
    expect(validateName("a".repeat(MAX_NAME_LENGTH + 1))).toMatchObject({ ok: false });
  });

  it("does not try to judge whether a name is good nomenclature", () => {
    // The line this plugin must not cross. Deciding what parses is OPSIN's job, and a local
    // plausibility check would reject names the engine handles — including the punctuated,
    // non-ASCII ones that are ordinary in systematic nomenclature.
    expect(validateName("  benzene ")).toEqual({ ok: true, name: "benzene" });
    expect(validateName("(2R,3S)-2,3-dihydroxybutanedioic acid")).toMatchObject({ ok: true });
    expect(validateName("β-D-glucopyranose")).toMatchObject({ ok: true });
    expect(validateName("N,N'-dimethylurea")).toMatchObject({ ok: true });
    // Even obvious nonsense goes to the engine, so the reason a user sees is the parser's.
    expect(validateName("xyzzy-not-a-name")).toMatchObject({ ok: true });
  });
});

describe("convertName", () => {
  it("returns the structure the host parsed", async () => {
    const nameToStructure = vi.fn(async () => ({
      available: true,
      parsed: true,
      smiles: "C1=CC=CC=C1",
      engine
    }));
    const outcome = await convertName(contextWith(nameToStructure), "  benzene  ");

    expect(nameToStructure).toHaveBeenCalledWith({ name: "benzene" });
    expect(outcome).toEqual({ kind: "converted", name: "benzene", smiles: "C1=CC=CC=C1", engine });
  });

  it("keeps 'the engine said no' apart from 'there is no engine'", async () => {
    // The distinction the whole outcome type exists for. A user told "could not convert" for a name
    // typed into a build with no parser will retype that name forever.
    const refused = await convertName(
      contextWith(async () => ({ available: true, parsed: false, reason: "xyzzy is unparsable", engine })),
      "xyzzy"
    );
    expect(refused).toEqual({ kind: "not-parsed", name: "xyzzy", reason: "xyzzy is unparsable", engine });

    const missing = await convertName(
      contextWith(async () => ({ available: false, reason: "no runtime in this build" })),
      "benzene"
    );
    expect(missing).toEqual({
      kind: "engine-unavailable",
      name: "benzene",
      reason: "no runtime in this build"
    });
  });

  it("passes the engine's own reason through unchanged", async () => {
    // OPSIN names the fragment it choked on. Rewording it into something friendlier would throw away
    // the only part a chemist can act on.
    const reason =
      "2-notanacid is unparsable due to the following being uninterpretable: notanacid";
    const outcome = await convertName(
      contextWith(async () => ({ available: true, parsed: false, reason, engine })),
      "2-notanacid"
    );
    expect(outcome).toMatchObject({ kind: "not-parsed", reason });
  });

  it("declines rather than throwing when the host predates the capability", async () => {
    // We declare ^0.1.1 so this should be unreachable, but an install path that bypassed the version
    // gate must not crash with "undefined is not a function".
    const outcome = await convertName(contextWith(undefined), "benzene");
    expect(outcome.kind).toBe("engine-unavailable");
  });

  it("refuses an empty name without asking the host", async () => {
    const nameToStructure = vi.fn();
    const outcome = await convertName(contextWith(nameToStructure), "   ");
    expect(outcome.kind).toBe("invalid-input");
    expect(nameToStructure).not.toHaveBeenCalled();
  });
});
