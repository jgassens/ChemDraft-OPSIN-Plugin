/**
 * What a conversion attempt produced, as a closed set of outcomes.
 *
 * Four cases rather than "a structure or an error", because a reader needs to be told different
 * things and offered different next steps in each:
 *
 * - `converted` — here is the structure.
 * - `not-parsed` — the engine ran and did not understand the name. The name is the thing to change.
 * - `engine-unavailable` — this build has no name parser. Nothing about the name is known, and
 *   retyping it will not help.
 * - `invalid-input` — the plugin refused before asking, e.g. an empty name.
 *
 * Collapsing the middle two is the mistake worth naming: a user told "could not convert" for a
 * perfectly good name they typed into a build with no engine will edit the name forever.
 */
export type NameConversionOutcome =
  | { kind: "converted"; name: string; smiles: string; engine: EngineIdentity }
  | { kind: "not-parsed"; name: string; reason: string; engine: EngineIdentity }
  | { kind: "engine-unavailable"; name: string; reason: string }
  | { kind: "invalid-input"; name: string; reason: string };

export interface EngineIdentity {
  id: string;
  version: string;
}

/** The longest name we will send. Systematic names get long; this bounds the request, not chemistry. */
export const MAX_NAME_LENGTH = 2000;

/**
 * Reject a name that cannot usefully be sent, before spending a round trip on it.
 *
 * Deliberately minimal: this is not a nomenclature check, and it must not become one. Deciding
 * whether a name is *valid* is precisely OPSIN's job, and a plugin second-guessing it would reject
 * names the engine handles. The only refusals here are structural — nothing to send, or too much.
 */
export function validateName(raw: string): { ok: true; name: string } | { ok: false; reason: string } {
  const name = raw.trim();
  if (name.length === 0) {
    return { ok: false, reason: "Enter a chemical name to convert." };
  }
  if (name.length > MAX_NAME_LENGTH) {
    return {
      ok: false,
      reason: `That name is ${name.length} characters; the limit is ${MAX_NAME_LENGTH}.`
    };
  }
  return { ok: true, name };
}
