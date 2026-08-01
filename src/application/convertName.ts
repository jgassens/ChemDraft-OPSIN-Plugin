import type { PluginCommandContext } from "@chemdraft/plugin-api";

import { validateName, type NameConversionOutcome } from "../domain/contracts";

/**
 * Ask the host to turn a name into a structure, and map its answer onto our outcome set.
 *
 * The plugin owns no engine. OPSIN is a Java process the host bundles, and the SDK boundary
 * (ADR-0028 §1) stops a plugin reaching it directly — so `chemistry.compute` is the whole mechanism,
 * exactly as it is for the isotope envelope. That is a feature: there is one OPSIN in the product,
 * and a plugin cannot ship a second, worse name parser beside it.
 *
 * `nameToStructure` is optional on the API because a plugin may meet a host older than the method.
 * We declare `^0.1.1` so that should not happen, but the check stays: an install path that somehow
 * bypassed the version gate should decline, not throw `undefined is not a function`.
 */
export async function convertName(
  context: PluginCommandContext,
  rawName: string
): Promise<NameConversionOutcome> {
  const validated = validateName(rawName);
  if (!validated.ok) {
    return { kind: "invalid-input", name: rawName.trim(), reason: validated.reason };
  }
  const name = validated.name;

  const convert = context.chemistry?.nameToStructure;
  if (!convert) {
    return {
      kind: "engine-unavailable",
      name,
      reason:
        "This ChemDraft build does not provide a name-to-structure engine, so the name was not sent anywhere."
    };
  }

  const result = await convert({ name });

  if (!result.available) {
    return { kind: "engine-unavailable", name, reason: result.reason };
  }
  if (!result.parsed) {
    // The engine's own words. Not reworded, not softened: "unparsable due to the following being
    // uninterpretable: …" tells a chemist which fragment to fix, and a friendlier summary would not.
    return { kind: "not-parsed", name, reason: result.reason, engine: result.engine };
  }

  const insertion = await proposeStructure(context, result.smiles);
  return { kind: "converted", name, smiles: result.smiles, engine: result.engine, insertion };
}

/**
 * Turn the SMILES into a document object and propose it.
 *
 * Two host calls, and the plugin does neither job itself. `structureFromSmiles` does the 2D layout —
 * a plugin inventing coordinates would produce unusable geometry — and `proposePatch` puts the result
 * in the review queue rather than the document. That review step is not ceremony: OPSIN parses the
 * name as written, so a name meaning something other than the user intended converts *successfully*,
 * and the queue is what stands between that and a wrong structure landing silently.
 *
 * Every failure here degrades to `not-drawn` rather than failing the conversion, because the name did
 * convert and the SMILES is worth showing even when nothing can be drawn from it.
 */
async function proposeStructure(
  context: PluginCommandContext,
  smiles: string
): Promise<Extract<NameConversionOutcome, { kind: "converted" }>["insertion"]> {
  const build = context.chemistry?.structureFromSmiles;
  if (!build) {
    return {
      kind: "not-drawn",
      reason: "This ChemDraft build cannot lay out a structure, so only the SMILES is available."
    };
  }

  const built = await build({ smiles, origin: "Name to Structure (OPSIN)" });
  if (!built.available) {
    return { kind: "not-drawn", reason: built.reason };
  }
  if (!built.built) {
    return { kind: "not-drawn", reason: built.reason };
  }

  const document = await context.documents.getActiveDocument();
  const pageId = document?.pages[0]?.id;
  if (!pageId) {
    return { kind: "not-drawn", reason: "There is no open page to add the structure to." };
  }

  const receipt = await context.documents.proposePatch({
    patch: { op: "addObject", pageId, object: built.object },
    reason: `Insert the structure for "${smiles}"`,
    // The user should see this before it lands, not after. OPSIN parses the name as written and cannot
    // know what was meant, so approval is the step that catches a name that parsed to the wrong thing.
    requiresUserApproval: true
  });
  return { kind: "proposed", patchId: receipt.id };
}
