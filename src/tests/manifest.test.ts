import { describe, expect, it } from "vitest";
import { isPluginApiVersionCompatible, parsePluginManifest } from "@chemdraft/plugin-api";

import { opsinPluginManifest, opsinConvertCommandId } from "../manifest";

describe("the manifest", () => {
  it("validates against the SDK schema", () => {
    expect(() => parsePluginManifest(opsinPluginManifest)).not.toThrow();
  });

  it("requires an API version that actually has the capabilities it depends on", () => {
    // applyPatch arrived in 0.1.4. A lower floor would let this install on a host where it cannot
    // insert the result, so it must refuse instead.
    expect(opsinPluginManifest.apiVersion).toBe("^0.1.4");
    expect(isPluginApiVersionCompatible(opsinPluginManifest.apiVersion, "0.1.4")).toBe(true);
    expect(isPluginApiVersionCompatible(opsinPluginManifest.apiVersion, "0.1.3")).toBe(false);
    expect(isPluginApiVersionCompatible(opsinPluginManifest.apiVersion, "0.1.0")).toBe(false);
  });

  it("asks to write one command-scoped patch", () => {
    expect([...opsinPluginManifest.permissions].sort()).toEqual([
      "chemistry.compute",
      "document.read",
      "document.write",
      "native.execute",
      "ui.menu",
      "ui.panel"
    ]);
    expect(opsinPluginManifest.permissions).not.toContain("document.proposePatch");
    expect(opsinPluginManifest.contributes.commands?.[0]?.requiredPermissions).toEqual([
      "chemistry.compute",
      "native.execute",
      "document.read",
      "document.write"
    ]);
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
