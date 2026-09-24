import { describe, expect, it, vi } from "vitest";
import { PluginHost, type PluginHostOptions } from "@chemdraft/plugin-host";

import { createOpsinRegistration } from "../register";
import {
  opsinConvertCommandId,
  opsinPanelId,
  opsinPluginId,
  opsinPluginManifest
} from "../manifest";
import { MAX_NAME_LENGTH } from "../domain/contracts";
import { opsinWorkerRegistration } from "../workerRegistration";

type PromptText = NonNullable<PluginHostOptions["promptText"]>;
const submitBenzene: PromptText = async () => ({ status: "submitted", value: "benzene" });

/** Register against the real host, so permission gating and panel routing are exercised, not mocked. */
function hostWith(
  convertNameToStructure?: unknown,
  options: { promptText?: PromptText } = { promptText: submitBenzene }
) {
  const showPanelReport = vi.fn();
  const host = new PluginHost({
    showPanelReport,
    ...(convertNameToStructure === undefined ? {} : { convertNameToStructure: convertNameToStructure as never }),
    ...(options.promptText === undefined ? {} : { promptText: options.promptText })
  });
  host.registerPlugin(opsinPluginManifest, createOpsinRegistration());
  return { host, showPanelReport };
}

describe("the command, through the real host", () => {
  it("converts and reports what the engine returned", async () => {
    const promptText = vi.fn<PromptText>(async () => ({ status: "submitted", value: "benzene" }));
    const { host, showPanelReport } = hostWith(async () => ({
      available: true,
      parsed: true,
      smiles: "C1=CC=CC=C1",
      engine: { id: "opsin", version: "2.9.0" }
    }), { promptText });

    const result = await host.invokeCommand(opsinConvertCommandId);
    expect(result).toMatchObject({ kind: "converted", smiles: "C1=CC=CC=C1" });
    expect(promptText).toHaveBeenCalledWith(
      { id: opsinPluginId, name: "Name to Structure (OPSIN)" },
      {
        title: "Structure from Name",
        label: "Systematic (IUPAC) name",
        placeholder: "2-methylpropan-1-ol",
        maxLength: MAX_NAME_LENGTH
      },
      expect.any(AbortSignal)
    );

    const [, panelId, report] = showPanelReport.mock.calls[0]!;
    expect(panelId).toBe(opsinPanelId);
    expect(JSON.stringify(report)).toContain("C1=CC=CC=C1");
    expect(JSON.stringify(report)).toContain(
      "OPSIN reads the name exactly as written. Check the structure before accepting."
    );
  });

  it("opens no panel at all when the user cancels the prompt", async () => {
    // Cancelling is not a failed conversion. Reporting one would put an error in front of someone who
    // simply changed their mind.
    const { host, showPanelReport } = hostWith(
      async () => ({ available: true, parsed: true, smiles: "C", engine: { id: "opsin", version: "2.9.0" } }),
      { promptText: async () => ({ status: "cancelled" }) }
    );
    const result = await host.invokeCommand(opsinConvertCommandId);
    expect(result).toEqual({ cancelled: true });
    expect(showPanelReport).not.toHaveBeenCalled();
  });

  it("tells the reader their name was never sent when the host has no engine", async () => {
    const { host, showPanelReport } = hostWith(undefined);
    const result = await host.invokeCommand(opsinConvertCommandId);
    expect(result).toMatchObject({ kind: "engine-unavailable" });

    const report = JSON.stringify(showPanelReport.mock.calls[0]![2]);
    expect(report).toContain("was never sent to a parser");
    // And it must not name an engine that never ran — that would be a false provenance claim.
    expect(report).not.toContain("opsin 2.9.0");
  });

  it("reports a clear explanation when this host has no dialog UI", async () => {
    const { host, showPanelReport } = hostWith(
      async () => ({ available: true, parsed: true, smiles: "C", engine: { id: "opsin", version: "2.9.0" } }),
      {}
    );

    const result = await host.invokeCommand(opsinConvertCommandId);
    expect(result).toEqual({ kind: "dialogs-unavailable" });
    expect(JSON.stringify(showPanelReport.mock.calls[0]![2])).toContain("cannot show the text prompt");
  });

  it("reports a name the engine could not read, with the engine's own words", async () => {
    const reason = "xyzzy is unparsable due to the following being uninterpretable: xyzzy";
    const { host, showPanelReport } = hostWith(async () => ({
      available: true,
      parsed: false,
      reason,
      engine: { id: "opsin", version: "2.9.0" }
    }));

    const result = await host.invokeCommand(opsinConvertCommandId);
    expect(result).toMatchObject({ kind: "not-parsed" });

    const report = JSON.stringify(showPanelReport.mock.calls[0]![2]);
    expect(report).toContain(reason);
    // A parser miss is not evidence the compound does not exist, and the panel says so.
    expect(report).toContain("not a statement that the compound does not exist");
  });
});

describe("the worker registration", () => {
  it("has a handler for every command the manifest contributes", () => {
    const contributedCommandIds = opsinPluginManifest.contributes.commands?.map(({ id }) => id).sort();
    expect(Object.keys(opsinWorkerRegistration.commandHandlers).sort()).toEqual(contributedCommandIds);
  });
});
