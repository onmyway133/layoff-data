# Contributing

Thanks for helping keep the layoff data accurate. Every change goes through a
pull request. A check validates the files, a maintainer reviews, and once the
PR is merged the change shows up on the site.

Not comfortable editing JSON? Open an issue with the
[layoff or correction form](../../issues/new/choose) instead.

## What belongs here

Layoffs at tech companies and startups, reported by the press. One event is
one announced round of cuts. We list layoffs of more than 100 people: an event
with a `headcount` of 100 or fewer is refused by the check.

- **Tech only.** Software, internet, hardware, semiconductors, telecom, games,
  fintech, e-commerce and IT services companies. Banks, insurers, government,
  traditional media, pharma, medical devices, carmakers and retailers are out,
  even when the cut is in their tech unit or linked to AI.
- **Layoffs only.** Involuntary job cuts. Voluntary buyouts or exit offers,
  attrition, hiring freezes and roles left unfilled are not layoffs.

Events outside these rules are removed when maintainers review the data.

## Before you start

- By contributing, you agree to the terms in [LICENSE](LICENSE): your
  contribution may be used by the maintainers, and the data may not be reused
  elsewhere.
- Cite **press coverage**: news articles about the layoff. The company's own
  site, blog, investor relations, regulatory filings, press-release wires
  (Business Wire, PR Newswire, GlobeNewswire), LinkedIn or X posts and archived
  copies are refused by the check. Link the press article that reports them.
- Take every number from a linked article. Don't estimate or round up, and
  leave out a field the articles don't state.
- Don't add personal data about employees.

## Files

```
companies/<company>.json   a company and all its layoff events, newest first
icons/<company>.<ext>      the company's icon (png, jpg, gif, webp, svg or ico)
trusted-domains.json       press outlets the site marks as trusted
rejected.json              imported events that were turned down (never re-added)
schema/*.schema.json       JSON Schema of each file (generated, don't edit)
```

Slugs are lowercase words joined by hyphens (`scale-ai`). The file name is the
company's slug. Don't rename existing files or change an event's `id`: links on
the site depend on them.

Before adding a company, search `companies/` to see if it already exists.

Leave out a field you don't know instead of writing `null` or `""`. Unknown
fields are rejected, so check the spelling against the example. Links must
start with `https://` (or `http://`).

To run the same check as the pull request locally (Node 24):

```
npm ci
npm run validate
```

### `companies/<company>.json`

```json
{
  "name": "Acme",
  "industry": "Software",
  "hqCountry": "United States",
  "domain": "acme.com",
  "icon": "acme.png",
  "events": [
    {
      "id": "acme-2026-05-01",
      "date": "2026-05-01",
      "headcount": 120,
      "percent": 8,
      "country": "United States",
      "reason": "cost_cutting",
      "sources": [
        { "url": "https://www.reuters.com/business/..." }
      ]
    }
  ]
}
```

- Required for the company: `name` and `events`. Optional: `industry`,
  `hqCountry`, `domain` (the official site, a bare domain like `acme.com`) and
  `icon` (a file name in `icons/`).
- `events` are sorted newest first.
- A new event's `id` is `<company>-<YYYY-MM-DD>`, then `-2`, `-3` for another
  event on the same day. Older events have UUIDs; keep them.
- `date` is when the layoff was announced or reported, `YYYY-MM-DD`.
- `headcount` is the number of jobs cut (a whole number above 100). `percent` is
  the share of the workforce (0 to 100), only when an article states it.
- `country` is the country the cuts happened in, written out in English
  (`United States`, `Germany`).
- `reason` is one of `cost_cutting`, `restructuring`, `ai_automation`,
  `market_downturn`, `acquisition`, `other`.
- `sources` needs at least one press link. `title`, `description`, `image` and
  `siteName` are the link preview; maintainers' tools fill them in, so you can
  leave them out.
- `dataset` and `externalId` are set by import tools. Don't add them by hand.

### `trusted-domains.json`

```json
[
  { "domain": "reuters.com", "label": "Reuters", "region": "Global" }
]
```

Outlets with editorial standards only, never platforms where anyone can post.
Sorted by `region`, then `label`.

## Pull requests

- One event (or one fix) per PR.
- Fill in the PR template, including the press links.
- Keep formatting as in the example: 2-space indent, keys in the order shown,
  and a trailing newline.
