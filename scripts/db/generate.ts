// Deterministic data generator: generate({ seed, scale }) → rows for every table.
// Same seed + scale → byte-identical output. No Math.random(), no wall clock, no locale APIs.
// Deliberate edge cases are marked `EDGE:` and asserted after loading by edge-cases.ts.

import { Rng, WeightedIndex } from './rng.ts';
import * as L from './lookups.ts';

export type Cell = string | null;
export interface TableData { columns: string[]; rows: Cell[][] }
export type Dataset = Record<string, TableData>;
export interface GenerateOptions {
  seed: string;
  /** Multiplier for customer-driven volume (customers, orders, logins, staging). */
  scale: number;
  /** Insert rows in shuffled physical order (hidden dataset), so unordered queries can't pass by luck. */
  shufflePhysicalOrder: boolean;
}

export const TABLE_ORDER = [
  'countries', 'categories', 'departments', 'suppliers', 'products', 'employees', 'salary_history',
  'customers', 'orders', 'order_items', 'payments', 'shipments', 'returns', 'reviews', 'user_logins',
  'staging_customer_import',
] as const;

// ───────────── time & formatting helpers (all UTC, epoch ms) ─────────────
const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const at = (iso: string) => Date.parse(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
const START = at(L.DATA_START);
/** Exclusive upper bound: nothing happens after 2025-06-30 23:59:59 UTC. */
const END = at(L.REFERENCE_DATE) + DAY;
const LOGIN_START = at(L.LOGIN_TRACKING_START);
const dayStart = (t: number) => Math.floor(t / DAY) * DAY;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const fDate = (t: number | null): Cell => (t == null ? null : new Date(t).toISOString().slice(0, 10));
const fTs = (t: number | null): Cell =>
  t == null ? null : `${new Date(Math.floor(t / 1000) * 1000).toISOString().slice(0, 19).replace('T', ' ')}+00`;
const fNum = (n: number | null, dp: number): Cell => (n == null ? null : n.toFixed(dp));
const fCents = (c: number | null): Cell => (c == null ? null : (c / 100).toFixed(2));
const fInt = (n: number | null): Cell => (n == null ? null : String(n));
const fBool = (b: boolean): Cell => (b ? 't' : 'f');
const cents = (n: number) => Math.round((n + Number.EPSILON) * 100);

/** ASCII-fold a name for e-mail addresses. */
function asciiFold(s: string): string {
  return s
    .replace(/ø/g, 'o').replace(/Ø/g, 'O').replace(/ł/g, 'l').replace(/Ł/g, 'L').replace(/ı/g, 'i').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z]/g, '')
    .toLowerCase();
}

function poisson(rng: Rng, lambda: number): number {
  if (lambda > 30) return Math.max(0, Math.round(rng.normal(lambda, Math.sqrt(lambda))));
  const l = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do { k++; p *= rng.float(); } while (p > l);
  return k - 1;
}

/** Local hour-of-day distribution for shopping/logins (peaks at lunch and evening). */
const HOUR_WEIGHTS: [number, number][] = [
  [0, 2], [1, 1], [2, 0.5], [3, 0.3], [4, 0.3], [5, 0.5], [6, 1.5], [7, 3], [8, 4], [9, 5], [10, 5], [11, 6],
  [12, 7], [13, 6], [14, 5], [15, 5], [16, 5], [17, 6], [18, 7], [19, 9], [20, 10], [21, 9], [22, 6], [23, 4],
];
/** UTC instant for a local wall-clock time on the given UTC day (fixed standard offset). */
function localToUtc(rng: Rng, day: number, offsetHours: number): number {
  const hour = rng.weighted(HOUR_WEIGHTS);
  return day + hour * HOUR + rng.int(0, 3599) * 1000 - offsetHours * HOUR;
}

const seasonFactor = (t: number) => [0.8, 0.85, 0.95, 0.95, 1, 0.95, 0.9, 0.95, 1, 1.05, 1.5, 1.7][new Date(t).getUTCMonth()];
const growthFactor = (t: number) => 0.7 + (0.6 * (t - START)) / (END - START);

// ───────────── entity types ─────────────
interface Supplier { id: number; name: string; brand: string | null; countryId: number; email: string | null; rating: number | null; createdAt: number; active: boolean; publisher: boolean }
interface Product {
  id: number; sku: string; name: string; categoryId: number; supplierId: number | null; priceC: number; costC: number | null;
  weight: number | null; launched: number; discontinued: number | null; oldPriceC: number | null; priceChange: number | null;
  popularity: number; neverSold: boolean; quality: number; region: string;
}
interface Employee {
  id: number; first: string; last: string; email: string; title: string; deptId: number | null; managerId: number | null;
  level: number; hire: number; term: number | null; salary: number; commission: number | null;
}
interface Customer {
  id: number; first: string; last: string; email: string | null; phone: string | null; birth: number | null; gender: string | null;
  city: string | null; countryId: number | null; tz: string | null; signup: number; optIn: boolean; referredBy: number | null;
  segment: 'none' | 'light' | 'regular' | 'heavy'; cleanFirst: string; cleanLast: string; offset: number;
}
interface Line { id: number; orderId: number; lineNo: number; product: Product; qty: number; unitC: number; discMilli: number }
interface Order {
  id: number; customer: Customer; repId: number | null; at: number; status: string; channel: string; shipCountryId: number | null;
  feeC: number; coupon: string | null; shippedAt: number | null; deliveredAt: number | null; lines: Line[]; method: string;
  forceCancelled?: boolean;
}
interface Payment { orderId: number; at: number; method: string; amountC: number; status: string }
interface Shipment { orderId: number; carrier: string; tracking: string | null; shippedAt: number; deliveredAt: number | null; costC: number | null }
interface Return { lineId: number; at: number; reason: string | null; qty: number; refundC: number | null; status: string }
interface Review { productId: number; customerId: number | null; rating: number; title: string | null; body: string | null; at: number; votes: number }
interface Login { customerId: number; at: number; device: string; ip: string | null; success: boolean }

/** Exact line value in 1/1000 cents (integer), matching SQL quantity * unit_price * (1 - discount). */
const lineMilliCents = (l: Line) => l.unitC * l.qty * (1000 - l.discMilli);
/** Order value in cents = ROUND(SUM(line values) + shipping_fee, 2), half away from zero like PostgreSQL. */
const orderTotalC = (o: Order) => Math.round((o.lines.reduce((s, l) => s + lineMilliCents(l), 0) + o.feeC * 1000) / 1000);

export function generate({ seed, scale, shufflePhysicalOrder }: GenerateOptions): Dataset {
  const root = new Rng(seed);
  const R = {
    suppliers: root.fork('suppliers'), products: root.fork('products'), employees: root.fork('employees'),
    customers: root.fork('customers'), orders: root.fork('orders'), fulfil: root.fork('fulfil'),
    returns: root.fork('returns'), reviews: root.fork('reviews'), logins: root.fork('logins'),
    staging: root.fork('staging'), edges: root.fork('edges'), physical: root.fork('physical'),
  };
  const countryById = new Map(L.COUNTRIES.map((c) => [c.id, c]));

  // ───────────── suppliers ─────────────
  const suppliers: Supplier[] = [];
  {
    const rng = R.suppliers;
    const brands = rng.shuffle(L.BRANDS).slice(0, 21);
    const suffixes = ['Trading', 'Supply Co.', 'Industries', 'Wholesale', 'GmbH', 'Ltd', 'Manufacturing', 'Imports', 'Goods'];
    const supplierCountries = L.COUNTRIES.filter((c) => c.weight > 0 || c.iso === 'LU'); // EDGE: Luxembourg has a supplier but no customers
    const entries = [
      ...brands.map((b) => ({ brand: b as string | null, name: `${b} ${rng.pick(suffixes)}`, publisher: false })),
      ...L.PUBLISHERS.map((p) => ({ brand: null, name: p, publisher: true })),
    ];
    const created = rng.shuffle(entries.map((_, i) => i));
    entries.forEach((e, i) => {
      const slug = e.name.toLowerCase().replace(/[^a-z]+/g, '');
      const emailRoll = rng.float();
      suppliers.push({
        id: 0, name: e.name, brand: e.brand, publisher: e.publisher,
        countryId: i === 0 ? 22 : rng.pick(supplierCountries).id,
        email: emailRoll < 0.1 ? null : emailRoll < 0.2 ? `Sales@${slug}.example` : `sales@${slug}.example`,
        rating: rng.chance(0.2) ? null : rng.int(20, 50) / 10,
        createdAt: at('2018-01-01') + created[i] * 50 * DAY + rng.int(0, 40) * DAY,
        active: true,
      });
    });
    suppliers.sort((a, b) => a.createdAt - b.createdAt);
    suppliers.forEach((s, i) => (s.id = i + 1));
    // EDGE: three brand suppliers have no products.
    for (const s of rng.sample(suppliers.filter((s) => !s.publisher), 3)) s.active = false;
  }

  // ───────────── products ─────────────
  const products: Product[] = [];
  {
    const rng = R.products;
    const leaves = L.LEAF_CATEGORIES.filter((c) => !L.EMPTY_LEAF_SLUGS.includes(c.slug));
    const counts = new Map(leaves.map((c) => [c.id, 7]));
    for (let i = 0; i < 300 - leaves.length * 7; i++) {
      const c = rng.pick(leaves);
      counts.set(c.id, counts.get(c.id)! + 1);
    }
    const codes = new Map<number, string>();
    const usedCodes = new Set<string>();
    for (const c of leaves) {
      const letters = c.slug.replace(/-/g, '').toUpperCase();
      let code = letters.slice(0, 3);
      for (let k = 3; usedCodes.has(code); k++) code = letters.slice(0, 2) + letters[k % letters.length];
      usedCodes.add(code);
      codes.set(c.id, code);
    }
    const brandSuppliers = suppliers.filter((s) => s.active && !s.publisher);
    const publishers = suppliers.filter((s) => s.publisher);
    const models = ['X1', 'X2', 'Pro', 'Plus', 'Mini', 'Max', 'S', '300', '500', 'Air', 'Lite', 'II', 'Neo', 'One'];
    const names = new Set<string>();
    for (const c of leaves) {
      const spec = L.LEAF_PRODUCTS[c.slug];
      const isBook = L.rootOf(c.id).slug === 'books';
      const leafSuppliers = isBook ? publishers : rng.sample(brandSuppliers, rng.int(2, 3));
      const n = counts.get(c.id)!;
      const titles = rng.shuffle(spec.nouns);
      for (let i = 0; i < n; i++) {
        const supplier = rng.chance(0.03) ? null : rng.pick(leafSuppliers);
        let name: string;
        let band: [number, number] = [spec.min, spec.max];
        if (isBook) {
          const base = titles[i % titles.length];
          const round = Math.floor(i / titles.length);
          name = round === 0 ? base : `${base} (${['2nd', '3rd', '4th', '5th'][round - 1] ?? `${round + 1}th`} ed.)`;
        } else {
          const brand = supplier?.brand && rng.chance(0.75) ? supplier.brand : rng.pick(L.BRANDS);
          const noun = rng.pick(spec.nouns);
          band = L.NOUN_PRICE[noun] ?? band;
          name = `${brand} ${noun}`;
          if (rng.chance(0.6) || names.has(name)) name += ` ${rng.pick(models)}`;
          while (names.has(name)) name += ` ${rng.pick(models)}`;
        }
        names.add(name);
        const price = L.snapPrice(Math.exp(Math.log(band[0]) + rng.float() * (Math.log(band[1]) - Math.log(band[0]))));
        const launched = rng.chance(0.18)
          ? at('2019-01-01') + rng.int(0, 729) * DAY
          : at('2021-01-01') + rng.int(0, 1611) * DAY; // up to 2025-05-31
        let discontinued: number | null = null;
        if (rng.chance(0.12)) {
          const d = launched + rng.int(180, 900) * DAY;
          discontinued = d <= at('2025-06-20') ? d : null;
        }
        let oldPriceC: number | null = null;
        let priceChange: number | null = null;
        if (launched < at('2023-06-01') && rng.chance(0.3)) {
          const old = L.snapPrice(price * (0.82 + rng.float() * 0.13));
          if (old < price) {
            oldPriceC = cents(old);
            priceChange = at('2023-01-01') + rng.int(0, 729) * DAY;
          }
        }
        products.push({
          id: 0, sku: '', name, categoryId: c.id, supplierId: supplier?.id ?? null,
          priceC: cents(price), costC: rng.chance(0.05) ? null : cents(price * (0.35 + rng.float() * 0.37)),
          weight: rng.chance(0.08) ? null : Math.round((spec.weight[0] + rng.float() * (spec.weight[1] - spec.weight[0])) * 1000) / 1000,
          launched, discontinued, oldPriceC, priceChange, popularity: 0, neverSold: false,
          quality: Math.min(4.8, Math.max(2.2, rng.normal(4.0, 0.45))), region: L.rootOf(c.id).slug,
        });
      }
    }
    // Ids follow launch order; SKUs are per-category sequences.
    products.sort((a, b) => a.launched - b.launched || a.name.localeCompare(b.name));
    const seqByCat = new Map<number, number>();
    products.forEach((p, i) => {
      p.id = i + 1;
      const seq = (seqByCat.get(p.categoryId) ?? 0) + 1;
      seqByCat.set(p.categoryId, seq);
      p.sku = `${codes.get(p.categoryId)}-${String(1000 + seq * 7 + rng.int(0, 6))}`;
    });
    // Popularity: Zipf over a random ranking, cheaper items sell more units.
    rng.shuffle(products).forEach((p, rank) => {
      const cheap = p.priceC < 5000 ? 1.6 : p.priceC < 20000 ? 1.2 : 0.8;
      p.popularity = cheap / Math.pow(rank + 3, 0.85);
    });
    // EDGE: ~5% of products (launched well before the end) are never sold.
    for (const p of rng.sample(products.filter((p) => p.launched < at('2024-06-01')), 15)) {
      p.neverSold = true;
      p.popularity = 0;
    }
    // EDGE: a premium product (price ≥ 1000) that has been discontinued.
    const premium = products.filter((p) => p.priceC >= 100_000 && !p.neverSold && p.discontinued == null && p.launched < at('2023-06-01'));
    const gone = premium[Math.floor(premium.length / 2)];
    gone.discontinued = gone.launched + rng.int(400, 700) * DAY;
    // EDGE: the two most expensive laptops share the same list price (tie at the top of a category).
    const laptops = products.filter((p) => L.CATEGORIES[p.categoryId - 1].slug === 'laptops').sort((a, b) => b.priceC - a.priceC);
    laptops[1].priceC = laptops[0].priceC;
    if (laptops[1].oldPriceC != null && laptops[1].oldPriceC >= laptops[1].priceC) laptops[1].oldPriceC = null;
  }

  // ───────────── employees & salary history ─────────────
  const employees: Employee[] = [];
  const salaryRows: Cell[][] = [];
  {
    const rng = R.employees;
    const dept = (name: string) => L.DEPARTMENTS.find((d) => d.name === name)!.id;
    const usedEmails = new Set<string>();
    const add = (level: number, deptId: number | null, managerId: number | null, title: string, hireRange: [string, string]): Employee => {
      const female = rng.chance(0.48);
      const first = rng.pick(female ? L.FIRST_NAMES_F : L.FIRST_NAMES_M);
      const last = rng.pick(L.LAST_NAMES);
      const band = L.LEVELS[level - 1].band;
      const lo = at(hireRange[0]);
      const hi = at(hireRange[1]);
      const e: Employee = {
        id: employees.length + 1, first, last, email: '', title, deptId, managerId, level,
        hire: lo + rng.int(0, Math.floor((hi - lo) / DAY)) * DAY, term: null,
        salary: Math.round((band[0] + rng.float() * (band[1] - band[0])) / 500) * 500, commission: null,
      };
      employees.push(e);
      return e;
    };
    const ceo = add(1, dept('Executive'), null, 'Chief Executive Officer', ['2012-05-14', '2012-05-14']);
    add(5, dept('Executive'), ceo.id, 'Executive Assistant', ['2016-01-01', '2023-12-31']);
    add(5, dept('Executive'), ceo.id, 'Chief of Staff', ['2015-01-01', '2020-12-31']);
    const structure: [string, number, number[], number][] = [
      // department, directors, managers per director (or VP when no directors), staff
      ['Sales', 2, [2, 2], 28],
      ['Engineering', 2, [2, 2], 22],
      ['Customer Support', 1, [2], 12],
      ['Operations', 1, [2], 8],
      ['Marketing', 1, [1], 6],
      ['Finance', 0, [1], 4],
      ['Human Resources', 0, [1], 2],
      ['Procurement', 0, [1], 2],
    ];
    for (const [name, directors, managersPer, staff] of structure) {
      const d = dept(name);
      const vp = add(2, d, ceo.id, `VP of ${name}`, ['2012-09-01', '2018-12-31']);
      const managers: Employee[] = [];
      if (directors === 0) {
        for (let m = 0; m < managersPer[0]; m++) managers.push(add(4, d, vp.id, `${name} Manager`, ['2015-01-01', '2023-06-30']));
      } else {
        for (let k = 0; k < directors; k++) {
          const dir = add(3, d, vp.id, `Director of ${name}`, ['2014-01-01', '2021-12-31']);
          for (let m = 0; m < managersPer[k]; m++) managers.push(add(4, d, dir.id, `${name} Manager`, ['2015-01-01', '2023-06-30']));
        }
      }
      for (let s = 0; s < staff; s++) {
        add(5, d, managers[s % managers.length].id, rng.pick(L.STAFF_TITLES[name]), ['2016-01-01', '2025-05-31']);
      }
    }
    // EDGE: two contractors with no department.
    const opsManagers = employees.filter((e) => e.deptId === dept('Operations') && e.level === 4);
    add(5, null, opsManagers[0].id, 'Contractor', ['2023-01-01', '2025-03-31']);
    add(5, null, opsManagers[1].id, 'Contractor', ['2024-01-01', '2025-05-31']);

    // Commission for sales staff (two newer reps have none yet).
    const salesId = dept('Sales');
    for (const e of employees) {
      if (e.deptId === salesId && e.level >= 3) e.commission = rng.int(4, 20) * 5 / 1000;
    }
    const salesStaff = employees.filter((e) => e.deptId === salesId && e.level === 5).sort((a, b) => b.hire - a.hire);
    salesStaff[0].commission = null;
    salesStaff[1].commission = null;

    // Terminations: ~12% of staff, plus one manager whose reports still point at them.
    for (const e of employees) {
      if (e.level === 5 && rng.chance(0.12)) {
        const t = e.hire + rng.int(120, 2400) * DAY;
        if (t < at('2025-06-15')) e.term = t;
      }
    }
    const termManager = employees.find((e) => e.level === 4 && e.deptId === dept('Customer Support'))!;
    termManager.term = at('2024-09-30');

    // EDGE: hire on a leap day; identical names; salary ties.
    employees.filter((e) => e.level === 5 && e.deptId === dept('Engineering') && e.term == null)[0].hire = at('2020-02-29');
    const pair = employees.filter((e) => e.level === 5 && e.term == null);
    pair[3].first = pair[40].first = 'Daniel';
    pair[3].last = pair[40].last = 'Kim';
    const salesDirectors = employees.filter((e) => e.deptId === salesId && e.level === 3);
    salesDirectors[1].salary = salesDirectors[0].salary;
    const engStaff = employees.filter((e) => e.deptId === dept('Engineering') && e.level === 5).sort((a, b) => b.salary - a.salary);
    engStaff[1].salary = engStaff[0].salary;

    for (const e of employees) {
      let local = `${asciiFold(e.first)}.${asciiFold(e.last)}`;
      for (let n = 2; usedEmails.has(local); n++) local = `${asciiFold(e.first)}.${asciiFold(e.last)}${n}`;
      usedEmails.add(local);
      e.email = `${local}@${L.COMPANY_DOMAIN}`;
    }

    // Salary history, built backwards from the current salary.
    let decreaseDone = false;
    for (const e of employees) {
      const stop = e.term ?? END;
      const changes: number[] = [];
      const hireYear = new Date(e.hire).getUTCFullYear();
      for (let y = hireYear + 1; ; y++) {
        const t = at(`${y}-04-01`);
        if (t >= stop) break;
        if (rng.chance(0.7)) changes.push(t);
      }
      const periods: { from: number; salary: number; reason: string }[] = [];
      let s = e.salary;
      for (let i = changes.length - 1; i >= 0; i--) {
        const promo = rng.chance(0.15);
        let reason = promo ? 'promotion' : rng.chance(0.08) ? 'market adjustment' : 'annual review';
        let prev = Math.round(s / (1 + (promo ? 0.08 + rng.float() * 0.07 : 0.02 + rng.float() * 0.04)) / 500) * 500;
        if (prev >= s) prev = s - 500;
        if (!decreaseDone && e.level === 5 && i === changes.length - 1 && changes.length >= 3) {
          // EDGE: one salary decrease.
          prev = s + 2000;
          reason = 'role change';
          decreaseDone = true;
        }
        periods.unshift({ from: changes[i], salary: s, reason });
        s = prev;
      }
      periods.unshift({ from: e.hire, salary: s, reason: 'hire' });
      periods.forEach((p, i) => {
        const to = i + 1 < periods.length ? periods[i + 1].from - DAY : e.term;
        salaryRows.push([fInt(e.id), fDate(p.from), fDate(to), fCents(p.salary * 100), p.reason]);
      });
    }
  }
  const salesReps = employees.filter((e) => e.deptId === 2 && e.level >= 4);

  // ───────────── customers ─────────────
  const customers: Customer[] = [];
  {
    const rng = R.customers;
    const n = Math.round(2000 * scale);
    const countryPicker = L.COUNTRIES.filter((c) => c.weight > 0).map((c) => [c, c.weight] as const);
    const signupEnd = at('2025-06-28');
    for (let i = 0; i < n; i++) {
      const female = rng.chance(0.5);
      const first = rng.pick(female ? L.FIRST_NAMES_F : L.FIRST_NAMES_M);
      const last = rng.pick(L.LAST_NAMES);
      const country = rng.chance(0.02) ? null : rng.weighted(countryPicker);
      const signup = START + Math.floor(Math.pow(rng.float(), 0.75) * (signupEnd - START));
      const tz = country == null ? null : rng.chance(0.05) ? null : rng.chance(0.7) ? country.zones[0] : rng.pick(country.zones);
      const age = 18 + Math.floor(Math.abs(rng.normal(0, 1)) * 16 + rng.float() * 8);
      const segRoll = rng.float();
      const recent = signup > at('2025-03-01');
      customers.push({
        id: 0, first, last, cleanFirst: first, cleanLast: last, email: null, phone: null,
        birth: rng.chance(0.15) ? null : dayStart(signup - age * 365.25 * DAY - rng.int(0, 364) * DAY),
        gender: rng.chance(0.08) ? null : rng.chance(0.012) ? 'X' : female ? 'F' : 'M',
        city: country == null || rng.chance(0.06) ? null : rng.pick(country.cities),
        countryId: country?.id ?? null, tz, signup, optIn: rng.chance(0.4), referredBy: null,
        segment: segRoll < (recent ? 0.3 : 0.08) ? 'none' : segRoll < 0.55 ? 'light' : segRoll < 0.86 ? 'regular' : 'heavy',
        offset: L.ZONE_OFFSET[tz ?? country?.tz ?? 'Europe/London'] ?? 0,
      });
    }
    customers.sort((a, b) => a.signup - b.signup);
    customers.forEach((c, i) => (c.id = i + 1));

    // Referrals: earlier customers refer later ones; referred customers refer more often → chains.
    const referred: Customer[] = [];
    for (const c of customers.slice(20)) {
      if (!rng.chance(0.15)) continue;
      const pool = referred.length > 5 && rng.chance(0.4) ? referred : customers.slice(0, c.id - 1);
      c.referredBy = rng.pick(pool).id;
      referred.push(c);
    }
    // EDGE: a referral chain at least 5 levels deep.
    const chain = rng.sample(customers.slice(50, customers.length - 50), 5).sort((a, b) => a.signup - b.signup);
    for (let i = 1; i < chain.length; i++) chain[i].referredBy = chain[i - 1].id;

    // EDGE: identical full names (two pairs) and a Feb-29 birthday.
    customers[100].first = customers[700 * scale | 0].first = 'Maria';
    customers[100].last = customers[700 * scale | 0].last = 'Garcia';
    customers[150].first = customers[151].first = 'Liam';
    customers[150].last = customers[151].last = 'Murphy';
    for (const k of [100, 700 * scale | 0, 150, 151]) {
      customers[k].cleanFirst = customers[k].first;
      customers[k].cleanLast = customers[k].last;
    }
    customers[42].birth = at('2000-02-29');

    // Contact details.
    for (const c of customers) {
      const f = asciiFold(c.first);
      const l = asciiFold(c.last);
      if (!rng.chance(0.08)) {
        const local = rng.weighted([
          [`${f}.${l}`, 5], [`${f[0]}${l}`, 2], [`${f}_${l}${rng.int(1, 99)}`, 2], [`${f}${rng.int(1970, 2006)}`, 1],
        ] as const);
        let email = `${local}@${rng.weighted(L.EMAIL_DOMAINS)}`;
        const style = rng.float();
        if (style < 0.06) email = email[0].toUpperCase() + email.slice(1);
        else if (style < 0.09) email = email.toUpperCase();
        else if (style < 0.11) email = `${email} `;
        c.email = email;
      }
      if (!rng.chance(0.12)) {
        const dial = c.countryId ? countryById.get(c.countryId)!.dial : '44';
        const digits = String(rng.int(200, 999)) + String(rng.int(100, 999)) + String(rng.int(1000, 9999));
        c.phone = rng.weighted([
          [`+${dial} ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`, 4],
          [`(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`, 2],
          [`${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`, 2],
          [digits, 2],
          [`00${dial}${digits}`, 1],
          [`+${dial}-${digits}`, 1],
        ] as const);
      }
      // Messy name capitalisation and whitespace.
      const roll = rng.float();
      if (roll < 0.05) c.first = c.first.toUpperCase();
      else if (roll < 0.1) c.first = c.first.toLowerCase();
      else if (roll < 0.14) c.first = ` ${c.first}`;
      else if (roll < 0.18) c.first = `${c.first}  `;
      const roll2 = rng.float();
      if (roll2 < 0.04) c.last = c.last.toUpperCase();
      else if (roll2 < 0.08) c.last = c.last.toLowerCase();
      else if (roll2 < 0.11) c.last = `${c.last} `;
      if (c.city && rng.chance(0.04)) c.city = c.city.toLowerCase();
      else if (c.city && rng.chance(0.03)) c.city = `${c.city} `;
    }
    // EDGE: two pairs of e-mails differing only in case/whitespace (same person registered twice).
    for (const [a, b] of [[200, 900 * scale | 0], [300, 1300 * scale | 0]]) {
      const base = `${asciiFold(customers[a].cleanFirst)}.${asciiFold(customers[a].cleanLast)}@gmail.com`;
      customers[a].email = base;
      customers[b].email = base[0].toUpperCase() + base.slice(1);
      customers[b].first = customers[a].cleanFirst;
      customers[b].last = customers[a].cleanLast;
      customers[b].cleanFirst = customers[a].cleanFirst;
      customers[b].cleanLast = customers[a].cleanLast;
    }
  }

  // ───────────── orders & order items ─────────────
  const orders: Order[] = [];
  {
    const rng = R.orders;
    const methods = [['card', 58], ['paypal', 20], ['bank_transfer', 7], ['gift_card', 5], ['wallet', 10]] as const;
    const lineCounts = [[1, 45], [2, 28], [3, 15], [4, 7], [5, 3], [6, 2]] as const;
    const qtys = [[1, 70], [2, 18], [3, 6], [4, 3], [5, 2], [10, 1]] as const;
    const rate = { none: 0, light: 0.8, regular: 2.3, heavy: 6.5 } as const;
    const couponDiscount: Record<string, number> = { WELCOME10: 100, SPRING15: 150, SUMMER20: 200, BLACKFRIDAY: 250, VIP25: 250, FREESHIP: 0 };
    const sellable = products.filter((p) => !p.neverSold);

    for (const c of customers) {
      if (c.segment === 'none') continue;
      const years = (END - c.signup) / (365.25 * DAY);
      const k = Math.max(1, poisson(rng, rate[c.segment] * years));
      for (let i = 0; i < k; i++) {
        let t: number;
        if (i === 0 && rng.chance(0.4)) {
          t = c.signup + rng.int(10, 14 * 24 * 60) * MIN;
        } else {
          let day: number;
          do {
            day = dayStart(c.signup) + rng.int(0, Math.floor((END - c.signup) / DAY)) * DAY;
          } while (rng.float() * 2.3 > seasonFactor(day) * growthFactor(day));
          t = localToUtc(rng, day, c.offset);
        }
        if (t <= c.signup) t = c.signup + rng.int(10, 120) * MIN;
        if (t >= END) t = END - rng.int(1, 600) * MIN;
        if (t <= c.signup) continue;
        orders.push({
          id: 0, customer: c, repId: null, at: t, status: '', channel: '', shipCountryId: null, feeC: 0, coupon: null,
          shippedAt: null, deliveredAt: null, lines: [], method: rng.weighted(methods),
        });
      }
    }

    // EDGE: leap-day, month-end and year-end timestamps.
    const near = (iso: string, days: number) =>
      orders.filter((o) => Math.abs(o.at - at(iso)) < days * DAY && o.customer.signup < at(iso) - DAY);
    for (const o of near('2024-02-29T12:00:00Z', 6).slice(0, 4)) o.at = at('2024-02-29') + (o.at % DAY);
    const pin = (iso: string, target: string) => {
      const o = near(iso, 10).find((x) => x.at !== at(target));
      if (o) o.at = at(target);
    };
    pin('2024-01-31T12:00:00Z', '2024-01-31T23:59:59Z');
    pin('2023-12-31T12:00:00Z', '2023-12-31T23:30:00Z');
    pin('2024-04-30T12:00:00Z', '2024-04-30T23:45:00Z');
    pin('2023-02-28T12:00:00Z', '2023-02-28T22:10:00Z');
    pin('2024-03-31T12:00:00Z', '2024-03-31T01:30:00Z'); // EU DST switch night

    orders.sort((a, b) => a.at - b.at || a.customer.id - b.customer.id);
    orders.forEach((o, i) => (o.id = i + 1));

    let lineId = 0;
    for (const o of orders) {
      const c = o.customer;
      const year = new Date(o.at).getUTCFullYear();
      o.channel = rng.weighted([['web', 50], ['mobile', year >= 2023 ? 36 : 22], ['phone', 8], ['marketplace', 12]] as const);
      const activeReps = salesReps.filter((e) => e.hire <= o.at && (e.term == null || e.term >= o.at));
      if (activeReps.length && (o.channel === 'phone' || ((o.channel === 'web' || o.channel === 'mobile') && rng.chance(0.1)))) {
        o.repId = rng.pick(activeReps).id;
      }
      o.shipCountryId = c.countryId == null || rng.chance(0.05)
        ? rng.weighted(L.COUNTRIES.filter((x) => x.weight > 0).map((x) => [x.id, x.weight] as const))
        : c.countryId;
      if (rng.chance(0.01)) o.shipCountryId = null;
      if (o.channel !== 'marketplace' && rng.chance(0.15)) o.coupon = rng.weighted(L.COUPONS);
      const couponKey = o.coupon?.trim().toUpperCase().replace('-', '') ?? null;
      const couponDisc = couponKey != null ? couponDiscount[couponKey] ?? 0 : null;

      const eligible = sellable.filter((p) => p.launched <= o.at && (p.discontinued == null || p.discontinued + DAY > o.at));
      const picker = new WeightedIndex(eligible, eligible.map((p) => p.popularity));
      const nLines = Math.min(rng.weighted(lineCounts), eligible.length);
      const chosen = new Set<Product>();
      while (chosen.size < nLines) chosen.add(picker.pick(rng));
      let lineNo = 0;
      for (const p of chosen) {
        const unitC = p.oldPriceC != null && p.priceChange != null && o.at < p.priceChange ? p.oldPriceC : p.priceC;
        const disc = couponDisc ?? (rng.chance(0.15) ? rng.weighted([[50, 5], [100, 6], [150, 3], [200, 3], [250, 1], [500, 0.5]] as const) : 0);
        o.lines.push({
          id: ++lineId, orderId: o.id, lineNo: ++lineNo, product: p,
          qty: p.priceC < 3000 ? rng.weighted(qtys) : rng.chance(0.9) ? 1 : 2, unitC, discMilli: disc,
        });
      }
      const subtotalC = Math.round(o.lines.reduce((s, l) => s + lineMilliCents(l), 0) / 1000);
      const region = o.shipCountryId ? countryById.get(o.shipCountryId)!.region : 'Europe';
      o.feeC = o.channel === 'marketplace' || couponKey === 'FREESHIP' || subtotalC >= 5000
        ? 0
        : region === 'Europe' ? 499 : region === 'North America' ? 799 : 999;
    }

    // EDGE: two pairs of single-order customers with identical baskets → tied lifetime spend.
    const singles = customers.filter((c) => orders.filter((o) => o.customer === c).length === 1);
    const byCustomer = (c: Customer) => orders.find((o) => o.customer === c)!;
    for (const [a, b] of [[singles[5], singles[6]], [singles[20], singles[21]]]) {
      const src = byCustomer(a);
      const dst = byCustomer(b);
      const valid = src.lines.every((l) => l.product.launched <= dst.at && (l.product.discontinued == null || l.product.discontinued + DAY > dst.at));
      if (!valid) continue;
      dst.lines = src.lines.map((l, i) => ({ ...l, id: dst.lines[i]?.id ?? ++lineId, orderId: dst.id }));
      dst.feeC = src.feeC;
    }
    // Renumber lines in order sequence (dst baskets may have changed line counts).
    lineId = 0;
    for (const o of orders) for (const l of o.lines) l.id = ++lineId;

    // EDGE: one regular customer whose every order was cancelled.
    const threeOrders = customers.find((c) => c.id > 100 && orders.filter((o) => o.customer === c).length === 3);
    for (const o of orders) if (o.customer === threeOrders) o.forceCancelled = true;
  }

  // ───────────── fulfilment: payments, shipments, statuses ─────────────
  const payments: Payment[] = [];
  const shipments: Shipment[] = [];
  {
    const rng = R.fulfil;
    const carriersFor = (region: string) =>
      region === 'North America' ? ['UPS', 'FedEx', 'USPS'] : region === 'Europe' ? ['DHL', 'DPD', 'PostNL', 'Royal Mail', 'UPS'] : ['DHL', 'FedEx', 'UPS'];
    for (const o of orders) {
      const total = orderTotalC(o);
      const region = o.shipCountryId ? countryById.get(o.shipCountryId)!.region : 'Europe';
      const failedFirst = rng.chance(0.04);
      const payDelay = o.method === 'bank_transfer' ? rng.int(20, 72) * HOUR : rng.int(1, 300) * 1000;
      const payAt = o.at + payDelay + (failedFirst ? 5 * MIN : 0);
      const stuck = o.at < END - 30 * DAY && rng.chance(0.002);

      if (payAt >= END || stuck || (END - o.at < 2 * DAY && rng.chance(0.03))) {
        o.status = 'pending';
        if (o.method !== 'bank_transfer' && rng.chance(0.4)) payments.push({ orderId: o.id, at: o.at + 2 * MIN, method: o.method, amountC: total, status: 'failed' });
        continue;
      }
      if (failedFirst) payments.push({ orderId: o.id, at: o.at + rng.int(1, 4) * MIN, method: 'card', amountC: total, status: 'failed' });
      const captured: Payment[] = [];
      if (total > 6000 && rng.chance(0.03)) {
        const gift = rng.pick([2500, 5000]);
        captured.push({ orderId: o.id, at: payAt, method: 'gift_card', amountC: gift, status: 'captured' });
        captured.push({ orderId: o.id, at: payAt + rng.int(5, 60) * 1000, method: 'card', amountC: total - gift, status: 'captured' });
      } else {
        captured.push({ orderId: o.id, at: payAt, method: o.method, amountC: total, status: 'captured' });
      }

      const cancelAt = payAt + rng.int(1, 36) * HOUR;
      if ((o.forceCancelled || rng.chance(0.065)) && cancelAt < END) {
        o.status = 'cancelled';
        if (!o.forceCancelled && rng.chance(0.25)) continue; // cancelled before the charge went through
        payments.push(...captured);
        for (const p of captured) payments.push({ ...p, at: cancelAt + rng.int(1, 120) * MIN, status: 'refunded' });
        continue;
      }
      payments.push(...captured);

      const processing = (rng.int(8, 72) + ([0, 6].includes(new Date(payAt).getUTCDay()) ? 36 : 0)) * HOUR;
      const ship1 = payAt + processing;
      if (ship1 >= END) {
        o.status = 'processing';
        continue;
      }
      const carriers = carriersFor(region);
      const parcelTimes = [ship1];
      if (o.lines.length >= 2 && rng.chance(0.08)) {
        const ship2 = ship1 + rng.int(1, 5) * DAY + rng.int(0, 600) * MIN;
        if (ship2 < END) parcelTimes.push(ship2);
      }
      let allDelivered = true;
      let lastDelivery = 0;
      for (const s of parcelTimes) {
        const carrier = rng.pick(carriers);
        const transit = (region === 'Europe' ? rng.int(1, 4) : region === 'North America' ? rng.int(2, 6) : rng.int(4, 12)) * DAY + rng.int(0, 600) * MIN;
        let delivered: number | null = s + transit;
        if (delivered >= END || rng.chance(0.004)) delivered = null; // in transit, or lost
        if (delivered == null) allDelivered = false;
        else lastDelivery = Math.max(lastDelivery, delivered);
        shipments.push({
          orderId: o.id, carrier, shippedAt: s, deliveredAt: delivered,
          tracking: rng.chance(0.03) ? null : `${carrier.replace(/\s/g, '').slice(0, 3).toUpperCase()}${rng.int(100000000, 999999999)}${rng.int(100, 999)}`,
          costC: rng.chance(0.05) ? null : rng.int(350, 2500),
        });
      }
      o.shippedAt = ship1;
      o.deliveredAt = allDelivered ? lastDelivery : null;
      o.status = allDelivered ? 'delivered' : 'shipped';
    }

    // EDGE: a handful of delivered orders whose captured amount doesn't match the order value.
    const delivered = orders.filter((o) => o.status === 'delivered');
    for (const o of rng.sample(delivered, Math.max(3, Math.round(delivered.length * 0.002)))) {
      const p = payments.find((x) => x.orderId === o.id && x.status === 'captured')!;
      p.amountC -= rng.int(1, 500);
    }
  }

  // ───────────── returns (and refund payments) ─────────────
  const returns: Return[] = [];
  {
    const rng = R.returns;
    for (const o of orders) {
      if (o.status !== 'delivered' || o.deliveredAt == null || !rng.chance(0.06)) continue;
      const reqAt = o.deliveredAt + rng.int(1, 30) * DAY + rng.int(0, 1439) * MIN;
      if (reqAt >= END) continue;
      const full = rng.chance(0.6);
      const lines = full ? o.lines : [rng.pick(o.lines)];
      let allRefunded = true;
      for (const l of lines) {
        const qty = full || l.qty === 1 ? l.qty : rng.int(1, l.qty);
        let status: string = END - reqAt < 5 * DAY ? 'requested' : rng.weighted([['refunded', 70], ['approved', 8], ['rejected', 22]] as const);
        const refundAt = reqAt + rng.int(3, 10) * DAY;
        if (status === 'refunded' && refundAt >= END) status = 'approved';
        const valueC = Math.round((l.unitC * qty * (1000 - l.discMilli)) / 1000);
        returns.push({
          lineId: l.id, at: reqAt, qty, status,
          reason: rng.chance(0.06) ? null : rng.weighted(L.RETURN_REASONS),
          refundC: status === 'refunded' || status === 'approved' ? valueC : null,
        });
        if (status === 'refunded') {
          const method = payments.find((p) => p.orderId === o.id && p.status === 'captured')?.method ?? 'card';
          payments.push({ orderId: o.id, at: refundAt, method, amountC: valueC, status: 'refunded' });
        }
        if (status !== 'refunded' || qty !== l.qty) allRefunded = false;
      }
      if (full && allRefunded) o.status = 'returned';
    }
  }

  // ───────────── reviews ─────────────
  const reviews: Review[] = [];
  {
    const rng = R.reviews;
    const returnedLines = new Set(returns.map((r) => r.lineId));
    const write = (p: Product, customerId: number | null, t: number, returned: boolean) => {
      let rating = Math.round(rng.normal(p.quality - (returned ? 1.5 : 0), 1.0));
      rating = Math.min(5, Math.max(1, rating));
      let title: string | null = rng.chance(0.15) ? null : rng.pick(L.REVIEW_TITLES[rating]);
      if (title && rng.chance(0.04)) title = title.toUpperCase();
      let body: string | null = null;
      if (rng.chance(0.72)) {
        const pool = [...L.REVIEW_BODY_PARTS[rating], ...L.REVIEW_BODY_PARTS[Math.max(1, rating - 1)]];
        body = rng.sample(pool, rng.int(1, 3)).join(' ');
        if (rng.chance(0.03)) body = body.replace('. ', '.  ');
        if (rng.chance(0.03)) body = `${body} `;
      }
      const votes = rng.chance(0.02) ? rng.int(20, 150) : rng.geometric(1.5);
      reviews.push({ productId: p.id, customerId, rating, title, body, at: t, votes });
    };
    for (const o of orders) {
      if ((o.status !== 'delivered' && o.status !== 'returned') || o.deliveredAt == null) continue;
      for (const l of o.lines) {
        if (!rng.chance(0.13)) continue;
        const t = o.deliveredAt + rng.int(2, 45) * DAY + rng.int(0, 1439) * MIN;
        if (t >= END) continue;
        write(l.product, rng.chance(0.03) ? null : o.customer.id, t, returnedLines.has(l.id));
        // EDGE (~1%): the same customer reviews the same product again later.
        if (rng.chance(0.01)) {
          const t2 = t + rng.int(20, 200) * DAY;
          if (t2 < END) write(l.product, o.customer.id, t2, false);
        }
      }
    }
    // Unverified reviews: reviewer never bought the product.
    const unverified = Math.round(reviews.length * 0.02);
    for (let i = 0; i < unverified; i++) {
      const c = rng.pick(customers);
      const p = rng.pick(products);
      const t = Math.max(c.signup, p.launched) + rng.int(1, 400) * DAY;
      if (t < END) write(p, c.id, t, false);
    }
    // EDGE: a never-sold product that nevertheless has a review.
    const ns = products.find((p) => p.neverSold)!;
    write(ns, customers[10].id, Math.max(customers[10].signup, ns.launched) + 30 * DAY, false);
    reviews.sort((a, b) => a.at - b.at);
  }

  // ───────────── logins ─────────────
  const logins: Login[] = [];
  {
    const rng = R.logins;
    const devices = ['desktop', 'ios', 'android', 'tablet'] as const;
    const ipFor = (r: Rng) => r.chance(0.08)
      ? `2001:db8::${r.int(1, 0xffff).toString(16)}`
      : `${r.pick(['192.0.2', '198.51.100', '203.0.113', '10.0.0'])}.${r.int(1, 254)}`;
    const addDay = (c: Customer, day: number, device: string, ip: string | null, forcedTimes?: number[]) => {
      const times = forcedTimes ?? Array.from({ length: rng.weighted([[1, 70], [2, 22], [3, 8]] as const) }, () => localToUtc(rng, day, c.offset));
      for (const t of times) {
        if (t <= c.signup || t >= END || t < LOGIN_START) continue;
        if (rng.chance(0.06)) logins.push({ customerId: c.id, at: t - rng.int(1, 5) * MIN, device, ip, success: false });
        logins.push({ customerId: c.id, at: t, device, ip, success: true });
      }
    };
    const engaged = customers.filter((c) => c.segment !== 'none' ? rng.chance(0.32) : rng.chance(0.1));
    const streakCustomers = new Set(rng.sample(engaged.filter((c) => c.signup < at('2023-06-01')), 3));
    for (const c of engaged) {
      if (streakCustomers.has(c)) continue;
      const device = rng.pick(devices);
      const ip = rng.chance(0.03) ? null : ipFor(rng);
      const gapMean = c.segment === 'heavy' ? 30 : c.segment === 'regular' ? 75 : 160;
      let day = dayStart(Math.max(c.signup, LOGIN_START)) + rng.int(0, 30) * DAY;
      while (day < END) {
        const streak = rng.geometric(1.8, 1);
        for (let k = 0; k < streak && day < END; k++, day += DAY) addDay(c, day, rng.chance(0.85) ? device : rng.pick(devices), ip);
        day += rng.geometric(gapMean, 1) * DAY;
      }
    }
    // EDGE: designed streaks. Two customers tie on a 21-day streak spanning the leap day;
    // a third logs in just before midnight UTC, so its UTC-date and local-date streaks differ.
    const [s1, s2, s3] = [...streakCustomers];
    for (const [c, from, len] of [[s1, '2024-02-15', 21], [s2, '2024-02-20', 21], [s3, '2024-05-01', 14]] as const) {
      for (let k = 0; k < len; k++) {
        const day = at(from) + k * DAY;
        // Pinned UTC times so the streak length in UTC dates is exact.
        const times = c === s3
          ? [day + 23 * HOUR + rng.int(30, 58) * MIN]
          : Array.from({ length: rng.int(1, 2) }, () => day + rng.int(11 * 60, 14 * 60) * MIN);
        addDay(c, day, 'desktop', '203.0.113.7', times);
      }
      // Some ordinary activity too, outside the streak window.
      for (let k = 0; k < 6; k++) addDay(c, at('2023-03-01') + rng.int(0, 300) * DAY, 'ios', null);
    }
    logins.sort((a, b) => a.at - b.at || a.customerId - b.customerId);
  }

  // ───────────── staging_customer_import ─────────────
  const stagingRows: Cell[][] = [];
  {
    const rng = R.staging;
    const files: { name: string; at: number; fmt: 'mon' | 'iso' | 'dmy' }[] = [
      { name: 'legacy_dump.csv', at: at('2023-11-15T09:30:00Z'), fmt: 'mon' },
      { name: 'crm_export_2024_01.csv', at: at('2024-02-01T06:00:00Z'), fmt: 'iso' },
      { name: 'crm_export_2024_02.csv', at: at('2024-03-01T06:00:00Z'), fmt: 'dmy' },
    ];
    const n = Math.round(700 * scale);
    const base: Cell[][] = [];
    const mess = (s: string) => rng.weighted([[s, 6], [s.toUpperCase(), 1], [s.toLowerCase(), 1], [` ${s}`, 1], [`${s}  `, 1], [s.replace(' ', '  '), 1]] as const);
    const fmtDateRaw = (t: number, fmt: string) => {
      const d = new Date(t);
      const dd = String(d.getUTCDate()).padStart(2, '0');
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      if (fmt === 'iso') return `${d.getUTCFullYear()}-${mm}-${dd}`;
      if (fmt === 'dmy') return `${dd}/${mm}/${d.getUTCFullYear()}`;
      return `${MONTHS[d.getUTCMonth()]} ${dd}, ${d.getUTCFullYear()}`;
    };
    while (base.length < Math.round(n * 0.78)) {
      const file = rng.weighted([[files[0], 3], [files[1], 4], [files[2], 4]] as const);
      const known = customers.filter((c) => c.signup < file.at);
      const fromCustomer = rng.chance(0.7) && known.length > 0;
      const c = fromCustomer ? rng.pick(known) : null;
      const first = c?.cleanFirst ?? rng.pick(rng.chance(0.5) ? L.FIRST_NAMES_F : L.FIRST_NAMES_M);
      const last = c?.cleanLast ?? rng.pick(L.LAST_NAMES);
      const country = c?.countryId ? countryById.get(c.countryId)! : rng.pick(L.COUNTRIES.filter((x) => x.weight > 0));
      const signup = c?.signup ?? file.at - rng.int(10, 900) * DAY;
      const ltv = rng.int(0, 450000);
      const fullName = file.fmt === 'mon' && rng.chance(0.5) ? `${last}, ${first}` : `${first} ${last}`;
      const emailBase = c?.email?.trim().toLowerCase() ?? `${asciiFold(first)}.${asciiFold(last)}@${rng.weighted(L.EMAIL_DOMAINS)}`;
      const email = rng.chance(0.08) ? null : rng.chance(0.02) ? rng.pick(['n/a', '', `${asciiFold(first)}@`]) : rng.chance(0.15) ? emailBase.toUpperCase() : emailBase;
      const phone = c?.phone ?? (rng.chance(0.3) ? null : `+${country.dial} ${rng.int(200, 999)} ${rng.int(1000000, 9999999)}`);
      const dateRaw = rng.chance(0.04) ? '' : rng.chance(0.03) ? null : rng.chance(0.01) ? 'unknown' : fmtDateRaw(signup, file.fmt);
      const countryRaw = rng.chance(0.05) ? null : file.fmt === 'mon' ? mess(country.name) : rng.chance(0.85) ? country.iso : country.iso.toLowerCase();
      const ltvRaw = rng.chance(0.05) ? 'n/a' : rng.chance(0.03) ? '' : file.fmt === 'mon'
        ? `$${Math.floor(ltv / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${String(ltv % 100).padStart(2, '0')}`
        : (ltv / 100).toFixed(2);
      base.push([file.name, fTs(file.at), mess(fullName), email, phone, dateRaw, countryRaw, ltvRaw]);
    }
    const rows: Cell[][] = [...base];
    while (rows.length < n) {
      const src = rng.pick(base);
      if (rng.chance(0.6)) {
        rows.push([...src]); // exact duplicate (re-imported row)
      } else {
        // Near duplicate: same person in the same export, typed with different case/whitespace.
        // (Kept in the same file so each file's date/money format stays consistent.)
        rows.push([src[0], src[1], src[2] ? mess(src[2].trim()) : null, src[3] ? (rng.chance(0.5) ? src[3].toUpperCase() : ` ${src[3]}`) : null, src[4], src[5], src[6], src[7]]);
      }
    }
    // Physical file order: by file, then shuffled within the file.
    const ordered = files.flatMap((f) => rng.shuffle(rows.filter((r) => r[0] === f.name)));
    ordered.forEach((r, i) => stagingRows.push([String(i + 1), ...r]));
  }

  // ───────────── assemble tables ─────────────
  const ds: Dataset = {
    countries: {
      columns: ['country_id', 'iso_code', 'name', 'region', 'currency', 'default_timezone'],
      rows: L.COUNTRIES.map((c) => [fInt(c.id), c.iso, c.name, c.region, c.currency, c.tz]),
    },
    categories: {
      columns: ['category_id', 'parent_id', 'name', 'slug'],
      rows: L.CATEGORIES.map((c) => [fInt(c.id), fInt(c.parent), c.name, c.slug]),
    },
    departments: {
      columns: ['department_id', 'name', 'location', 'budget'],
      rows: L.DEPARTMENTS.map((d) => [fInt(d.id), d.name, d.location, fNum(d.budget, 2)]),
    },
    suppliers: {
      columns: ['supplier_id', 'name', 'country_id', 'contact_email', 'rating', 'created_at'],
      rows: suppliers.map((s) => [fInt(s.id), s.name, fInt(s.countryId), s.email, fNum(s.rating, 1), fDate(s.createdAt)]),
    },
    products: {
      columns: ['product_id', 'sku', 'name', 'category_id', 'supplier_id', 'price', 'cost', 'weight_kg', 'launched_at', 'discontinued_at'],
      rows: products.map((p) => [fInt(p.id), p.sku, p.name, fInt(p.categoryId), fInt(p.supplierId), fCents(p.priceC), fCents(p.costC), fNum(p.weight, 3), fDate(p.launched), fDate(p.discontinued)]),
    },
    employees: {
      columns: ['employee_id', 'first_name', 'last_name', 'email', 'job_title', 'department_id', 'manager_id', 'hire_date', 'termination_date', 'salary', 'commission_pct'],
      rows: employees.map((e) => [fInt(e.id), e.first, e.last, e.email, e.title, fInt(e.deptId), fInt(e.managerId), fDate(e.hire), fDate(e.term), fCents(e.salary * 100), fNum(e.commission, 3)]),
    },
    salary_history: {
      columns: ['employee_id', 'effective_from', 'effective_to', 'salary', 'change_reason'],
      rows: salaryRows,
    },
    customers: {
      columns: ['customer_id', 'first_name', 'last_name', 'email', 'phone', 'birth_date', 'gender', 'city', 'country_id', 'timezone', 'signup_at', 'marketing_opt_in', 'referred_by'],
      rows: customers.map((c) => [fInt(c.id), c.first, c.last, c.email, c.phone, fDate(c.birth), c.gender, c.city, fInt(c.countryId), c.tz, fTs(c.signup), fBool(c.optIn), fInt(c.referredBy)]),
    },
    orders: {
      columns: ['order_id', 'customer_id', 'sales_rep_id', 'ordered_at', 'status', 'channel', 'ship_country_id', 'shipping_fee', 'coupon_code', 'shipped_at', 'delivered_at'],
      rows: orders.map((o) => [fInt(o.id), fInt(o.customer.id), fInt(o.repId), fTs(o.at), o.status, o.channel, fInt(o.shipCountryId), fCents(o.feeC), o.coupon, fTs(o.shippedAt), fTs(o.deliveredAt)]),
    },
    order_items: {
      columns: ['order_item_id', 'order_id', 'line_no', 'product_id', 'quantity', 'unit_price', 'discount'],
      rows: orders.flatMap((o) => o.lines.map((l) => [fInt(l.id), fInt(o.id), fInt(l.lineNo), fInt(l.product.id), fInt(l.qty), fCents(l.unitC), (l.discMilli / 1000).toFixed(3)])),
    },
    payments: {
      columns: ['payment_id', 'order_id', 'paid_at', 'method', 'amount', 'status'],
      rows: payments.sort((a, b) => a.at - b.at || a.orderId - b.orderId).map((p, i) => [fInt(i + 1), fInt(p.orderId), fTs(p.at), p.method, fCents(p.amountC), p.status]),
    },
    shipments: {
      columns: ['shipment_id', 'order_id', 'carrier', 'tracking_number', 'shipped_at', 'delivered_at', 'shipping_cost'],
      rows: shipments.sort((a, b) => a.shippedAt - b.shippedAt || a.orderId - b.orderId).map((s, i) => [fInt(i + 1), fInt(s.orderId), s.carrier, s.tracking, fTs(s.shippedAt), fTs(s.deliveredAt), fCents(s.costC)]),
    },
    returns: {
      columns: ['return_id', 'order_item_id', 'requested_at', 'reason', 'quantity', 'refund_amount', 'status'],
      rows: returns.sort((a, b) => a.at - b.at || a.lineId - b.lineId).map((r, i) => [fInt(i + 1), fInt(r.lineId), fTs(r.at), r.reason, fInt(r.qty), fCents(r.refundC), r.status]),
    },
    reviews: {
      columns: ['review_id', 'product_id', 'customer_id', 'rating', 'title', 'body', 'created_at', 'helpful_votes'],
      rows: reviews.map((r, i) => [fInt(i + 1), fInt(r.productId), fInt(r.customerId), fInt(r.rating), r.title, r.body, fTs(r.at), fInt(r.votes)]),
    },
    user_logins: {
      columns: ['login_id', 'customer_id', 'logged_in_at', 'device', 'ip_address', 'success'],
      rows: logins.map((l, i) => [fInt(i + 1), fInt(l.customerId), fTs(l.at), l.device, l.ip, fBool(l.success)]),
    },
    staging_customer_import: {
      columns: ['import_row_id', 'source_file', 'imported_at', 'full_name', 'email', 'phone', 'signup_date_raw', 'country_raw', 'lifetime_value_raw'],
      rows: stagingRows,
    },
  };

  if (shufflePhysicalOrder) {
    for (const name of TABLE_ORDER) ds[name].rows = R.physical.shuffle(ds[name].rows);
  }
  return ds;
}
