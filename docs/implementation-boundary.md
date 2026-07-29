# Implementation boundary

The visual Codelit workflow describes the complete scope, context, patch,
verification, and review team. This public runner implements its local,
bring-your-own-key path:

| Team Flow step | Public runner |
| --- | --- |
| Read task scope | Human-authored Markdown issue |
| Load repo context | Explicit `contextPaths`, size bounded |
| Apply narrow patch | Model proposes a diff; policy validates it; human runs apply |
| Verify and open PR | Fixed commands run before commit; optional draft PR through `gh` |

The public runner does not install a GitHub App, listen to webhooks, merge,
approve, deploy, read Linear, or manage credentials. Hosted connectors,
schedules, durable receipts, and team supervision remain Codelit features.
