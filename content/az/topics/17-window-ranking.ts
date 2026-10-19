import type { TopicText } from '../../i18n.ts';

const explanation = `Ranking funksiyaları hər sətrə sətirlər qrupu daxilində **mövqe** verir: 1-ci, 2-ci, 3-cü… \`GROUP BY\`-dan fərqli olaraq, onlar sətirləri yığmır. Hər giriş sətri qalır və onun dərəcəsini saxlayan yeni sütun alır.

\`\`\`text
function() OVER ( [PARTITION BY expr, …]  ORDER BY expr [ASC|DESC] [NULLS FIRST|LAST], … )
\`\`\`

- \`OVER\`-in *içindəki* \`ORDER BY\` "birinci"nin nə demək olduğuna qərar verir. O, yalnız nəticəni sıralayan sorğunun son \`ORDER BY\`-ından ayrıdır.
- \`PARTITION BY\` nömrələməni hər qrup üçün yenidən başladır, məsələn, "*hər departament daxilində* dərəcə". Onsuz bütün nəticə bir partition-dur.

## ROW_NUMBER, RANK və DENSE_RANK

Üç funksiya yalnız **bərabərlikləri** (ORDER BY dəyərləri bərabər olan sətirlər, *peer-lər* adlanır) necə emal etmələri ilə fərqlənir:

| salary | ROW_NUMBER() | RANK() | DENSE_RANK() |
|---|---|---|---|
| 100 | 1 | 1 | 1 |
| 100 | 2 | 1 | 1 |
| 90  | 3 | 3 | 2 |
| 80  | 4 | 4 | 3 |

- **ROW_NUMBER**: həmişə 1, 2, 3, …, təkrar olmadan. Hər qrup üçün *düz* bir sətir (və ya düz N sətir) lazım olduqda işlədin.
- **RANK**: peer-lər dərəcəni paylaşır, növbəti dərəcə isə idman nəticələrində olduğu kimi irəli **atlayır** (1, 1, 3). "Bərabərliklər daxil olmaqla ilk 3" üçün işlədin.
- **DENSE_RANK**: peer-lər dərəcəni paylaşır, **boşluqsuz** (1, 1, 2). "2-ci ən yüksək *fərqli* dəyər" üçün işlədin.

Bizim iki noutbukumuz ən yüksək qiyməti paylaşır, ona görə də üç funksiya fərqli nəticə verir:

\`\`\`sql
SELECT p.product_id, p.name, p.price,
       ROW_NUMBER() OVER (ORDER BY p.price DESC) AS row_num,
       RANK()       OVER (ORDER BY p.price DESC) AS rnk,
       DENSE_RANK() OVER (ORDER BY p.price DESC) AS dense_rnk
FROM products p
JOIN categories c ON c.category_id = p.category_id
WHERE c.slug = 'laptops'
ORDER BY p.price DESC, p.product_id;
\`\`\`

> **Bərabərliklər və ROW_NUMBER.** İki sətir window-un ORDER BY-ında bərabər olduqda PostgreSQL onları istənilən şəkildə nömrələyə bilər və sıra işə salmalar və ya verilənlər arasında dəyişə bilər. ROW_NUMBER işlətdikdə həmişə unikal tie-breaker (adətən primary key) əlavə edin: \`ORDER BY price DESC, product_id\`.

## PARTITION BY: qruplar daxilində dərəcə

\`\`\`sql
-- Hər departament daxilində maaş mövqeyi (yalnız aktiv işçilər)
SELECT d.name AS department, e.first_name, e.last_name, e.salary,
       DENSE_RANK() OVER (PARTITION BY e.department_id ORDER BY e.salary DESC) AS salary_rank
FROM employees e
JOIN departments d ON d.department_id = e.department_id
WHERE e.termination_date IS NULL
ORDER BY department, salary_rank, e.employee_id;
\`\`\`

Təkrarlana bilən etiket üzrə yox, **açar** üzrə partition edin. Kateqoriya ağacımızda hər ikisi *Shoes* adlanan iki fərqli kateqoriya var (Men və Women). \`PARTITION BY c.name\` onları səssizcə birləşdirərdi, \`PARTITION BY p.category_id\` isə ayrı saxlayır.

## Dərəcə üzrə filtrləmə: "hər qrupda ilk N"

Window function-lar \`FROM\`, \`WHERE\`, \`GROUP BY\` və \`HAVING\`-dən **sonra**, son \`ORDER BY\`/\`LIMIT\`-dən isə dərhal əvvəl hesablanır. Ona görə də onları \`WHERE\`-də işlədə bilməzsiniz:

\`\`\`sql
-- ERROR:  window functions are not allowed in WHERE
SELECT * FROM products WHERE ROW_NUMBER() OVER (ORDER BY price DESC) <= 3;
\`\`\`

PostgreSQL-də \`QUALIFY\` bəndi yoxdur (bəzi digər verilənlər bazalarında var). Standart pattern dərəcəni daxili sorğuda hesablayır, sonra xarici sorğuda filtrləyir. Bu, **FROM-da subquery** və ya **CTE** tələb edir, 19-cu və 20-ci mövzular onları ətraflı əhatə edir. Hələlik bunu resept kimi qəbul edin:

\`\`\`sql
-- Resept 1: FROM-da subquery (alias lazımdır, burada "ranked")
SELECT category_id, product_id, name, price
FROM (
  SELECT p.*, ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY price DESC, product_id) AS pos
  FROM products p
  WHERE discontinued_at IS NULL
) AS ranked
WHERE pos <= 2
ORDER BY category_id, pos;
\`\`\`

\`\`\`sql
-- Resept 2: eynisi CTE ilə (WITH … AS), çox vaxt oxumaq daha asandır
WITH ranked AS (
  SELECT p.*, ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY price DESC, product_id) AS pos
  FROM products p
  WHERE discontinued_at IS NULL
)
SELECT category_id, product_id, name, price
FROM ranked
WHERE pos <= 2
ORDER BY category_id, pos;
\`\`\`

Filtri hara qoyduğunuz vacibdir. Daxili sorğunun **içindəki** şərt sətirləri dərəcələməzdən *əvvəl* silir. Eyni şərt **xarici** sorğuda isə sətirləri dərəcələmədən *sonra* silir, bu da qrupu 1-ci dərəcəli sətirsiz qoya bilər.

**"İlk N" üçün hansı funksiya?** "Ən bahalı 3 məhsul" düz 3 sətir deməkdir, ona görə də ROW_NUMBER işlədin. "Bərabərliklər daxil olmaqla qiyməti ilk 3-də olan hər şey" RANK ≤ 3 deməkdir. "İlk 3 *fərqli* qiymət" DENSE_RANK ≤ 3 deməkdir.

**"Hər qrupda ilk sətir" üçün PostgreSQL qısa yolu:** \`SELECT DISTINCT ON (customer_id) … ORDER BY customer_id, ordered_at DESC\` ORDER BY-a görə hər müştərinin ilk sətrini saxlayır. Yığcamdır, amma yalnız PostgreSQL-dədir. ROW_NUMBER hər yerdə işləyir və "ilk N"-i də emal edir.

## Qrupları dərəcələndirmək (aqreqat üzərində window)

Window-lar \`GROUP BY\`-dan sonra işlədiyi üçün aqreqasiya edilmiş dəyərləri birbaşa dərəcələndirə bilərsiniz:

\`\`\`sql
SELECT c.name AS country, count(cu.customer_id) AS customers,
       RANK() OVER (ORDER BY count(cu.customer_id) DESC) AS rnk
FROM countries c
LEFT JOIN customers cu ON cu.country_id = c.country_id
GROUP BY c.name
ORDER BY rnk, country;
\`\`\`

## NTILE, PERCENT_RANK və CUME_DIST

- **NTILE(n)** sıralanmış partition-u mümkün qədər bərabər olan *n* qrupa (bucket) bölür. Sətirlər bərabər bölünmədikdə **ilk** qruplar bir əlavə sətir alır (7 sətir 3-ə → 3, 2, 2). Peer-lər fərqli qruplara düşə bilər, ona görə də deterministik olsun deyə tie-breaker əlavə edin.
- **PERCENT_RANK()** = (dərəcə − 1) / (partition-dakı sətirlər − 1). O, 0-dan 1-ə qədər dəyişir, bir sətirlik partition isə 0 alır.
- **CUME_DIST()** = (cari sətrin peer-ləri daxil olmaqla ona qədər olan sətirlər) / (partition-dakı sətirlər). O, 1/N-dən 1-ə qədər dəyişir.

Hər ikisi \`double precision\` qaytarır. Yuvarlaqlaşdırmaq üçün numeric-ə cast edin: \`round(percent_rank() OVER (…)::numeric, 3)\`.

\`\`\`sql
SELECT x,
       NTILE(3)       OVER (ORDER BY x) AS bucket,
       PERCENT_RANK() OVER (ORDER BY x) AS pct_rank,
       CUME_DIST()    OVER (ORDER BY x) AS cume
FROM generate_series(1, 7) AS g(x);
\`\`\`

## Daha çox PostgreSQL qeydləri və tələlər

- Ranking funksiyaları **bigint** qaytarır. \`day - ROW_NUMBER() OVER (…)\` kimi tarix hesabı cast tələb edir: \`::int\`.
- **NULL-lar artan sırada sonda, azalan sırada isə əvvəldə sıralanır.** Ona görə də \`ORDER BY commission_pct DESC\` NULL komissiyaları birinci dərəcələndirir! \`NULLS LAST\` işlədin və ya onları filtrləyin.
- Window tərifini \`WINDOW\` bəndi ilə təkrar işlədin: \`… RANK() OVER w … WINDOW w AS (PARTITION BY department_id ORDER BY salary DESC)\`.
- Ranking funksiyaları istənilən frame bəndini (\`ROWS BETWEEN …\`) nəzərə almır. Frame-lər aqreqatlar və dəyər funksiyaları üçün vacibdir (16-cı və 18-ci mövzular).
- Window-un ORDER BY-ı nəticəni sıralamır. Sıra vacib olduqda həmişə sorğunun öz \`ORDER BY\`-ı ilə bitirin.

İstinad tarixini unutmayın: verilənlər **2025-06-30**-da bitir, ona görə də \`CURRENT_DATE\` əvəzinə literal tarixlər işlədin.`;

const topic: TopicText = {
  explanation,
  questions: {
    't17-q01': {
      title: 'Noutbukları qiymətə görə dərəcələndirin',
      prompt: `**Laptops kateqoriyasındakı hər məhsulu** (kateqoriya \`slug = 'laptops'\`, satışdan çıxarılanlar daxil olmaqla) qiymətə görə, ən bahalısı birinci, dərəcələndirin. Eyni qiymətli məhsullar dərəcəni paylaşır, növbəti dərəcə isə müvafiq olaraq atlayır (1, 1, 3, …).

- **Sütunlar:** \`product_id\`, \`name\`, \`price\`, \`price_rank\`
- **Sıralama:** \`price_rank\` üzrə, sonra \`product_id\`.`,
      hints: [
        'Noutbukları `products`-ı `categories` ilə join edib `slug` üzrə filtrləyərək tapın.',
        'Hansı ranking funksiyası bərabər qiymətlər arasında dərəcəni paylaşır *və* sonra boşluq qoyur?',
        '`RANK() OVER (ORDER BY p.price DESC) AS price_rank`',
      ],
      explanation: `1. **Noutbukları seçin:** \`products\`-ı \`categories\` ilə join edin və \`slug = 'laptops'\`-u saxlayın. Unikal slug üzrə filtrləmək ad üzrə filtrləməkdən daha etibarlıdır.
2. **Funksiyanı seçin:** bərabər qiymətlər dərəcəni paylaşmalı, növbəti dərəcə isə atlamalıdır. Bu, məhz \`RANK()\`-dır. \`DENSE_RANK()\` atlamazdı (1, 1, 2), \`ROW_NUMBER()\` isə heç vaxt paylaşmazdı (1, 2, 3).
3. **"Birinci"ni təyin edin:** \`OVER\` daxilində \`ORDER BY p.price DESC\` ən bahalı noutbuku 1-ci dərəcə edir.
4. **Nəticəni sıralayın:** window-un ORDER BY-ı nəticəni sıralamır, ona görə də \`ORDER BY price_rank, p.product_id\` ilə bitirin. \`product_id\` tie-breaker-i bərabər sətirlərin sırasını sabit edir.

İki noutbuk ən yüksək qiyməti paylaşır, ona görə də hər ikisi 1-ci dərəcə alır, növbəti noutbuk isə 3-cü dərəcədir.`,
      commonMistakes: [
        'Bərabər noutbuklara fərqli dərəcələr (1 və 2) verən ROW_NUMBER işlətmək.',
        'Bərabərlikdən sonrakı noutbuka 3 əvəzinə 2-ci dərəcə verən DENSE_RANK işlətmək.',
        'OVER daxilində artan sıralama, bu da ən ucuz noutbuku 1-ci dərəcə edir.',
      ],
    },
    't17-q02': {
      title: 'Bərabərliklə DENSE_RANK',
      prompt: `Dörd maaş ən yüksəkdən başlayaraq dərəcələndirilir: **100, 100, 90, 80**.

\`DENSE_RANK() OVER (ORDER BY salary DESC)\` həmin sıra ilə hansı ədədləri təyin edir?`,
      hints: ['DENSE_RANK peer-lərə eyni dərəcəni verir, sonra dərhal növbəti ədədlə davam edir. O, "fərqli dəyərləri sayır".'],
      explanation: `- İki 100 peer-dir, ona görə də hər ikisi **1** alır.
- DENSE_RANK-da **boşluq yoxdur**, ona görə də 90 **2**, 80 isə **3** alır.

Müqayisə üçün: \`RANK()\` 1, 1, 3, 4 verir (bərabərliyin işlətdiyi mövqeləri atlayır), \`ROW_NUMBER()\` isə 1, 2, 3, 4 verir (heç bir bərabərlik yoxdur). "1, 1, 2, 2" mümkün deyil, çünki 90 və 80 fərqli dəyərlərdir və dərəcəni paylaşa bilməz.`,
      commonMistakes: [
        'RANK (bərabərliklərdən sonra boşluqlar) ilə DENSE_RANK-ı (boşluqsuz) qarışdırmaq.',
        'Bərabərliklərin avtomatik həll olunduğunu düşünmək. ROW_NUMBER işlətməsəniz, onlar dərəcəni paylaşır.',
      ],
      options: ['1, 1, 3, 4', '1, 2, 3, 4', '1, 1, 2, 3', '1, 1, 2, 2'],
    },
    't17-q03': {
      title: 'Üç funksiya, bir bərabərlik',
      prompt: `İşə salmadan bu sorğunun nəticəsini təxmin edin.`,
      hints: [
        'Hər sütunu ayrıca hesablayın: ROW_NUMBER heç vaxt təkrarlanmır, RANK və DENSE_RANK isə bərabər dəyərlər üçün təkrarlanır.',
        '1-ci yer üçün bərabər iki sətirdən sonra RANK 3-dən, DENSE_RANK isə 2-dən davam edir.',
      ],
      explanation: `- **rn (ROW_NUMBER):** 1, 2, 3, 4. Hətta iki 30 da fərqli nömrələr alır. Hansı 30-un 1 alması təsadüfidir, amma nəticə hər halda eyni görünür.
- **rnk (RANK):** 30-lar **1**-i paylaşır. İki sətir 1 və 2 mövqelərini tutdu, ona görə də 20 **3**, 10 isə **4**-dür.
- **drnk (DENSE_RANK):** 30-lar **1**-i paylaşır, sonra 20 **2**, 10 isə **3**-dür, boşluqsuz.

\`(VALUES …) AS t(v)\` \`v\` adlı bir sütunlu kiçik daxili cədvəl qurur. Bu kimi təcrübələr üçün əlverişlidir.`,
      commonMistakes: [
        'Bərabər 30-lara eyni ROW_NUMBER vermək.',
        'Bərabərlikdən sonra RANK-ı 2-dən davam etdirmək, bu isə DENSE_RANK davranışıdır.',
        'İkinci 30-a fərqli RANK vermək. Peer-lər həmişə RANK və DENSE_RANK-ı paylaşır.',
      ],
    },
    't17-q04': {
      title: 'Hər müştərinin sifarişlərini nömrələyin',
      prompt: `\`customer_id\`-si **1-dən 5-ə qədər** olan müştərilər üçün hər müştərinin sifarişlərini verildikləri sıra ilə nömrələyin: onların ilk sifarişi 1, ikincisi 2 və s. Eyni müştərinin iki sifarişinin \`ordered_at\`-ı eynidirsə, daha kiçik \`order_id\` birinci gəlir. Bütün statusları daxil edin.

- **Sütunlar:** \`customer_id\`, \`order_id\`, \`ordered_at\`, \`order_number\`
- **Sıralama:** \`customer_id\` üzrə, sonra \`order_number\`.`,
      hints: [
        'Nömrələmə hər müştəri üçün yenidən başlamalıdır. OVER daxilində hansı bənd bunu edir?',
        'Bərabərliklər olsa belə, hər sifarişə fərqli nömrə lazımdır, ona görə də tie-breaker ilə ROW_NUMBER işlədin.',
        '`ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY ordered_at, order_id)`',
      ],
      explanation: `1. **Əvvəlcə filtrləyin:** \`WHERE customer_id BETWEEN 1 AND 5\`. WHERE window function-dan əvvəl işləyir, ona görə də yalnız bu müştərilərin sifarişləri nömrələnir.
2. **Hər müştəri üçün yenidən başladın:** \`PARTITION BY customer_id\` hər müştəri üçün yeni nömrələmə başladır.
3. **Ən köhnəsi birinci:** OVER daxilində \`ORDER BY ordered_at, order_id\`. \`order_id\` tie-breaker-i iki sifariş eyni vaxt dəyərini paylaşdıqda sabit sıraya zəmanət verir.
4. **Hər sifariş üçün düz bir nömrə:** \`ROW_NUMBER()\`. RANK iki sifarişə eyni nömrəni verə bilərdi.
5. **Nəticəni** müştəri, sonra yeni nömrə üzrə **sıralayın**.`,
      commonMistakes: [
        'PARTITION BY-ı unutmaq, ona görə də nömrələr müştərilər boyu saymağa davam edir.',
        'ordered_at DESC üzrə sıralamaq, bu da ən son sifarişi 1 kimi nömrələyir.',
        'Son nəticəni yalnız ordered_at üzrə sıralamaq. Tapşırığın istədiyi sütunları işlədin.',
      ],
    },
    't17-q05': {
      title: 'Hər departament daxilində maaş dərəcəsi',
      prompt: `HR hər **aktiv** işçinin (\`termination_date IS NULL\`) öz departamenti daxilində harada dayandığını görmək istəyir. Departamenti olmayan işçilər nəzərə alınmır.

Maaşa görə, ən yüksəyi birinci, dərəcələndirin. Bərabər maaşlar dərəcəni paylaşır və dərəcələrdə **boşluq yoxdur** (1, 2, 2, 3, …).

- **Sütunlar:** \`department\` (departamentin adı), \`employee_id\`, \`salary\`, \`salary_rank\`
- **Sıralama:** \`department\` üzrə, sonra \`salary_rank\`, sonra \`employee_id\`.`,
      hints: [
        '`employees`-i `departments` ilə join edin. Inner join departamenti olmayan işçiləri avtomatik atır.',
        '"Boşluqsuz" DENSE_RANK deməkdir. "Öz departamenti daxilində" PARTITION BY deməkdir.',
        '`DENSE_RANK() OVER (PARTITION BY e.department_id ORDER BY e.salary DESC)`',
      ],
      explanation: `1. **Sətirlər:** departamenti olan aktiv işçilər. \`JOIN departments\` (inner join) departamenti olmayan iki podratçını silir, \`WHERE termination_date IS NULL\` isə keçmiş işçiləri silir. Hər ikisi dərəcələmədən *əvvəl* baş verir, ona görə də keçmiş işçilər dərəcə mövqelərini tutmur.
2. **Qruplar:** \`PARTITION BY e.department_id\` hər departamenti ayrıca dərəcələndirir.
3. **Boşluqsuz:** \`DENSE_RANK()\`. Sales-də iki direktor eyni maaş alır. Hər ikisi 2-ci dərəcədir, növbəti maaş isə 3-cü dərəcədir. RANK ilə 4 olardı.
4. **Nəticə sırası:** departament adı, sonra dərəcə, bərabərlikdə isə işçi id-si.

\`d.name\` üzrə partition da burada işləyir, çünki departament adları unikaldır (UNIQUE məhdudiyyəti var). Açar üzrə partition yenə də daha etibarlı vərdişdir.`,
      commonMistakes: [
        'Bərabər Sales direktorlarından sonra boşluq qoyan RANK işlətmək.',
        'Bütün şirkəti bir siyahıda dərəcələndirən PARTITION BY-ı unutmaq.',
        'İşdən çıxmış işçiləri dərəcələmədən sonra filtrləmək (və ya heç filtrləməmək). Onda keçmiş işçilər dərəcə mövqelərini tutur.',
      ],
    },
    't17-q06': {
      title: 'Müştəri sayına görə ölkələr',
      prompt: `Heç müştərisi olmayanlar daxil olmaqla **bütün ölkələri** orada neçə müştərinin yaşamasına görə (\`customers.country_id\`) dərəcələndirin.

Eyni sayda müştərisi olan ölkələr dərəcəni paylaşır və dərəcələrdə boşluq yoxdur.

- **Sütunlar:** \`country\` (ölkənin adı), \`customers\` (müştərilərin sayı), \`popularity_rank\`
- **Sıralama:** \`popularity_rank\` üzrə, sonra \`country\`.`,
      hints: [
        'Müştərisi olmayan ölkələr də görünməlidir, ona görə də `countries`-dən LEFT JOIN ilə join edin.',
        'Boş ölkələr 0 alsın deyə `count(*)` yox, customers tərəfindən sütun sayın (`count(cu.customer_id)`).',
        'Window function aqreqatı dərəcələndirə bilər: `DENSE_RANK() OVER (ORDER BY count(cu.customer_id) DESC)`.',
      ],
      explanation: `1. **Hər ölkəni saxlayın:** \`FROM countries LEFT JOIN customers\`. İslandiya, Keniya və Lüksemburqun müştərisi yoxdur. Inner join onları atardı.
2. **Düzgün sayın:** LEFT JOIN-dən sonra müştərisi olmayan ölkə yenə də customers tərəfində NULL-larla *bir* sətir yaradır. \`count(*)\` həmin sətri sayır (1 verir), \`count(cu.customer_id)\` isə NULL-ı nəzərə almır (0 verir).
3. **Aqreqatı dərəcələndirin:** window function-lar GROUP BY-dan sonra işləyir, ona görə də \`DENSE_RANK() OVER (ORDER BY count(cu.customer_id) DESC)\` sayları birbaşa dərəcələndirə bilər. Subquery lazım deyil.
4. **Bərabərliklər:** bir neçə ölkə eyni sayı paylaşır (məsələn, 0 olan üç ölkə), ona görə də onlar boşluqsuz dərəcəni paylaşır.`,
      commonMistakes: [
        'Müştərisi olmayan ölkələri itirən inner JOIN işlətmək.',
        'LEFT JOIN-dən sonra count(*) işlətmək, bu da müştərisi olmayan ölkələr üçün 1 müştəri göstərir.',
        'Tapşırıq dərəcələrdə boşluq olmadığını dedikdə RANK işlətmək.',
      ],
    },
    't17-q07': {
      title: 'Hər kateqoriyada ən bahalı üç məhsul',
      prompt: `**Hər kateqoriya** üçün (\`category_id\` üzrə) onun **hələ satışda olan ən bahalı 3 məhsulunu** (\`discontinued_at IS NULL\`) sadalayın. Hər kateqoriyada düz 3, kateqoriyada daha az məhsul varsa, daha az. Qiymətlər bərabər olduqda daha kiçik \`product_id\` daha yaxşı mövqeni qazanır.

- **Sütunlar:** \`category_id\`, \`category\` (kateqoriyanın adı), \`product_id\`, \`product\` (məhsulun adı), \`price\`, \`pos\` (1, 2 və ya 3)
- **Sıralama:** \`category_id\` üzrə, sonra \`pos\`.

*Dərəcə üzrə filtrləmə yuxarıdakı izahdakı "daxili sorğuda dərəcələ, xarici sorğuda filtrlə" pattern-ini tələb edir.*`,
      hints: [
        '"Düz 3, bərabərliklər product_id ilə həll olunur" `product_id` tie-breaker-i ilə ROW_NUMBER-ə işarə edir.',
        '`category_id` üzrə partition edin. İki fərqli kateqoriyanın hər ikisi "Shoes" adlanır.',
        '`pos`-u subquery və ya CTE-də hesablayın, sonra xarici sorğuda `WHERE pos <= 3` saxlayın.',
      ],
      explanation: `1. **Hər kateqoriya daxilində dərəcələndirin:** \`ROW_NUMBER() OVER (PARTITION BY p.category_id ORDER BY p.price DESC, p.product_id)\`. ROW_NUMBER hər mövqe üçün düz bir sətrə zəmanət verir, \`product_id\` isə bərabərlikləri tapşırığın istədiyi kimi həll edir.
2. **Dərəcələməzdən əvvəl filtrləyin:** \`discontinued_at IS NULL\` dərəcələnən sorğunun *içinə* aiddir. Sonradan tətbiq edilsə, satışdan çıxarılmış məhsul 1-ci mövqeni tuta bilər və kateqoriya yalnız iki məhsul göstərərdi.
3. **Dərəcə üzrə filtrləyin:** window nəticələri eyni sorğunun WHERE-ində işlədilə bilməz, ona görə də dərəcələmə CTE-yə (və ya subquery-yə) gedir, xarici sorğu isə \`pos <= 3\`-ü saxlayır.
4. **Açar üzrə partition:** *Shoes* həm Men, həm də Women altında mövcuddur. \`PARTITION BY c.name\` onları bir kateqoriya kimi qəbul edərdi və onlardan biri məhsullarını itirərdi.`,
      commonMistakes: [
        '`WHERE ROW_NUMBER() OVER (…) <= 3` yazmaq. Window function-lara WHERE-də icazə verilmir.',
        'Kateqoriya adı üzrə partition, bu da iki "Shoes" kateqoriyasını birləşdirir.',
        'Qiymətlər bərabər olduqda əlavə sətirlər qaytaran RANK və ya DENSE_RANK işlətmək.',
        'Mövqelər artıq paylandıqdan sonra satışdan çıxarılmış məhsulları xarici sorğuda filtrləmək.',
      ],
    },
    't17-q08': {
      title: 'Hər kateqoriyada ikinci ən yüksək fərqli qiymət',
      prompt: `Hər kateqoriya üçün hələ satışda olan (\`discontinued_at IS NULL\`) məhsulları arasında **ikinci ən yüksək fərqli qiyməti** tapın.

Bir neçə məhsul ən yüksək qiyməti paylaşırsa, ikinci ən yüksək *fərqli* qiymət növbəti daha aşağı qiymətdir. İkidən az fərqli qiyməti olan kateqoriyalar görünmür.

- **Sütunlar:** \`category_id\`, \`category\` (kateqoriyanın adı), \`second_price\`
- **Sıralama:** \`category_id\` üzrə. Hər kateqoriya üçün bir sətir.`,
      hints: [
        'Bərabərliklərlə "fərqli" dəyərlər → DENSE_RANK. Bərabər qiymətlər dərəcəni paylaşır və heç bir ədəd atlanmır.',
        'Qiymətləri hər kateqoriya daxilində dərəcələndirin, sonra xarici sorğuda 2-ci dərəcəni saxlayın.',
        'Bir neçə məhsul ikinci qiyməti paylaşa bilər. Hər kateqoriyanın yalnız bir dəfə göründüyünə əmin olun (DISTINCT).',
      ],
      explanation: `Bu, hər qrup üzrə soruşulan klassik "N-ci ən yüksək dəyər" müsahibə sualıdır.

1. **DENSE_RANK fərqli dəyərləri sayır.** Ən yüksək qiymətli bütün məhsullar 1, növbəti daha aşağı qiymət isə bərabərliyin ölçüsündən asılı olmayaraq 2 alır.
2. **Niyə RANK yox?** *Monitors*-da bir neçə məhsul ən yüksək qiyməti paylaşır. RANK ilə onların hamısı 1-dir və növbəti qiymət 4-ə sıçrayır, ona görə də \`= 2\` heç nə tapmır və kateqoriya yox olur.
3. **Niyə ROW_NUMBER yox?** Ən yüksək qiymət bərabər olduqda 2-ci sətir sadəcə başqa ən yüksək qiymətli məhsuldur, ona görə də ən yüksək qiyməti "ikinci ən yüksək" kimi göstərərdiniz.
4. **DISTINCT:** iki məhsul ikinci qiyməti paylaşa bilər. Onda hər birinin dərəcəsi 2-dir və DISTINCT olmadan kateqoriya iki dəfə görünür.

Alternativ əvvəlcə qiymət üzrə qruplaşdırır, ona görə də hər qiymət dərəcələməzdən əvvəl bir dəfə görünür. Onda DISTINCT lazım deyil.`,
      commonMistakes: [
        'Ən yüksək qiyməti bərabər olan kateqoriyaları itirən RANK işlətmək.',
        'Ən yüksək qiymət bərabər olduqda onu yenidən qaytaran ROW_NUMBER işlətmək.',
        'DISTINCT-i unutmaq, bu da ikinci qiymətə malik hər məhsul üçün bir sətir verir.',
      ],
    },
    't17-q09': {
      title: 'Düzəlt: hər departamentdə ən yüksək maaşlı işçi',
      prompt: `Bu sorğu **hər departamentdə ən yüksək maaşlı aktiv işçini** qaytarmalıdır: hər \`department_id\` üçün bir sətir. İki işçi maaşda bərabərdirsə, daha kiçik \`employee_id\` qalib gəlir. Departamenti olmayan işçilər (\`department_id\` NULL) öz qrupunu təşkil edir.

O, xəta ilə uğursuz olur. Düzəldin.

- **Sütunlar:** \`employee_id\`, \`department_id\`, \`salary\`
- **Sıralama:** \`department_id\` üzrə artan, NULL-lar sonda (PostgreSQL-in artan sıra üçün standartı).`,
      hints: [
        'İşə salın və xətanı oxuyun: window function-lara harada icazə verilmir?',
        'Sətir nömrəsini daxili sorğuda hesablayın (ona `pos` kimi alias verin), sonra xaricdə `pos = 1` üzrə filtrləyin.',
      ],
      explanation: `**Xəta:** \`window functions are not allowed in WHERE\`. WHERE sətirləri window function-lar hesablanmazdan *əvvəl* filtrləyir, ona görə də həmin anda sətir nömrəsi hələ mövcud deyil.

**Həll:** dərəcələməni daxili sorğuda (alias tələb edən FROM-dakı subquery-də) hesablayın, sonra onun nəticəsi üzrə xarici sorğuda filtrləyin:

1. Daxili sorğu aktiv işçiləri saxlayır və onları hər departament üzrə, ən yüksək maaş birinci, bərabərlikləri \`employee_id\` həll etməklə nömrələyir.
2. Xarici sorğu \`pos = 1\`-i saxlayır: hər departament üçün düz bir sətir.
3. \`PARTITION BY department_id\` bütün NULL departamentləri bir qrupa toplayır, ona görə də iki podratçı tələb olunduğu kimi öz qrupunu təşkil edir.

PostgreSQL-in \`DISTINCT ON (department_id)\`-i burada düzgün qısa yoldur. O, ORDER BY-a görə hər departamentin ilk sətrini saxlayır.`,
      commonMistakes: [
        'Alias-ı WHERE-ə köçürmək (`AND pos = 1`). SELECT-dəki alias-lar da WHERE-də görünmür.',
        'Window nəticəsini filtrləmək üçün HAVING işlətmək. Window-lar HAVING-dən də sonra hesablanır.',
        'Tie-breaker-i atmaq, bu da bərabərliyin qalibini gözlənilməz edir.',
      ],
    },
    't17-q10': {
      title: 'İdxal edilmiş əlaqələrdən dublikatları silin',
      prompt: `\`staging_customer_import\` eyni adamları bir neçə dəfə ehtiva edir, bəzən e-poçt ünvanında fərqli böyük-kiçik hərflər və ya artıq boşluqlarla.

**Hər normallaşdırılmış e-poçt üçün bir sətir** saxlayın, burada normallaşdırılmış e-poçt \`lower(trim(email))\`-dir. Hər qrupdan **birinci idxal edilmiş** sətri (\`imported_at\`), bu bərabərdirsə, ən kiçik \`import_row_id\`-li sətri saxlayın. \`email\`-i NULL olan və ya \`@\` ehtiva etməyən sətirləri nəzərə almayın.

- **Sütunlar:** \`import_row_id\`, \`email\` (normallaşdırılmış ünvan)
- **Sıralama:** \`email\` üzrə.`,
      hints: [
        '*Normallaşdırılmış* ünvan üzrə qruplaşdırın: `PARTITION BY lower(trim(email))`.',
        'Hər qrupdakı sətirləri idxal vaxtı və sətir id-si üzrə nömrələyin, sonra xarici sorğuda 1-ci sətri saxlayın.',
        `NULL və @-siz ünvanları nömrələməzdən əvvəl filtrləyin: \`WHERE email LIKE '%@%'\`. NULL heç vaxt LIKE-a uyğun gəlmir.`,
      ],
      explanation: `Dublikatların silinməsi ROW_NUMBER-in real həyatda ən çox yayılmış istifadələrindən biridir:

1. **"Eyni"ni təyin edin:** \`lower(trim(email))\` \`' Anna.Kim@Gmail.com'\` və \`'anna.kim@gmail.com'\`-u bir açara birləşdirir. Xam sütun üzrə yox, həmin ifadə üzrə partition edin.
2. **Qalanı təyin edin:** \`ORDER BY imported_at, import_row_id\` ən erkən idxalı 1 nömrə edir. Sətir id-si eyni fayl daxilindəki bərabərlikləri həll edir.
3. **Qalanları saxlayın:** xarici sorğuda \`rn = 1\` üzrə filtrləyin.
4. **Əvvəlcə zibili nəzərə almayın:** \`email LIKE '%@%'\` NULL-ları (NULL heç vaxt LIKE-a uyğun gəlmir), boş sətirləri və \`'n/a'\`-nı nömrələməzdən əvvəl atır.

PostgreSQL-in \`DISTINCT ON\`-u eyni şeyi bir addımda edir: ORDER BY-a görə hər açar üçün ilk sətri saxlayır.`,
      commonMistakes: [
        'Xam `email` üzrə partition, ona görə də böyük-kiçik hərf və boşluq variantları fərqli adamlar sayılır.',
        'Yalnız e-poçt üzrə DISTINCT işlətmək. Hansı sətrin saxlanacağı barədə məlumatı itirirsiniz.',
        'imported_at DESC üzrə sıralamaq, bu da birinci nüsxə əvəzinə ən sonuncunu saxlayır.',
      ],
    },
    't17-q11': {
      title: 'Qeyri-bərabər bölgü ilə NTILE',
      prompt: `Yeddi sətir üç qrupa bölünür. Bu sorğu sıra ilə hansı \`bucket\` dəyərlərini qaytarır?`,
      hints: ['7 = 3 + 2 + 2. Əlavə sətri hansı qruplar alır: birincilər, yoxsa sonuncular?'],
      explanation: `NTILE(3) qrupları mümkün qədər bərabər edir. 7 sətir ÷ 3 qrup = hər biri 2 sətir, 1 sətir artıq qalır. Artıq sətirlər **ilk** qruplara gedir, ona görə də ölçülər **3, 2, 2**-dir:

- x = 1, 2, 3 → 1-ci qrup
- x = 4, 5 → 2-ci qrup
- x = 6, 7 → 3-cü qrup

\`generate_series(1, 7)\` 1-dən 7-yə qədər tam ədədləri sətirlər çoxluğu kimi yaradır. \`AS g(x)\` sütunu adlandırır.`,
      commonMistakes: [
        'Əlavə sətirləri sonuncu qrupa vermək.',
        'NTILE-ın dəyərlərə baxdığını düşünmək. O, yalnız sətirləri sıra ilə sayır, ona görə də bərabər dəyərlər fərqli qruplara düşə bilər.',
      ],
    },
    't17-q12': {
      title: 'Almaniyadakı hər müştərinin ən son sifarişi',
      prompt: `**Almaniyada yaşayan** (\`customers.country_id\`-si \`'Germany'\` adlı ölkəyə işarə edən) və ən azı bir sifariş vermiş hər müştəri üçün onun **ən son sifarişini** göstərin (ən gec \`ordered_at\`; iki sifariş onu paylaşırsa, daha böyük \`order_id\`). İstənilən statusdakı sifarişləri daxil edin.

- **Sütunlar:** \`customer_id\`, \`order_id\`, \`ordered_at\`, \`status\`
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: [
        'Müştərinin *yaşadığı* yer sifarişin `ship_country_id`-si yox, `customers.country_id`-dir.',
        'Hər müştərinin sifarişlərini ən yenisi birinci nömrələyin: `PARTITION BY customer_id ORDER BY ordered_at DESC, order_id DESC`.',
        'Xarici sorğuda 1-ci sətri saxlayın.',
      ],
      explanation: `"Hər obyekt üçün ən son sətir" həm müsahibələrin, həm də real hesabatların əsas elementidir.

1. **Düzgün müştəriləri tapın:** orders → customers → countries join edin və \`countries.name = 'Germany'\` üzrə filtrləyin. \`orders.ship_country_id\` yox, *müştərinin* ölkəsi nəzərdə tutulur. Bir neçə sifariş müştərinin öz ölkəsindən başqa yerə göndərilir, ona görə də iki filtr həqiqətən fərqli nəticələr verir.
2. **Ən yenisi birinci nömrələyin:** \`ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY ordered_at DESC, order_id DESC)\`. Tapşırığın bərabərlik qaydası ikinci sıralama açarına çevrilir.
3. **Ən yenisini saxlayın:** xarici sorğuda \`rn = 1\`. Sifarişi olmayan müştərilər heç vaxt görünmür, çünki onların sifariş sətirləri yoxdur.

Cəlbedici alternativ hər müştəri üzrə \`max(ordered_at)\`-dir, amma onda sifarişin digər sütunlarını almaq üçün ikinci join lazımdır və bərabərliklər çətin olur. ROW_NUMBER (və ya PostgreSQL-in DISTINCT ON-u) bütün sətri birbaşa qaytarır.`,
      commonMistakes: [
        'Sual müştərinin yaşadığı yer haqqında olduqda ship_country_id üzrə filtrləmək.',
        'Artan sıralama, bu da hər müştərinin ilk sifarişini qaytarır.',
        'GROUP BY ilə max(ordered_at) işlədib sonra status-u da seçməyə çalışmaq. O, qruplaşdırılmayıb.',
      ],
    },
    't17-q13': {
      title: '2024-ün hər ayının ən çox xərcləyən müştərisi',
      prompt: `**2024-ün hər ayı** üçün (\`ordered_at\`-ı 2024-01-01-dən 2025-01-01-ə qədər, sonuncu daxil olmadan, UTC olan sifarişlər) həmin ay **ən yüksək xərci** olan müştərini və ya müştəriləri tapın. Bir neçə müştəri birinci yerdə bərabərdirsə, hamısını daxil edin.

- **Xərc** = müştərinin həmin aydakı sifariş sətirləri üzrə \`quantity * unit_price * (1 - discount)\`-ın cəmi, yalnız \`status\`-u \`'cancelled'\` **olmayan** sifarişlər sayılır.
- **Sütunlar:** \`month\` (ayın ilk günü, \`date\` tipi), \`customer_id\`, \`spend\` (2 onluq rəqəmə yuvarlaqlaşdırılmış)
- **Sıralama:** \`month\` üzrə, sonra \`customer_id\`.`,
      hints: [
        `Əvvəlcə xərci hər ay və müştəri üzrə aqreqasiya edin: \`date_trunc('month', ordered_at)::date\` və join edilmiş sifariş sətirləri üzrə SUM.`,
        'Sonra müştəriləri hər ay daxilində dərəcələndirin: `RANK() OVER (PARTITION BY month ORDER BY spend DESC)`. RANK bərabərlikləri saxlayır.',
        'Xarici sorğuda 1-ci dərəcəni saxlayın və yalnız göstərərkən yuvarlaqlaşdırın.',
      ],
      explanation: `Üç addımlı boru xətti: **aqreqasiya → dərəcələmə → filtr**.

1. **Aqreqasiya:** sifarişləri onların sətirləri ilə join edin, ləğv edilməmiş 2024 sifarişlərini saxlayın və sətir dəyərlərini hər \`(month, customer)\` üzrə toplayın. \`date_trunc('month', ordered_at)::date\` vaxt dəyərini ayının ilk gününə, date kimi, çevirir. Yarıaçıq aralıq \`>= '2024-01-01' AND < '2025-01-01'\` 31 dekabr 23:59 daxil olmaqla 2024-dəki hər vaxt dəyərini tutur.
2. **Hər ay daxilində dərəcələndirin:** \`RANK() OVER (PARTITION BY month ORDER BY spend DESC)\`. RANK (və ya DENSE_RANK) tələb olunduğu kimi ən yuxarıdakı bərabərlikləri saxlayır. ROW_NUMBER bərabər müştərini səssizcə atardı.
3. **Filtrləyin və göstərin:** \`rnk = 1\`-i saxlayın və yalnız son SELECT-də yuvarlaqlaşdırın. Yuvarlaqlaşdırılmamış dəyərlər üzrə dərəcələmə yalançı bərabərliklərin qarşısını alır.

Alternativ 1-ci və 2-ci addımları bir SELECT-də edir. Window aqreqatı dərəcələndirə bilər, çünki window-lar GROUP BY-dan sonra hesablanır.`,
      commonMistakes: [
        'Ləğv edilmiş sifarişləri xaric etməyi unutmaq.',
        'PARTITION BY month-u buraxmaq, bu da ilin yalnız tək ən yaxşı müştərisini qaytarır.',
        'Xərci hesablayarkən discount sütununu nəzərə almamaq.',
        'Birinci yerdə bərabər olan müştəriləri atan ROW_NUMBER işlətmək.',
      ],
    },
    't17-q14': {
      title: 'Qiymət kvartilləri',
      prompt: `**Hələ satışda olan** bütün məhsulları (\`discontinued_at IS NULL\`) \`NTILE(4)\` ilə **4 qiymət kvartilinə** bölün: 1-ci kvartil ən ucuz məhsulları saxlayır. Bölgü deterministik olsun deyə \`price\` üzrə, bərabər qiymətlər üçün isə \`product_id\` üzrə sıralayın.

Sonra hər kvartili xülasə edin.

- **Sütunlar:** \`quartile\`, \`products\` (neçə), \`min_price\`, \`max_price\`, \`avg_price\` (2 onluq rəqəmə yuvarlaqlaşdırılmış)
- **Sıralama:** \`quartile\` üzrə.`,
      hints: [
        '1-ci addım: satışda olan hər məhsula `NTILE(4) OVER (ORDER BY price, product_id)` təyin edin.',
        '2-ci addım: xarici sorğuda kvartil üzrə GROUP BY edin və aqreqasiya edin.',
      ],
      explanation: `1. **Sətirləri qruplara bölün:** \`NTILE(4) OVER (ORDER BY price, product_id)\` məhsulları ən ucuzdan ən bahalıya doğru gəzir və onları 4 təxminən bərabər qrupa paylayır. Say 4-ə bölünmədikdə ilk kvartillər bir məhsul çox alır.
2. **Deterministik edin:** bir neçə məhsul qiyməti paylaşır, NTILE isə dəyərlərə yox, sətir mövqelərinə görə bölür. \`product_id\` tie-breaker-i olmadan bərabər məhsullar işə salmadan işə salmaya fərqli kvartillərə düşə bilər.
3. **Xülasə edin:** window-lar onları hesablayan eyni SELECT-də qruplaşdırıla bilməz, ona görə də CTE-də (və ya subquery-də) qruplara bölün və xaricdə \`quartile\` üzrə GROUP BY edin.

Diqqət edin ki, qrup sərhədləri sətir mövqeləridir. Eyni qiymətli iki məhsul qonşu kvartillərdə ola bilər, ona görə də bir kvartilin \`max_price\`-ı növbətinin \`min_price\`-ına bərabər ola bilər. Bu, normal NTILE davranışıdır və dəyərə əsaslanan sərhədlər lazım olduqda \`percentile_cont\` (14-cü mövzu) işlətməyin səbəbidir.`,
      commonMistakes: [
        'DESC sıralama, bu da 1-ci kvartili ən bahalı edir.',
        'Satışdan çıxarılma filtrini unutmaq.',
        'Eyni sorğu səviyyəsində window function üzrə GROUP BY etməyə çalışmaq. Əvvəlcə onu hesablayın, sonra qruplaşdırın.',
      ],
    },
    't17-q15': {
      title: 'Düzəlt: hər müştərinin ilk həqiqi sifarişi',
      prompt: `**Ləğv edilməmiş** ən azı bir sifarişi olan hər müştəri üçün sorğu onun **ilk ləğv edilməmiş sifarişini** qaytarmalıdır: ən erkən \`ordered_at\`, bərabərlikdə isə daha kiçik \`order_id\`.

Aşağıdakı sorğu xətasız işləyir, amma yanlış sətirlər qaytarır. Bug(lar)ı tapın və düzəldin.

- **Sütunlar:** \`customer_id\`, \`order_id\`, \`ordered_at\`
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: [
        'İşə salın: neçə sətir qayıdır? Nömrələmə harasa yenidən başlamalıdırmı?',
        'Ləğv filtri harada tətbiq olunur: nömrələmədən əvvəl, yoxsa sonra? Ən birinci sifarişi ləğv edilmiş müştəri ilə nə baş verir?',
      ],
      explanation: `**İki bug** var:

1. **PARTITION BY yoxdur.** Nömrələmə *bütün* sifarişlər üzərində gedir, ona görə də bütün cədvəldə yalnız bir sətrin \`rn = 1\`-i var. \`PARTITION BY customer_id\` əlavə etmək sayı hər müştəri üçün yenidən başladır.
2. **Ləğv filtri yanlış yerdədir.** O, nömrələmədən *sonra* tətbiq olunur. İlk sifarişi ləğv edilmiş müştərinin həmin ləğv edilmiş sifarişdə \`rn = 1\`-i var, xarici filtr onu atır və müştəri, sonradan həqiqi sifarişlər versə belə, yox olur. \`status <> 'cancelled'\`-i daxili sorğuya köçürün ki, ləğv edilmiş sifarişlər heç vaxt nömrə almasın.

Ümumi qayda: **hansı sətirlərin yarışdığını** müəyyən edən şərtlər window-dan əvvəl, içəriyə gedir. **Dərəcələmənin nəticəsi** üzrə şərtlər isə xaricə gedir.`,
      commonMistakes: [
        'Yalnız partition-u düzəldib status filtrini xaricdə saxlamaq, bu da ilk sifarişi ləğv edilmiş müştəriləri itirir.',
        'Yalnız filtri düzəltmək, bu da yenə də tək sətir qaytarır.',
        'Azalan sıralama, bu da ilk sifariş əvəzinə ən son sifarişi qaytarır.',
      ],
    },
    't17-q16': {
      title: 'Hər departamentdə ən yüksək üç maaş',
      prompt: `Klassik müsahibə sualı. Hər departament üçün maaşı departamentin **üç ən yüksək fərqli maaşından** biri olan **aktiv** işçiləri (\`termination_date IS NULL\`) sadalayın. Həmin maaşlardan birini bir neçə nəfər alırsa, hamısını sadalayın. Departamenti olmayan işçilər nəzərə alınmır.

- **Sütunlar:** \`department\` (departamentin adı), \`employee_id\`, \`salary\`
- **Sıralama:** \`department\` üzrə, sonra \`salary\` (ən yüksək birinci), sonra \`employee_id\`.`,
      hints: [
        'Bərabərliklər daxil olmaqla "üç ən yüksək *fərqli* maaş" → DENSE_RANK.',
        'CTE və ya subquery-də hər departament daxilində dərəcələndirin, sonra dərəcə ≤ 3-ü saxlayın.',
        'Sales-də eyni maaşlı iki direktor var. Cavabınızın orada yenə də 3-cü fərqli maaşa çatdığını yoxlayın.',
      ],
      explanation: `Müsahibəçilər bunu sevir, çünki hər üç ranking funksiyası inandırıcı görünür, yalnız biri isə düzgündür.

- **DENSE_RANK ≤ 3** maaşı üç ən yüksək *fərqli* dəyər arasında olan hər işçini saxlayır. Sales-də VP 1, iki direktor (eyni maaş) hər ikisi 2, növbəti maaş isə 3-dür. Bu, 4 nəfərdir və düzgündür.
- **RANK ≤ 3** Sales-ə 1, 2, 2, 4 verir və direktorlardan sonra dayanır, üçüncü fərqli maaşı buraxır.
- **ROW_NUMBER ≤ 3** düz 3 nəfər qaytarır və "fərqli maaşlar"ın mənasını nəzərə almır.

Dərəcələməzdən **əvvəl** \`termination_date IS NULL\` üzrə filtrləməyi unutmayın. Əks halda keçmiş işçinin maaşı ilk-3 yerini tuta bilərdi.

Alternativ həll window function-lardan əvvəlki yanaşmadır: departamentdə işçinin maaşından yüksək olan fərqli maaşlar 3-dən azdırsa, onu saxlayın. Düzgündür, amma böyük cədvəllərdə oxumaq daha çətin və daha yavaşdır.`,
      commonMistakes: [
        'Yuxarıda bərabərlik olduqda üçüncü fərqli maaşı itirən RANK işlətmək.',
        'Həmişə düz üç nəfər qaytaran ROW_NUMBER işlətmək.',
        'İşdən çıxmış işçiləri xaric etməzdən əvvəl dərəcələndirmək.',
      ],
    },
    't17-q17': {
      title: 'Ən uzun giriş seriyaları (gaps and islands)',
      prompt: `**Seriya** müştərinin ən azı bir **uğurlu** girişi (\`success = true\`) olduğu ardıcıl təqvim günlərinin (\`logged_in_at\`-ın UTC tarixləri) silsiləsidir. Eyni gündə bir neçə giriş bir gün sayılır.

Hər müştəri üçün onun **ən uzun** seriyasını tapın. Müştərinin həmin uzunluqda bir neçə seriyası varsa, ən erkənini işlədin. Sonra **ən uzun seriyalı 5 müştərini** qaytarın.

- **Sütunlar:** \`customer_id\`, \`streak_days\`, \`streak_start\`, \`streak_end\` (hər ikisi \`date\`)
- **Sıralama:** \`streak_days\` üzrə (ən uzun birinci), sonra \`customer_id\`. Həmin sıranın düz ilk 5 sətrini qaytarın.`,
      hints: [
        'Əvvəlcə verilənləri hər müştəri və gün üçün bir sətrə endirin: `SELECT DISTINCT customer_id, logged_in_at::date`.',
        '"Gaps and islands" hiyləsi: müştəri daxilində `day - ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY day)` ardıcıl günlər boyu sabit qalır. Onun üzrə qruplaşdırın.',
        'Sonra hər müştərinin ən yaxşı silsiləsini başqa ROW_NUMBER ilə seçin (ən uzunu birinci, ən erkən başlanğıc) və ORDER BY … LIMIT 5 ilə bitirin. ROW_NUMBER bigint qaytarır, ona görə də onu tarixdən çıxmazdan əvvəl `::int` ilə cast edin.',
      ],
      explanation: `"Gaps and islands" ən məşhur SQL müsahibə pattern-lərindən biridir.

1. **Hər aktiv gün üçün bir sətir:** \`SELECT DISTINCT customer_id, logged_in_at::date\`. DISTINCT olmadan eyni gündəki iki giriş iki sətir verir və aşağıdakı hesab pozulur.
2. **Ada (island) açarı:** hər müştərinin günlərini 1, 2, 3, … nömrələyin və həmin nömrəni tarixdən çıxın:

   | day | row_number | day − row_number |
   |---|---|---|
   | 2024-02-15 | 1 | 2024-02-14 |
   | 2024-02-16 | 2 | 2024-02-14 |
   | 2024-02-17 | 3 | 2024-02-14 |
   | 2024-02-20 | 4 | 2024-02-16 |

   Ardıcıl günlər eyni fərqi saxlayır. Boşluq onu dəyişir. Hər fərqli fərq bir *ada*dır (seriya).
3. **Hər adanı ölçün:** \`GROUP BY customer_id, island\` uzunluğu, ilk günü və son günü verir.
4. **Hər müştəri üçün ən yaxşı ada:** uzunluğa (azalan) və başlanğıc tarixinə (artan) görə sıralanmış ROW_NUMBER ən uzununu, eyni uzunluqdakılardan isə ən erkənini seçir.
5. **İlk 5:** uzunluğa, sonra müştəriyə görə sıralayın və \`LIMIT 5\`.

\`ROW_NUMBER()\` \`bigint\` qaytarır, PostgreSQL-də isə \`date - bigint\` operatoru yoxdur, ona görə də \`::int\` ilə cast edin.

Məşq verilənlərində iki müştəri 21 günlük seriyalarla bərabərdir və həmin seriyalar 2024-02-29 uzun il gününü keçir.`,
      commonMistakes: [
        'DISTINCT-i buraxmaq, ona görə də gündə bir neçə giriş tarix − row_number hiyləsini pozur.',
        `Tarixlər əvəzinə vaxt dəyərlərini saxlamaq (məsələn, \`date_trunc('day', logged_in_at)\`). \`date\`-dən tam ədəd çıxa bilərsiniz, \`timestamptz\`-dən isə yox.`,
        'Cast etmədən tarixdən bigint çıxmaq. `date - bigint` operatoru yoxdur.',
        'Uğursuz girişləri saymaq.',
      ],
    },
    't17-q18': {
      title: 'Müştərilər nə qədər tez qayıdır?',
      prompt: `Growth komandası müştərilərin **ikinci sifarişi** nə qədər tez verdiyini, qeydiyyatdan keçdikləri il üzrə bölünmüş şəkildə bilmək istəyir.

Yalnız \`status\`-u \`'cancelled'\` olmayan sifarişləri nəzərə alın. Müştərinin birinci və ikinci sifarişləri onların arasından \`ordered_at\`, sonra \`order_id\` üzrə sıralanmış ən erkən ikisidir.

Müştəriləri **qeydiyyat ili** (\`EXTRACT(YEAR FROM signup_at)\`, tam ədəd kimi) üzrə qruplaşdırın. Yalnız ən azı bir ləğv edilməmiş sifarişi olan müştərilər sayılır. Hər il üçün göstərin:

- \`repeat_customers\`: ikinci sifarişi olan müştərilər;
- \`fast_repeaters\`: ikinci sifarişi birincidən **ən çox 30 gün** sonra gələnlər (\`second.ordered_at - first.ordered_at <= INTERVAL '30 days'\`);
- \`pct_fast\`: \`repeat_customers\`-in faizi kimi \`fast_repeaters\`, 1 onluq rəqəmə yuvarlaqlaşdırılmış (təkrar müştəri yoxdursa NULL).

- **Sütunlar:** \`signup_year\`, \`repeat_customers\`, \`fast_repeaters\`, \`pct_fast\`
- **Sıralama:** \`signup_year\` üzrə.`,
      hints: [
        'Hər müştərinin ləğv edilməmiş sifarişlərini ROW_NUMBER ilə nömrələyin (müştəri üzrə partition, ordered_at, order_id üzrə sıralama).',
        '1-ci və 2-ci sifarişləri hər müştəri üzrə sütunlara pivot edin: `MIN(ordered_at) FILTER (WHERE n = 1)` və `n = 2` üçün eynisi.',
        'Faizi hesablayarkən tam bölməyə diqqət edin. `100.0`-a vurun və sıfıra bölmənin qarşısını almaq üçün NULLIF işlədin.',
      ],
      explanation: `Ranking üzərində qurulmuş yığcam saxlanma (retention) analizi:

1. **Həqiqi sifarişləri nömrələyin:** ləğv edilməmiş sifarişlər üzərində \`ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY ordered_at, order_id)\`. Ləğv edilmiş sifarişlər nömrələmədən *əvvəl* xaric edilir, ona görə də onlar "birinci" və ya "ikinci" sifariş sayıla bilməz.
2. **Hər müştəri üçün bir sətrə pivot edin:** \`n <= 2\`-ni saxlayın və birinci və ikinci vaxt dəyərlərini yan-yana qoymaq üçün şərti aqreqasiya (\`MIN(…) FILTER (WHERE n = 1)\`) işlədin. Bir dəfəlik alıcılar üçün \`second_at\` NULL-dur.
3. **Qeydiyyat ilini join edin** və aqreqasiya edin:
   - \`count(f.second_at)\` yalnız NULL olmayan dəyərləri, yəni təkrar müştəriləri sayır;
   - \`<= INTERVAL '30 days'\` ilə FILTER sürətliləri sayır. İki timestamptz dəyərini çıxmaq interval verir;
   - \`100.0 * … / NULLIF(…, 0)\`: \`100.0\` numeric bölməni məcbur edir (\`100 * 7 / 9\` tam bölmə olardı və 77.8 əvəzinə 77 verərdi), NULLIF isə sıfır məxrəci xəta əvəzinə NULL-a çevirir.
4. PostgreSQL-də \`EXTRACT\` \`numeric\` qaytarır, ona görə də səliqəli il sütunu üçün onu \`::int\` ilə cast edin.`,
      commonMistakes: [
        'Faizdə tam bölmə: `100 * a / b` kəsir. `100.0` işlədin.',
        'Bütün sifarişləri nömrələyib ləğv edilmişləri sonradan filtrləmək (və ya heç filtrləməmək).',
        'Təkrar müştərilər üçün count(*) işlətmək, bu da bir dəfəlik alıcıları da sayır.',
        'Müddəti ilk sifarişdən yox, qeydiyyat tarixindən ölçmək.',
      ],
    },
  },
};

export default topic;
