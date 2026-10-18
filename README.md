# PostgreSQL Bootcamp: Zero to Hero

A self-paced course that teaches PostgreSQL by having you write real SQL against a real PostgreSQL 18 database, which runs entirely in your browser via [PGlite](https://pglite.dev) (PostgreSQL compiled to WebAssembly). There is no server, no account and no cost. Progress is saved in your browser, and you can export or import it.

**Live app:** https://matin-masimli.github.io/postgresql-bootcamp/

## What's inside

- **21 topics** in learning order, from `SELECT` to window functions, recursive CTEs and views. Each topic has an explanation with runnable examples, 3–6 checked source links, and a printable handbook.
- **339 questions** at four levels (easy, medium, hard, interview) and of four types:
  - *write a query*: the most common type;
  - *fix the query*: a broken starter to repair;
  - *predict the output*: choose the right result table;
  - *concept*: multiple choice.
- **Automatic checking.** Your answer runs on the practice database and then on a hidden database with different data, so a hard-coded answer doesn't pass. DDL and DML answers are checked by what they *do*: the checker inserts test rows, tries to break constraints, and inspects the catalog.
- **Mixed review** (spaced repetition of questions you got wrong), a **final exam**, a free **Playground**, the **schema** with an ER diagram, and **progress** tracking.

## The practice database

An online store and its company:

- **Shop:** customers, orders, order items, payments, shipments, returns, reviews, products, categories (a tree) and suppliers.
- **Company:** employees (a hierarchy) and salary history.
- **Other:** user logins and a messy staging import table.

The data is generated deterministically from a seed, with a reference date of **2025-06-30**:

- the main dataset has about 59k rows;
- the hidden dataset has about 36k rows.

The generator deliberately plants edge cases: ties, NULLs, daylight-saving boundaries, an empty department, discontinued products, duplicate e-mails and more. 74 assertions in the test suite check that these edge cases exist.

## Run it locally

You need Node.js 24 or later.

```bash
npm ci
```

```bash
npm run build:db
```

```bash
npm run dev
```

Then open http://localhost:5173. `build:db` writes the two database snapshots to `public/db/`. They are generated, not committed.

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Typecheck and production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run build:db` | Generate the main and hidden database snapshots |
| `npm test` | The full quality gate (see below) |
| `npm run check:links` | Check every source link in the content |
| `npm run sql -- "<query>" [--main]` | Run a query against both datasets from the terminal, for authoring |

## Quality gate

`npm test` must pass before content is published. It checks:

- **Content shape:** the schema validates, ids are unique, related topics are earlier topics, and every complete topic has 15–20 questions and 3–6 sources.
- **Reference solutions:** each runs on both datasets, returns rows, and gives a different result on the hidden data.
- **Accepted and rejected answers:** the reference and every alternative solution are accepted, and **every listed wrong answer is rejected** on the practice data.
- **Query rules:** ordered questions have an `ORDER BY`, and no non-deterministic functions are used.
- **Predict-the-output questions:** exactly the marked option matches the real result on both datasets.
- **Examples:** every SQL example in an explanation runs.
- **Engine and generator:** the generator's edge-case assertions hold, and the checker, sandbox and progress store have their own tests.

## How it works

- `src/db/`: a Web Worker hosts PGlite and loads a gzipped snapshot.
  - A watchdog restarts the worker if a query runs too long, because `statement_timeout` doesn't fire in PGlite.
- `src/engine/`: the sandbox and the checker.
  - Every Run or Check is wrapped in `BEGIN … ROLLBACK` and fetched through a cursor, so at most 50k rows come back.
  - Statements are run one by one.
  - Results are compared as multisets or sets, or in order, with numeric tolerance and NULL handling.
- `content/`: topics and questions as typed TypeScript objects, validated with zod.
- `scripts/db/`: the schema, the seeded data generator, the edge-case assertions and the snapshot builder.
- `docs/engine-notes.md`: PGlite behaviour that the engine depends on.

## Deployment

`.github/workflows/deploy.yml` runs on every push to `main`. It builds the databases, runs the quality gate, builds the app and publishes `dist/` to GitHub Pages. Pull requests run the same checks without deploying. The app uses a relative base path and hash routing, so it works under any repository name.
