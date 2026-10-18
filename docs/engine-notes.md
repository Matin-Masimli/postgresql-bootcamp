# Engine notes (PGlite 0.5.10 spike findings, 2026-10-18)

Facts verified empirically in Node against `@electric-sql/pglite@0.5.10`. Re-verify these if PGlite is upgraded.

| Topic | Finding | Consequence |
|---|---|---|
| Server version | PostgreSQL **18.6** (wasm32, emscripten) | Docs links target `/docs/18/` or `/docs/current/` |
| `statement_timeout` | **Never fires**: neither `pg_sleep(4)` nor a CPU-bound `generate_series` is cancelled | The browser engine needs a watchdog that terminates the Web Worker and restarts from the snapshot |
| Default TimeZone | Inherits the host's zone (e.g. `Etc/GMT-4`) | Snapshots set `ALTER DATABASE postgres SET timezone = 'UTC'` and `datestyle = 'ISO, YMD'`; both survive dump/load |
| Parsers | A Proxy as `parsers` is ignored. An explicit `{ [oid]: v => v }` map built from `pg_type` returns canonical PG text for every type (`t`, `{1,2}`, `1e-07`, `2024-02-29 23:30:00+00`) | The checker gets identity parsers for all oids |
| `exec()` with several statements | Runs as **one implicit transaction**, so `VACUUM` inside it fails. Results come one per statement, and `affectedRows` is cumulative | Submissions are split and run statement by statement |
| User `COMMIT` inside our `BEGIN` | Commits for real | Transaction control in submissions is rejected |
| Errors | A `DatabaseError` with `message`, `code`, `position` (string, 1-based), `detail`, `hint` | Feedback maps `position` to an editor highlight |
| dump/load | 50k-row table: dump about 0.6 s, `loadDataDir` about 0.4 s, `clone()` about 0.3 s (Node) | |
| Snapshot size | The empty datadir gzips to **4.5 MB**: a 16 MB WAL segment (1.5 MB gz) plus `template0`/`template1` (about 1 MB gz each) | At build time: drop both templates, then `CHECKPOINT; pg_switch_wal(); CHECKPOINT` twice with `wal_recycle=off`. The empty baseline becomes **1.05 MB**, and the result reloads and stays writable |
| `loadDataDir` input | Accepts gzipped **or** plain tar Blobs | Safe even if a server auto-decompresses `.tar.gz` |
| Sequences | Non-transactional, so `ROLLBACK` does not undo `nextval` | Before each graded run, reset identity sequences to their snapshot values |
| Huge results | `query()` materialises every row before returning: a 5M-row cross join crashed the Node test worker (OOM, exit 134) | Row-returning statements run as `DECLARE … NO SCROLL CURSOR` + `FETCH 50001`, so at most 50k+1 rows reach JS; error positions are shifted back by the prefix length |
| Runtime size | `pglite.wasm` 10.5 MB + `pglite.data` 6.2 MB (uncompressed) | Most of the first-load cost; cached by the browser afterwards |
