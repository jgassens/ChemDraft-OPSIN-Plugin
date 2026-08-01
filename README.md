# @chemdraft/plugin-opsin-name-to-structure

Standalone repository for ChemDraft's **name → structure** plugin. Run
**Edit → Structure from Name…**, type a systematic chemical name, and the
structure is drawn and proposed for insertion — parsed by
[OPSIN](https://github.com/dan2097/opsin), a deterministic rule-based parser of
IUPAC nomenclature.

It compiles only against the vendored ChemDraft plugin SDK; no monorepo is
required.

## What it does, and what it does not

**It proposes; it never writes.** The structure lands in the host's review queue
and you accept or reject it. That is not ceremony — see below.

**The 2D layout is the host's, not the plugin's.** A plugin inventing coordinates
would produce unusable geometry, so the host lays the structure out (the same
engine chain a pasted SMILES uses) and hands back an object to propose. If a host
cannot draw it, you still get the SMILES: a failed layout is not a failed
conversion.

**A name it cannot read is reported, never guessed.** There is no fuzzy matching
and no nearest-name search. When OPSIN cannot interpret a name you get OPSIN's
own words for why — it names the fragment it choked on, which is the part you can
act on.

**A parser miss is not a statement about chemistry.** OPSIN covers systematic
nomenclature. Trade names, abbreviations, and many common names are outside it,
and "not interpreted" says nothing about whether the compound exists.

**Check what comes back — this is why there is a review step.** OPSIN applies the
rules to the name as written. It cannot know what you meant, so a name that parses
to a structure other than the one you intended parses silently and *successfully*.
Nothing downstream can catch that; only you can.

## Requirements

A ChemDraft host compatible with plugin API **`^0.1.2`**. The floor is deliberate:
`nameToStructure` arrived in 0.1.1 and `structureFromSmiles` — the layout that
makes insertion possible — in 0.1.2. On a 0.1.0 host every conversion would
decline; on 0.1.1 it could convert but never draw. A lower floor would let the
plugin install and not do what its name promises, so instead it refuses to install
and says why.

The OPSIN engine and its Java runtime are **bundled by the host**, not by this
plugin. If a host build ships without the runtime, the panel says so and says
plainly that your name was never sent anywhere.

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
  application/convertName.ts      asks the host, lays out, proposes, maps to an outcome
  report/composeConversionReport  outcome → declarative panel report
  register.ts                     command handler for host.registerPlugin
```

The four outcomes (`converted`, `not-parsed`, `engine-unavailable`,
`invalid-input`) are a closed set rather than "a structure or an error" because
each needs a different thing said to the reader. The one that matters most is
keeping *the engine said no* apart from *there is no engine*: a user told "could
not convert" for a perfectly good name typed into a build with no parser will
edit that name forever.

## Permissions

`chemistry.compute`, `document.proposePatch`, `ui.menu`, `ui.panel` — and nothing
else. **`document.proposePatch`, not `document.write`:** the plugin queues a change
you accept or reject and never writes the document itself, so the narrower
permission is the accurate one. Asking for write access it does not use would
overstate what it does in the install prompt.

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
