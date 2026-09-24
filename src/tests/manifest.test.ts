import { describe, expect, it } from "vitest";
import { isPluginApiVersionCompatible, parsePluginManifest } from "@chemdraft/plugin-api";

import { opsinPluginManifest, opsinConvertCommandId } from "../manifest";

describe("the manifest", () => {
  it("validates against the SDK schema", () => {
    expect(() => parsePluginManifest(opsinPluginManifest)).not.toThrow();
  });

  it("requires an API version that actually has the capabilities it depends on", () => {
    // promptText arrived in 0.1.3. A lower floor would let this install on a host where it cannot
    // collect a name — a plugin that installs and cannot do what its name promises is worse than one
    // that refuses and says why.
    expect(opsinPluginManifest.apiVersion).toBe("^0.1.3");
    expect(isPluginApiVersionCompatible(opsinPluginManifest.apiVersion, "0.1.3")).toBe(true);
    expect(isPluginApiVersionCompatible(opsinPluginManifest.apiVersion, "0.1.2")).toBe(false);
    expect(isPluginApiVersionCompatible(opsinPluginManifest.apiVersion, "0.1.0")).toBe(false);
  });

  it("asks to propose changes, not to write them", () => {
    // document.proposePatch, NOT document.write. The plugin queues a change the user accepts or
    // rejects; asking for write access it never uses would overstate what it does in the install
    // prompt, which is the same defect as a menu item that computes nothing.
    expect([...opsinPluginManifest.permissions].sort()).toEqual([
      "chemistry.compute",
      "document.proposePatch",
      "document.read",
      "native.execute",
      "ui.menu",
      "ui.panel"
    ]);
    expect(opsinPluginManifest.permissions).not.toContain("document.write");
  });

  it("wires the menu item to a command that exists", () => {
    const commandIds = opsinPluginManifest.contributes.commands?.map((command) => command.id) ?? [];
    expect(commandIds).toContain(opsinConvertCommandId);
    for (const menu of opsinPluginManifest.contributes.menus ?? []) {
      expect(commandIds).toContain(menu.commandId);
    }
    for (const panel of opsinPluginManifest.contributes.panels ?? []) {
      expect(commandIds).toContain(panel.commandId);
    }
  });
});
