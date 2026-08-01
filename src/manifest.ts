import type { PluginManifest } from "@chemdraft/plugin-api";

export const opsinPluginId = "org.chemdraft.opsin.nameToStructure";

export const opsinConvertCommandId = "plugin.opsinNameToStructure.convert";
export const opsinPanelId = "panel.opsinNameToStructure.review";

/** Stamped on records written to the host's generic analysis store. */
export const opsinNameToStructureAnalysisType = "name.to-structure";

/**
 * `apiVersion` is `^0.1.2`, and the floor is deliberate.
 *
 * `nameToStructure` arrived in 0.1.1 and `structureFromSmiles` — the 2D layout that makes insertion
 * possible — in 0.1.2. A 0.x caret locks the minor, so `^0.1.2` installs on 0.1.2+ and is correctly
 * REFUSED by anything older. That is the honest outcome: on a 0.1.0 host this plugin has no engine at
 * all, and on 0.1.1 it could convert but never draw. Declaring a lower floor would let it install and
 * then not do what its name promises.
 */
export const opsinPluginManifest: PluginManifest = {
  id: opsinPluginId,
  name: "Name to Structure (OPSIN)",
  version: "0.1.0",
  apiVersion: "^0.1.2",
  description:
    "Converts a systematic chemical name to a structure using OPSIN, a deterministic rule-based parser for IUPAC nomenclature, and proposes it for insertion — you review it before it lands. A name OPSIN cannot interpret is reported with the parser's own reason rather than guessed at: there is no fuzzy matching and no nearest-name search.",
  entry: "dist/plugin.js",
  // `document.proposePatch`, NOT `document.write`: this plugin queues a change for the user to accept
  // or reject and never writes the document itself. The narrower permission is the accurate one, and
  // the install prompt should say what the plugin actually does.
  permissions: ["chemistry.compute", "document.proposePatch", "ui.menu", "ui.panel"],
  contributes: {
    commands: [
      {
        id: opsinConvertCommandId,
        title: "Structure from Name…",
        category: "Edit",
        description:
          "Convert a systematic chemical name to a structure and propose it for insertion into the document.",
        requiredPermissions: ["chemistry.compute", "document.proposePatch"],
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
