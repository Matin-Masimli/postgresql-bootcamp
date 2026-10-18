// Verifies every topic source link (and every link inside explanations/prompts) resolves.
//   npm run check:links
import { TOPIC_CONTENT } from '../content/index.ts';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 PostgreSQLBootcampLinkCheck/1.0';
const TIMEOUT_MS = 20_000;
const RETRIES = 3;

const links = new Map<string, string[]>();
const add = (url: string, where: string) => links.set(url, [...(links.get(url) ?? []), where]);
for (const t of TOPIC_CONTENT) {
  for (const s of t.sources) add(s.url, `topic ${t.id} sources`);
  const texts = [t.explanation, ...t.questions.flatMap((q) => [q.prompt, q.explanation, ...q.hints])];
  for (const text of texts) for (const m of text.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)) add(m[1], `topic ${t.id} text`);
}

async function check(url: string): Promise<{ ok: boolean; status: string }> {
  let last = '';
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': UA, accept: 'text/html,*/*' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      await res.body?.cancel();
      if (res.ok) return { ok: true, status: `${res.status}${res.redirected ? ` → ${res.url}` : ''}` };
      last = `HTTP ${res.status}`;
      if (res.status === 404 || res.status === 410) break; // definitive
    } catch (e) {
      last = (e as Error).message;
    }
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
  return { ok: false, status: last };
}

const results = await Promise.all([...links.keys()].map(async (url) => ({ url, ...(await check(url)) })));
for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.url}  (${r.status})`);
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length} links checked, ${bad.length} broken.`);
for (const b of bad) console.error(`  ✗ ${b.url}: ${b.status}  [${links.get(b.url)!.join(', ')}]`);
if (bad.length) process.exit(1);
