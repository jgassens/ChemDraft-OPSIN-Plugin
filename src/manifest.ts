import type { PluginManifest } from "@chemdraft/plugin-api";

export const opsinPluginId = "org.chemdraft.opsin.nameToStructure";

export const opsinConvertCommandId = "plugin.opsinNameToStructure.convert";
export const opsinPanelId = "panel.opsinNameToStructure.review";

/** Stamped on records written to the host's generic analysis store. */
export const opsinNameToStructureAnalysisType = "name.to-structure";

/**
 * `apiVersion` is `^0.1.1`, not `^0.1.0`, and the difference matters.
 *
 * `PluginChemistryAPI.nameToStructure` arrived in 0.1.1. A 0.x caret locks the minor, so `^0.1.1`
 * installs on 0.1.1+ and is correctly REFUSED by a 0.1.0 host — which is the honest outcome, because
 * on such a host this plugin has no engine to call and every conversion would decline. Declaring
 * `^0.1.0` would let it install and then never work.
 */
export const opsinPluginManifest: PluginManifest = {
  id: opsinPluginId,
  name: "Name to Structure (OPSIN)",
  version: "0.1.0",
  apiVersion: "^0.1.1",
  description:
    "Converts a systematic chemical name to SMILES using OPSIN, a deterministic rule-based parser for IUPAC nomenclature. A name OPSIN cannot interpret is reported with the parser's own reason rather than guessed at — there is no fuzzy matching and no nearest-name search. This release reports the structure; it does not insert it into the document (see README).",
  entry: "dist/plugin.js",
  // Only what is used. Inserting would need `document.write`, and declaring it before the insert path
  // exists would put a permission in the install prompt that buys the user nothing — the same
  // "no decorative capability" rule the host's Toolbar Button Contract applies to buttons.
  permissions: ["chemistry.compute", "ui.menu", "ui.panel"],
  contributes: {
    commands: [
      {
        id: opsinConvertCommandId,
        title: "Structure from Name…",
        category: "Edit",
        description: "Convert a systematic chemical name to SMILES using the host's OPSIN engine.",
        requiredPermissions: ["chemistry.compute"],
        enabled: true
      }
    ],
    menus: [
      {
        id: "menu.opsinNameToStructure.convert",
        title: "Structure from Name…",
        commandId: opsinConvertCommandId,
        location: "edit",
        requiredPermissions: ["ui.menu"]
      }
    ],
    panels: [
      {
        id: opsinPanelId,
        title: "Name to Structure",
        commandId: opsinConvertCommandId,
        requiredPermissions: ["ui.panel"]
      }
    ],
    analyzers: [],
    toolbarButtons: [],
    toolsets: [],
    inspectors: [],
    templates: [],
    importers: [],
    exporters: [],
    transformers: [],
    recognizers: []
  }
};
