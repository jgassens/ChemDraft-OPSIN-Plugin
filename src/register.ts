import type { PluginCommandHandler } from "@chemdraft/plugin-api";

import { convertName } from "./application/convertName";
import { composeConversionReport } from "./report/composeConversionReport";
import { opsinConvertCommandId, opsinPanelId } from "./manifest";

/** How the command obtains the name to convert. The host supplies a prompt; tests supply a stub. */
export interface OpsinPluginServices {
  /** Ask the user for a name. Resolves `undefined` when they cancel. */
  promptForName(): Promise<string | undefined>;
}

export interface OpsinPluginRegistration {
  commandHandlers: Record<string, PluginCommandHandler>;
}

/**
 * Build the registration for `host.registerPlugin`.
 *
 * **This release reports the structure; it does not insert it.** That is a real limit, not an
 * oversight, and it is worth stating where the code is: `proposePatch` takes a fully-formed
 * `DocumentObject`, so inserting means turning SMILES into atoms, bonds, *and 2D coordinates*. Laying
 * out a structure is core work — the host owns the layout engine — and a plugin that faked it would
 * produce a molecule with no usable geometry. Reporting a SMILES the user can copy is the honest
 * shape until the host exposes a structure-from-SMILES capability.
 *
 * Cancelling the prompt is a first-class outcome, not an error: no panel is opened and nothing is
 * reported, because a user who changed their mind has not asked a question.
 */
export function createOpsinRegistration(services: OpsinPluginServices): OpsinPluginRegistration {
  const convert: PluginCommandHandler = async (context) => {
    const typed = await services.promptForName();
    if (typed === undefined) {
      return { cancelled: true };
    }

    const outcome = await convertName(context, typed);
    await context.panels?.showReport(opsinPanelId, composeConversionReport(outcome));
    return outcome;
  };

  return { commandHandlers: { [opsinConvertCommandId]: convert } };
}

/** Convenience for callers that only need the handlers. */
export function createOpsinCommandHandlers(
  services: OpsinPluginServices
): Record<string, PluginCommandHandler> {
  return createOpsinRegistration(services).commandHandlers;
}
