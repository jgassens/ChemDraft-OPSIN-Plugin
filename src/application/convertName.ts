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
  return { kind: "converted", name, smiles: result.smiles, engine: result.engine };
}
