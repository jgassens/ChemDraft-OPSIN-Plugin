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
            kind: "keyValue",
            title: outcome.name,
            rows: [
              { label: "SMILES", value: outcome.smiles },
              { label: "Parsed by", value: `${outcome.engine.id} ${outcome.engine.version}` }
            ]
          },
          {
            kind: "text",
            title: "Check this before you use it",
            body:
              "OPSIN is a deterministic parser of systematic nomenclature: it applies the rules to the " +
              "name as written. It does not know what compound you meant, so a name that parses to a " +
              "different structure than you intended parses silently and successfully."
          },
          {
            kind: "text",
            title: "Not inserted into the document",
            body:
              "This release reports the SMILES for you to copy; it does not draw the structure. " +
              "Placing it would need 2D coordinates, which the drawing application generates, not this " +
              "plugin."
          }
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
          { kind: "text", title: "Why", body: outcome.reason },
          {
            kind: "text",
            title: "What this does not mean",
            body:
              "The parser did not recognise this name. That is not a statement that the compound does " +
              "not exist, or that the name is wrong — OPSIN covers systematic nomenclature, and trade " +
              "names, abbreviations, and many common names are outside it. No structure was guessed."
          }
        ]
      };

    case "engine-unavailable":
      return {
        title: "Name to Structure",
        sections: [
          {
            kind: "text",
            title: "No name parser in this build",
            body: outcome.reason
          },
          {
            kind: "text",
            title: "Your name was not the problem",
            // Said explicitly because the alternative is a user editing a perfectly good name forever.
            body: `"${outcome.name}" was never sent to a parser, so nothing has been determined about it.`
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
