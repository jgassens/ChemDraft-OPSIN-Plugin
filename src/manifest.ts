import type { PluginManifest } from "@chemdraft/plugin-api";

export const opsinPluginId = "org.chemdraft.opsin.nameToStructure";

export const opsinConvertCommandId = "plugin.opsinNameToStructure.convert";
export const opsinPanelId = "panel.opsinNameToStructure.review";

/** Stamped on records written to the host's generic analysis store. */
export const opsinNameToStructureAnalysisType = "name.to-structure";

/**
 * `apiVersion` is `^0.1.4`, and the floor is deliberate.
 *
 * `nameToStructure` arrived in 0.1.1 and `structureFromSmiles` — the 2D layout that makes insertion
 * possible — in 0.1.2, host-owned text prompts arrived in 0.1.3, and command-scoped direct insertion
 * arrived in 0.1.4. A 0.x caret locks the minor, so `^0.1.4` installs on 0.1.4+ and is correctly REFUSED by anything older. Declaring a lower floor
 * would let it install and then not do what its name promises.
 */
export const opsinPluginManifest: PluginManifest = {
  id: opsinPluginId,
  name: "Name to Structure (OPSIN)",
  version: "0.3.0",
  apiVersion: "^0.1.4",
  description:
    "Converts a systematic chemical name to a structure using OPSIN, a deterministic rule-based parser for IUPAC nomenclature, and inserts it as one undoable action. A name OPSIN cannot interpret is reported with the parser's own reason rather than guessed at: there is no fuzzy matching and no nearest-name search.",
  entry: "dist/plugin.js",
  // `document.write` is used only through the host's command-scoped `applyPatch`, which records one
  // undo entry. The plugin has no unscoped document-write path.
  permissions: [
    "chemistry.compute",
    // The host requires this before `nameToStructure` may start its bundled JVM.
    "native.execute",
    // The host requires this because `structureFromSmiles` lays out against the active document.
    "document.read",
    "document.write",
    "ui.menu",
    "ui.panel"
  ],
  contributes: {
    commands: [
      {
        id: opsinConvertCommandId,
        title: "Structure from Name…",
        category: "Analyze",
        description:
          "Convert a systematic chemical name to a structure and insert it into the document.",
        requiredPermissions: [
          "chemistry.compute",
          "native.execute",
          "document.read",
          "document.write"
        ],
        enabled: true
      }
    ],
    menus: [
      {
        id: "menu.opsinNameToStructure.convert",
        title: "Structure from Name…",
        commandId: opsinConvertCommandId,
        location: "analyze",
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
