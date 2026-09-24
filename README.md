# @chemdraft/plugin-opsin-name-to-structure

Standalone repository for ChemDraft's **name → structure** plugin. Run
**Analyze → Structure from Name…**, type a systematic chemical name, and the
structure is drawn, inserted, and selected — parsed by
[OPSIN](https://github.com/dan2097/opsin), a deterministic rule-based parser of
IUPAC nomenclature.

It compiles only against the vendored ChemDraft plugin SDK; no monorepo is
required.

## What it does, and what it does not

**It inserts as one undoable action.** The host applies the structure while the
command is running, selects the inserted object, and records one undo entry.
Use Undo to remove it.

**The 2D layout is the host's, not the plugin's.** A plugin inventing coordinates
would produce unusable geometry, so the host lays the structure out (the same
engine chain a pasted SMILES uses) and hands back an object to insert. If a host
cannot draw it, you still get the SMILES: a failed layout is not a failed
conversion.

**A name it cannot read is reported, never guessed.** There is no fuzzy matching
and no nearest-name search. When OPSIN cannot interpret a name you get OPSIN's
own words for why — it names the fragment it choked on, which is the part you can
act on.

**A parser miss is not a statement about chemistry.** OPSIN covers systematic
nomenclature. Trade names, abbreviations, and many common names are outside it,
and "not interpreted" says nothing about whether the compound exists.

OPSIN applies the rules to the name as written. Check the inserted structure if a
name could have more than one intended meaning.

## Requirements

A ChemDraft host compatible with plugin API **`^0.1.4`**. The floor is deliberate:
`nameToStructure` arrived in 0.1.1, `structureFromSmiles` — the layout that makes
insertion possible — in 0.1.2, the host-owned text prompt used to enter a name
arrived in 0.1.3, and command-scoped `documents.applyPatch` arrived in 0.1.4. A
lower floor would let the plugin install and not do what its
name promises, so instead it refuses to install and says why.

The OPSIN engine and its Java runtime are **bundled by the host**, not by this
plugin. If a host build ships without the runtime, a short report says so and says
plainly that your name was never sent anywhere. Other failures (an unparsable
name, layout failure, or an unavailable insertion path) also open a short report.
Cancelling the prompt does nothing.

## Architecture

The plugin owns no chemistry engine. OPSIN runs in the host, and the SDK boundary
(ADR-0028 §1) stops a plugin reaching it directly, so everything goes through
`chemistry.compute` — the same route the mass-fragment demo uses for isotope
envelopes. That is deliberate: there is one OPSIN in the product, and a plugin
cannot ship a second, worse name parser beside it.

```
src/
  manifest.ts                     identity, commands, menus, panels, permissions
  domain/contracts.ts             the outcome set, and the only input validation
  application/convertName.ts      asks the host, lays out, inserts, maps to an outcome
  report/composeConversionReport  outcome → declarative panel report
  register.ts                     command handler and host-owned text prompt
  workerRegistration.ts           pure manifest/handler wiring for the worker
  workerEntry.ts                  starts the plugin Web Worker runtime
```

The four outcomes (`converted`, `not-parsed`, `engine-unavailable`,
`invalid-input`) are a closed set rather than "a structure or an error" because
each needs a different thing said to the reader. The one that matters most is
keeping *the engine said no* apart from *there is no engine*: a user told "could
not convert" for a perfectly good name typed into a build with no parser will
edit that name forever.

## Permissions

`chemistry.compute`, `native.execute`, `document.read`, `document.write`,
`ui.menu`, and `ui.panel` — and nothing else.

- The host requires `native.execute` as well as `chemistry.compute` before it can
  start the bundled JVM that runs OPSIN. This is a host capability rule, not a
  plugin-selected execution path.
- `chemistry.compute` lets the plugin ask the host to parse the name and lay out
  the resulting structure; the plugin includes neither engine.
- The host requires `document.read` for `structureFromSmiles`, because it lays the
  result out against the active document.
- **`document.write`:** used only through the host's command-scoped
  `documents.applyPatch`. The host applies one patch as one undo entry, selects the
  inserted object, and shows its status-bar message; the plugin has no unscoped
  write path.
- `ui.menu` provides **Analyze → Structure from Name…** and `ui.panel` provides
  the short failure reports.

The command uses ChemDraft's host-owned text prompt while its own menu command is
running. Cancelling is a silent no-op. If a host has no dialog UI, the plugin opens
its panel with an explanation instead of failing.

## Installation

Run `npm run package`, then in ChemDraft choose **Add plugin from package…** and
select `dist/plugin-packages/opsin-name-to-structure-0.3.0.zip`. ChemDraft runs the
package's module worker; this plugin does not rely on browser DOM APIs.

## Development

```bash
npm install
npm test        # vitest, including registration against the real PluginHost
npm run lint    # tsc --noEmit over src
npm run package # build the installable plugin zip
```

`tools/` holds vendored copies of the monorepo's packaging scripts, run through
`tsx`. They are not plugin source and are not typechecked here.

## License

MIT. See `LICENSE`. OPSIN itself is MIT (© 2017 Daniel Lowe) and is redistributed
by the ChemDraft host, not by this package.
