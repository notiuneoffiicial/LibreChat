# Auto Router Keyword Configuration

LibreChat's auto router reads intent heuristics from `config/autoRouterKeywords.json`. The file allows teams to tune how user messages are mapped to intents and the presets that implement them.

## File structure

```json
{
  "defaultPatternWeight": 0.08,
  "keywordGroups": [
    {
      "intent": "coding",
      "baseIntensity": 0.62,
      "maxBoost": 0.36,
      "patterns": [
        { "pattern": "\\bbug\\b", "flags": "i" },
        { "type": "codeblock", "description": "codeblock", "weight": 0.12 },
        {
          "type": "attachment",
          "match": ["text/x-python", "tool:code_interpreter", "ext:py"],
          "description": "attachment:code",
          "weight": 0.12
        }
      ]
    }
  ],
  "quickIntent": {
    "intensity": 0.68,
    "tokenBudgetThreshold": 1200,
    "patterns": [{ "pattern": "\\bquick\\b", "flags": "i" }]
  },
  "detailIntent": { "intensity": 0.76, "tokenBudgetThreshold": 6000, "patterns": [...] },
  "supportIntent": { "intensity": 0.66, "patterns": [...] }
}
```

* `defaultPatternWeight` (0–1) supplies the fallback weight for regex and signal entries.
* `keywordGroups` describe the intents that contribute to routing. Each entry supplies:
  * `intent`: matches an intent key in `INTENT_TO_SPEC` within `api/server/services/Router/autoRouter.js`.
  * `baseIntensity`: minimum confidence before pattern boosts are applied.
  * `maxBoost`: clamps the combined weight contributed by all patterns.
  * `maxIntensity` (optional): absolute ceiling for the group.
  * `patterns`: ordered list of evidence definitions (see below).
* `quickIntent`, `detailIntent`, and `supportIntent` configure special-case routing where only the presence of the patterns or token budgets matter.

## Pattern types

The loader normalises each pattern and adds type-specific signals during runtime. Every pattern may declare a `weight` (defaults to `defaultPatternWeight`) and a `description` used in telemetry.

| Type | Fields | Behaviour |
| ---- | ------ | --------- |
| `regex` (default) | `pattern`, optional `flags` | Regular expression matched against the lower-cased text. |
| `language` | `codes` (array of ISO codes or keywords), optional `match` (`nonEnglish`, `multiple`, `explicitMention`) | Uses heuristics (script detection, common keywords, explicit language names, code block language headers) to record linguistic evidence. |
| `codeblock` | optional `languages`, `requireLanguage` | Detects fenced code blocks (``` or ~~~) and `<code>` tags. Can restrict matches to specific block languages. |
| `attachment` | `match` (array of mime types, extensions, `tool:` markers, etc.), optional `matchAny` | Scans conversation attachments, files, and ephemeral agent artifacts for matching metadata. |

When a pattern matches, its weight is added to the group's intensity up to `maxBoost`. Hits are surfaced through `candidate.keywordHits` for logging and debugging.

## Custom paths

Set `AUTO_ROUTER_KEYWORD_CONFIG=/absolute/path/to/keywords.json` to load an alternate configuration. Invalid or unreadable files are logged and the router falls back to `config/autoRouterKeywords.default.json` to keep the service responsive.

## Validation

The loader enforces:

* numeric bounds for intensities, boosts, and weights (`0 <= value <= 1`).
* non-empty `keywordGroups`, with required `intent`, `baseIntensity`, and at least one pattern.
* supported pattern types (`regex`, `language`, `codeblock`, `attachment`).
* well-formed quick/detail/support sections with at least one pattern.

Malformed configurations are rejected with a warning and the defaults are re-used. The Jest suite covers both parse failures and unsupported types so regressions are caught automatically.
