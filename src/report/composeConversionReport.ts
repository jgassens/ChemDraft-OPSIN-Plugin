import type { PluginPanelReport } from "@chemdraft/plugin-api";

import type { NameConversionOutcome } from "../domain/contracts";

/**
 * Render an outcome as a declarative panel report.
 *
 * The panel is data, not markup (ADR-0004): the plugin says what to show and the host draws it, so
 * the same report survives the worker boundary and the clipboard.
 *
 * Every branch names the engine when one ran, and says nothing about an engine when none did. That
 * asymmetry is the point — attributing a decline to OPSIN when OPSIN was never asked would be a
 * false provenance claim.
 */
export function composeConversionReport(outcome: NameConversionOutcome): PluginPanelReport {
  switch (outcome.kind) {
    case "converted":
      return {
        title: "Name to Structure",
        sections: [
          {
            kind: "text",
            title: "The name converted, but the structure was not inserted",
            body:
              outcome.insertion.kind === "not-drawn"
                ? outcome.insertion.reason
                : "The structure was inserted."
          },
          { kind: "keyValue", title: outcome.name, rows: [{ label: "SMILES", value: outcome.smiles }] }
        ]
      };

    case "not-parsed":
      return {
        title: "Name to Structure",
        sections: [
          {
            kind: "keyValue",
            title: outcome.name,
            rows: [
              { label: "Result", value: "Not interpreted" },
              { label: "Engine", value: `${outcome.engine.id} ${outcome.engine.version}` }
            ]
          },
          { kind: "text", title: "Why", body: outcome.reason }
        ]
      };

    case "engine-unavailable":
      return {
        title: "Name to Structure",
        sections: [
          {
            kind: "text",
            title: "No name parser in this build",
            body: `${outcome.reason} "${outcome.name}" was never sent to a parser.`
          }
        ]
      };

    case "invalid-input":
      return {
        title: "Name to Structure",
        sections: [{ kind: "text", title: "Nothing to convert", body: outcome.reason }]
      };
  }
}
