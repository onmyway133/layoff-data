# layoff-data

Tech layoff data: companies, layoff events and the press articles they come
from, one JSON file per company. It powers [layoffmap.com](https://layoffmap.com).
We list layoffs of more than 100 people.

Every merged pull request is published to the site automatically. Want to add a
layoff, fix a number or report a broken link? See
[CONTRIBUTING.md](CONTRIBUTING.md), or open an [issue](../../issues/new/choose).

## Layout

```
companies/<company>.json   a company and all its layoff events, newest first
icons/<company>.<ext>      the company's icon
trusted-domains.json       press outlets the site marks as trusted
rejected.json              imported events that were turned down (never re-added)
schema/*.schema.json       JSON Schema of each file (generated)
scripts/validate.mjs       the pull request check (`npm ci && npm run validate`)
```

`<company>` is the slug used in the site's links (`/companies/<company>`), so
file names never change. Each event keeps its `id`, which is its page on the
site (`/events/<id>`).

## Where the data comes from

Every event cites press coverage: news articles about the layoff, not the
company's own site, filings or posts. Events are never estimated or made up.

- `"dataset": "ai-layoffs-index"`: from the
  [AI Layoffs Index](https://ailayoffs.org), used under its
  [license](https://ailayoffs.org/license), which asks for attribution to the
  AI Layoffs Index and to each event's sources.
- `"dataset": "curated"`: researched by the maintainers from the linked
  articles.
- No `dataset`: added by contributors, or part of the 2022 to 2024 historical
  set compiled with reference to [layoffs.fyi](https://layoffs.fyi) (data free
  to use with attribution to layoffs.fyi).

## License

This data is **not** open. It is public only so you can contribute. You may not
copy, scrape, redistribute or use it in other products, or use it to train AI
models. Records from the AI Layoffs Index keep their own terms. See
[LICENSE](LICENSE).
