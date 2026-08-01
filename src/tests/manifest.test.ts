import { describe, expect, it } from "vitest";
import { isPluginApiVersionCompatible, parsePluginManifest } from "@chemdraft/plugin-api";

import { opsinPluginManifest, opsinConvertCommandId } from "../manifest";

describe("the manifest", () => {
  it("validates against the SDK schema", () => {
    expect(() => parsePluginManifest(opsinPluginManifest)).not.toThrow();
  });

  it("requires an API version that actually has the capability it depends on", () => {
    // `nameToStructure` arrived in 0.1.1. Declaring ^0.1.0 would let this install on a host where
    // every conversion declines — a plugin that installs and cannot work is worse than one that
    // refuses to install and says why.
    expect(opsinPluginManifest.apiVersion).toBe("^0.1.1");
    expect(isPluginApiVersionCompatible(opsinPluginManifest.apiVersion, "0.1.1")).toBe(true);
    expect(isPluginApiVersionCompatible(opsinPluginManifest.apiVersion, "0.1.0")).toBe(false);
  });

  it("declares only the permissions it uses", () => {
    // No document.write: this release does not insert. A permission in the install prompt that buys
    // the user nothing is the same defect as a menu item that computes nothing.
    expect([...opsinPluginManifest.permissions].sort()).toEqual([
      "chemistry.compute",
      "ui.menu",
      "ui.panel"
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
