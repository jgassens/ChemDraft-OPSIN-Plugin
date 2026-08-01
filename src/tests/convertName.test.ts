import { describe, expect, it, vi } from "vitest";
import type { PluginCommandContext } from "@chemdraft/plugin-api";

import { convertName } from "../application/convertName";
import { MAX_NAME_LENGTH, validateName } from "../domain/contracts";

/**
 * A context carrying what this plugin uses: chemistry, and the document API it proposes through.
 *
 * `structureFromSmiles` defaults to a working stub so the conversion tests stay about conversion; the
 * insertion tests override it.
 */
function contextWith(
  nameToStructure?: unknown,
  overrides: { structureFromSmiles?: unknown; proposePatch?: unknown; pages?: unknown[] } = {}
): PluginCommandContext {
  // `in` rather than `??`, so a test can express "this host does NOT have the method" by passing
  // undefined explicitly — which is exactly the older-host case worth covering.
  const structureFromSmiles = "structureFromSmiles" in overrides
    ? overrides.structureFromSmiles
    : async () => ({ available: true, built: true, object: { id: "mol_plugin_1", type: "molecule" } });
  const pages = overrides.pages ?? [{ id: "page-1" }];
  return {
    plugin: { id: "org.test", name: "t", version: "0", permissions: [] },
    documents: {
      getActiveDocument: async () => ({ pages }),
      proposePatch: overrides.proposePatch ?? (async () => ({ id: "patch-1", status: "pending" }))
    },
    ...(nameToStructure === undefined
      ? {}
      : { chemistry: { nameToStructure, structureFromSmiles } as never }),
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
    expect(outcome).toMatchObject({
      kind: "converted",
      name: "benzene",
      smiles: "C1=CC=CC=C1",
      engine,
      insertion: { kind: "proposed", patchId: "patch-1" }
    });
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

describe("insertion", () => {
  const parses = async () => ({ available: true, parsed: true, smiles: "C1=CC=CC=C1", engine });

  it("proposes the structure rather than writing it", async () => {
    // The whole safety argument: OPSIN parses the name as written and cannot know what was meant, so
    // a wrong-but-parseable name converts successfully. The review queue is what catches it.
    const proposePatch = vi.fn(async (_proposal: unknown) => ({ id: "patch-9", status: "pending" }));
    const outcome = await convertName(contextWith(parses, { proposePatch }), "benzene");

    expect(outcome).toMatchObject({ insertion: { kind: "proposed", patchId: "patch-9" } });
    const proposal = proposePatch.mock.calls[0]![0] as unknown as {
      patch: { op: string; pageId: string };
      requiresUserApproval?: boolean;
    };
    expect(proposal.patch.op).toBe("addObject");
    expect(proposal.patch.pageId).toBe("page-1");
    expect(proposal.requiresUserApproval).toBe(true);
  });

  it("still reports the SMILES when nothing could be drawn", async () => {
    // A failed layout is not a failed conversion. The name DID convert, and the SMILES is useful even
    // when the drawing step cannot produce anything — so this degrades rather than erroring.
    const outcome = await convertName(
      contextWith(parses, {
        structureFromSmiles: async () => ({ available: true, built: false, reason: "no 2D structure" })
      }),
      "benzene"
    );
    expect(outcome).toMatchObject({
      kind: "converted",
      smiles: "C1=CC=CC=C1",
      insertion: { kind: "not-drawn", reason: "no 2D structure" }
    });
  });

  it("does not propose anything when there is no open page", async () => {
    const proposePatch = vi.fn();
    const outcome = await convertName(contextWith(parses, { proposePatch, pages: [] }), "benzene");
    expect(outcome).toMatchObject({ insertion: { kind: "not-drawn" } });
    expect(proposePatch).not.toHaveBeenCalled();
  });

  it("degrades when the host is too old to lay a structure out", async () => {
    const outcome = await convertName(
      contextWith(parses, { structureFromSmiles: undefined as never }),
      "benzene"
    );
    expect(outcome).toMatchObject({ kind: "converted", insertion: { kind: "not-drawn" } });
  });
});
