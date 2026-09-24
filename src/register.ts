import type { PluginCommandContext, PluginCommandHandler, PluginPanelReport } from "@chemdraft/plugin-api";

import { convertName } from "./application/convertName";
import { MAX_NAME_LENGTH } from "./domain/contracts";
import { composeConversionReport } from "./report/composeConversionReport";
import { opsinConvertCommandId, opsinPanelId } from "./manifest";

/** Optional test override for the host-owned prompt. */
export interface OpsinPluginServices {
  /** Ask the user for a name. Resolves `undefined` when they cancel. */
  promptForName?: () => Promise<string | undefined>;
}

export interface OpsinPluginRegistration {
  commandHandlers: Record<string, PluginCommandHandler>;
}

const dialogsUnavailable = Symbol("dialogs-unavailable");

/**
 * Build the registration for `host.registerPlugin`.
 *
 * The host owns both the prompt and the 2D layout. The command asks through `dialogs.promptText`, then
 * `convertName` has the host turn OPSIN's SMILES into a document object and insert it as one undoable
 * command action. Keeping those jobs on the host preserves the worker boundary.
 *
 * Cancelling the prompt is a first-class outcome, not an error: no panel is opened and nothing is
 * reported, because a user who changed their mind has not asked a question.
 */
export function createOpsinRegistration(services: OpsinPluginServices = {}): OpsinPluginRegistration {
  const convert: PluginCommandHandler = async (context) => {
    const typed = await promptForName(context, services);
    if (typed === dialogsUnavailable) {
      await context.panels?.showReport(opsinPanelId, dialogsUnavailableReport);
      return { kind: "dialogs-unavailable" };
    }
    if (typed === undefined) {
      return { cancelled: true };
    }

    const outcome = await convertName(context, typed);
    if (!wasInserted(outcome)) {
      await context.panels?.showReport(opsinPanelId, composeConversionReport(outcome));
    }
    return outcome;
  };

  return { commandHandlers: { [opsinConvertCommandId]: convert } };
}

function wasInserted(outcome: Awaited<ReturnType<typeof convertName>>): boolean {
  return outcome.kind === "converted" && outcome.insertion.kind === "applied";
}

/** Convenience for callers that only need the handlers. */
export function createOpsinCommandHandlers(
  services: OpsinPluginServices = {}
): Record<string, PluginCommandHandler> {
  return createOpsinRegistration(services).commandHandlers;
}

const dialogsUnavailableReport: PluginPanelReport = {
  title: "Name to Structure",
  sections: [
    {
      kind: "text",
      title: "Text prompt unavailable",
      body:
        "This ChemDraft build cannot show the text prompt required to enter a chemical name. " +
        "Update to a build with plugin API 0.1.3 or later and dialog UI enabled."
    }
  ]
};

async function promptForName(
  context: PluginCommandContext,
  services: OpsinPluginServices
): Promise<string | undefined | typeof dialogsUnavailable> {
  if (services.promptForName) {
    return await services.promptForName();
  }

  if (!context.dialogs) {
    return dialogsUnavailable;
  }

  const response = await context.dialogs.promptText({
    title: "Structure from Name",
    label: "Systematic (IUPAC) name",
    placeholder: "2-methylpropan-1-ol",
    maxLength: MAX_NAME_LENGTH
  });
  return response.status === "submitted" ? response.value : undefined;
}
