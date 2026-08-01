import { describe, expect, it, vi } from "vitest";
import { PluginHost } from "@chemdraft/plugin-host";

import { createOpsinRegistration } from "../register";
import { opsinConvertCommandId, opsinPanelId, opsinPluginManifest } from "../manifest";

/** Register against the real host, so permission gating and panel routing are exercised, not mocked. */
function hostWith(
  convertNameToStructure?: unknown,
  promptForName: () => Promise<string | undefined> = async () => "benzene"
) {
  const showPanelReport = vi.fn();
  const host = new PluginHost({
    showPanelReport,
    ...(convertNameToStructure === undefined ? {} : { convertNameToStructure: convertNameToStructure as never })
  });
  host.registerPlugin(opsinPluginManifest, createOpsinRegistration({ promptForName }));
  return { host, showPanelReport };
}

describe("the command, through the real host", () => {
  it("converts and reports what the engine returned", async () => {
    const { host, showPanelReport } = hostWith(async () => ({
      available: true,
      parsed: true,
      smiles: "C1=CC=CC=C1",
      engine: { id: "opsin", version: "2.9.0" }
    }));

    const result = await host.invokeCommand(opsinConvertCommandId);
    expect(result).toMatchObject({ kind: "converted", smiles: "C1=CC=CC=C1" });

    const [, panelId, report] = showPanelReport.mock.calls[0]!;
    expect(panelId).toBe(opsinPanelId);
    expect(JSON.stringify(report)).toContain("C1=CC=CC=C1");
    // The disclosure ships with the answer: OPSIN parses the name as written and cannot know what
    // the user meant, so a wrong-but-parseable name succeeds silently.
    expect(JSON.stringify(report)).toContain("does not know what compound you meant");
  });

  it("opens no panel at all when the user cancels the prompt", async () => {
    // Cancelling is not a failed conversion. Reporting one would put an error in front of someone who
    // simply changed their mind.
    const { host, showPanelReport } = hostWith(
      async () => ({ available: true, parsed: true, smiles: "C", engine: { id: "opsin", version: "2.9.0" } }),
      async () => undefined
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
