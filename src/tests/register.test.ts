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
const builtMolecule = {
  id: "mol_plugin_1",
  type: "generic-atom-label" as const,
  label: "C",
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  rotation: 0,
  style: {},
  querySemantics: "unknown" as const
};
type HostOverrides = {
  promptText?: PromptText | undefined;
  applyDocumentPatch?: NonNullable<PluginHostOptions["applyDocumentPatch"]> | undefined;
  missingDocumentWrite?: boolean;
};

/** Register against the real host, so permission gating and panel routing are exercised, not mocked. */
function hostWith(
  convertNameToStructure?: unknown,
  options: HostOverrides = { promptText: submitBenzene }
) {
  const showPanelReport = vi.fn();
  const applyDocumentPatch = vi.fn<NonNullable<PluginHostOptions["applyDocumentPatch"]>>(async () => ({
    applied: true as const,
    objectIds: ["mol_plugin_1"]
  }));
  const hostOptions = {
    showPanelReport,
    getActiveDocument: async () => ({ pages: [{ id: "page-1" }] }) as never,
    buildStructureFromSmiles: async () => ({ available: true as const, built: true as const, object: builtMolecule }),
    applyDocumentPatch,
    ...options,
    ...(convertNameToStructure === undefined ? {} : { convertNameToStructure: convertNameToStructure as never }),
  };
  const host = new PluginHost(hostOptions as PluginHostOptions);
  const manifest = options.missingDocumentWrite
    ? {
        ...opsinPluginManifest,
        permissions: opsinPluginManifest.permissions.filter((permission) => permission !== "document.write"),
        contributes: {
          ...opsinPluginManifest.contributes,
          commands: opsinPluginManifest.contributes.commands?.map((command) => ({
            ...command,
            requiredPermissions: command.requiredPermissions?.filter(
              (permission) => permission !== "document.write"
            )
          }))
        }
      }
    : opsinPluginManifest;
  host.registerPlugin(manifest, createOpsinRegistration());
  return { host, showPanelReport, applyDocumentPatch };
}

describe("the command, through the real host", () => {
  it("inserts one patch and opens no panel when conversion succeeds", async () => {
    const promptText = vi.fn<PromptText>(async () => ({ status: "submitted", value: "benzene" }));
    const { host, showPanelReport, applyDocumentPatch } = hostWith(async () => ({
      available: true,
      parsed: true,
      smiles: "C1=CC=CC=C1",
      engine: { id: "opsin", version: "2.9.0" }
    }), { promptText });

    const result = await host.invokeCommand(opsinConvertCommandId);
    expect(result).toMatchObject({
      kind: "converted",
      smiles: "C1=CC=CC=C1",
      insertion: { kind: "applied", objectIds: ["mol_plugin_1"] }
    });
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

    expect(applyDocumentPatch).toHaveBeenCalledTimes(1);
    const [{ patch, undoLabel }] = applyDocumentPatch.mock.calls[0]!;
    expect(patch.patch).toMatchObject({ op: "addObject", pageId: "page-1", object: builtMolecule });
    expect(undoLabel).toBe("Name to Structure (OPSIN): Structure from Name…");
    expect(showPanelReport).not.toHaveBeenCalled();
  });

  it("opens no panel at all when the user cancels the prompt", async () => {
    // Cancelling is not a failed conversion. Reporting one would put an error in front of someone who
    // simply changed their mind.
    const { host, showPanelReport, applyDocumentPatch } = hostWith(
      async () => ({ available: true, parsed: true, smiles: "C", engine: { id: "opsin", version: "2.9.0" } }),
      { promptText: async () => ({ status: "cancelled" }) }
    );
    const result = await host.invokeCommand(opsinConvertCommandId);
    expect(result).toEqual({ cancelled: true });
    expect(showPanelReport).not.toHaveBeenCalled();
    expect(applyDocumentPatch).not.toHaveBeenCalled();
  });

  it("tells the reader their name was never sent when the host has no engine", async () => {
    const { host, showPanelReport, applyDocumentPatch } = hostWith(undefined);
    const result = await host.invokeCommand(opsinConvertCommandId);
    expect(result).toMatchObject({ kind: "engine-unavailable" });

    const report = JSON.stringify(showPanelReport.mock.calls[0]![2]);
    expect(report).toContain("was never sent to a parser");
    // And it must not name an engine that never ran — that would be a false provenance claim.
    expect(report).not.toContain("opsin 2.9.0");
    expect(applyDocumentPatch).not.toHaveBeenCalled();
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
    const { host, showPanelReport, applyDocumentPatch } = hostWith(async () => ({
      available: true,
      parsed: false,
      reason,
      engine: { id: "opsin", version: "2.9.0" }
    }));

    const result = await host.invokeCommand(opsinConvertCommandId);
    expect(result).toMatchObject({ kind: "not-parsed" });

    const report = JSON.stringify(showPanelReport.mock.calls[0]![2]);
    expect(report).toContain(reason);
    expect(applyDocumentPatch).not.toHaveBeenCalled();
  });

  it("reports when applyPatch is absent because document.write is unavailable", async () => {
    const { host, showPanelReport, applyDocumentPatch } = hostWith(
      async () => ({ available: true, parsed: true, smiles: "C", engine: { id: "opsin", version: "2.9.0" } }),
      { promptText: submitBenzene, missingDocumentWrite: true }
    );

    const result = await host.invokeCommand(opsinConvertCommandId);
    expect(result).toMatchObject({ kind: "converted", insertion: { kind: "not-drawn" } });
    expect(JSON.stringify(showPanelReport.mock.calls[0]![2])).toContain("plugin API 0.1.4");
    expect(JSON.stringify(showPanelReport.mock.calls[0]![2])).toContain("document.write permission");
    expect(applyDocumentPatch).not.toHaveBeenCalled();
  });
});

describe("the worker registration", () => {
  it("has a handler for every command the manifest contributes", () => {
    const contributedCommandIds = opsinPluginManifest.contributes.commands?.map(({ id }) => id).sort();
    expect(Object.keys(opsinWorkerRegistration.commandHandlers).sort()).toEqual(contributedCommandIds);
  });
});
