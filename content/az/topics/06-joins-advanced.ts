import type { TopicText } from '../../i18n.ts';

const explanation = `5-ci mövzu cədvəlləri foreign key-lər boyunca join edirdi. Bu mövzu real işdə və müsahibələrdə rast gəlinən join *üsullarını* əhatə edir.

## Self-join-lər

Cədvəl iki alias altında **özü ilə** join edilə bilər. \`employees.manager_id\` iyerarxiyasını belə gəzir və ya eyni cədvəlin sətirlərini müqayisə edirsiniz:

\`\`\`sql
SELECT e.employee_id,
       e.first_name || ' ' || e.last_name AS employee,
       m.first_name || ' ' || m.last_name AS manager
FROM employees e
LEFT JOIN employees m ON m.employee_id = e.manager_id
ORDER BY e.employee_id
LIMIT 8;
\`\`\`

CEO-nun meneceri yoxdur, buna görə də burada LEFT join lazımdır. Bir cədvəl daxilində cütlər üçün \`a.id < b.id\` işlədin ki, hər cüt bir dəfə görünsün və heç kim özü ilə cütləşməsin.

## Semi-join-lər: "ən azı bir … var"

\`customers JOIN orders\` hər müştərini hər sifarişi üçün bir dəfə təkrarlayır. Yalnız sifarişi *olan* müştəriləri istəyirsinizsə, **semi-join** işlədin:

\`\`\`sql
SELECT c.customer_id, c.first_name
FROM customers c
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id)
ORDER BY c.customer_id
LIMIT 5;
\`\`\`

\`EXISTS\` ilk uyğunluqda dayanır və heç vaxt təkrarlamır. \`IN (SELECT …)\` də eyni cür davranır. (Subquery-lərin öz mövzusu var, 19. Burada onlar join üsulları kimi işlədilir.)

## Anti-join-lər: "… yoxdur" və NOT IN tələsi

"Məhsulu olmayan təchizatçıları" yazmağın üç yolu var:

\`\`\`sql
-- 1. NOT EXISTS: ən aydını və NULL üçün təhlükəsizdir
SELECT s.supplier_id, s.name FROM suppliers s
WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.supplier_id = s.supplier_id);
\`\`\`

\`\`\`sql
-- 2. LEFT JOIN … IS NULL
SELECT s.supplier_id, s.name FROM suppliers s
LEFT JOIN products p ON p.supplier_id = s.supplier_id
WHERE p.product_id IS NULL;
\`\`\`

\`\`\`sql
-- 3. NOT IN: burada HEÇ NƏ qaytarmır, çünki products.supplier_id-də NULL-lar var!
SELECT s.supplier_id, s.name FROM suppliers s
WHERE s.supplier_id NOT IN (SELECT supplier_id FROM products);
\`\`\`

\`x NOT IN (1, 2, NULL)\` \`x <> 1 AND x <> 2 AND x <> NULL\` deməkdir və son hissə heç vaxt true olmur. **NOT EXISTS-ə üstünlük verin.**

## CROSS JOIN

\`A CROSS JOIN B\` A-nın hər sətrini B-nin hər sətri ilə cütləşdirir (|A| × |B| sətir). Şəbəkələr (hər şöbə × hər rüb) və ya \`generate_series\` ilə birlikdə təqvimlər qurmaq üçün faydalıdır. Çatışmayan join şərti ucbatından təsadüfən baş verdikdə isə təhlükəlidir.

\`\`\`sql
SELECT d.name AS department, q.quarter
FROM departments d
CROSS JOIN (VALUES ('Q1'), ('Q2'), ('Q3'), ('Q4')) AS q(quarter)
ORDER BY 1, 2
LIMIT 8;
\`\`\`

## Non-equi join-lər

Join şərtləri mütləq bərabərlik olmamalıdır. Tarixi qüvvədə olma dövrü ilə uyğunlaşdırmaq geniş yayılıb:

\`\`\`sql
SELECT e.employee_id, h.salary AS salary_on_2023_01_01
FROM employees e
JOIN salary_history h
  ON h.employee_id = e.employee_id
 AND h.effective_from <= DATE '2023-01-01'
 AND (h.effective_to IS NULL OR h.effective_to >= DATE '2023-01-01')
ORDER BY e.employee_id
LIMIT 5;
\`\`\`

## LATERAL: hər sətir üçün subquery

FROM-dakı subquery adətən eyni FROM-un digər cədvəllərini görə bilmir. \`LATERAL\` ilə görə bilir, ona görə də hər xarici sətir üçün bir dəfə icra olunur. Bu, "hər sətir üçün top N"-i asanlaşdırır:

\`\`\`sql
-- Çilidəki hər müştərinin ən son 2 sifarişi
SELECT c.customer_id, last2.order_id, last2.ordered_at
FROM customers c
CROSS JOIN LATERAL (
  SELECT o.order_id, o.ordered_at
  FROM orders o
  WHERE o.customer_id = c.customer_id
  ORDER BY o.ordered_at DESC
  LIMIT 2
) AS last2
WHERE c.country_id = 6
ORDER BY c.customer_id, last2.ordered_at DESC;
\`\`\`

\`CROSS JOIN LATERAL\` subquery-si heç nə qaytarmayan xarici sətirləri atır. \`LEFT JOIN LATERAL (…) ON true\` isə onları NULL-larla saxlayır.

## Tələlər

- Self-join cütləri: \`a.id <> b.id\` hər cütü iki dəfə göstərir (A–B və B–A). \`<\` işlədin.
- \`generate_series\` + LEFT JOIN ilə qurulmuş təqvim **sıfır** aktivlikli günləri göstərməyin standart yoludur.
- Eyni valideynə join edilmiş bir neçə "çox" cədvəli bir-birini çoxaldır. Hər dəfə birini join edin və ya əvvəlcə aqreqasiya edin.`;

const topic: TopicText = {
  explanation,
  questions: {
    't06-q01': {
      title: 'İşçilər və onların menecerləri',
      prompt: `Hər işçini menecerinin adı ilə göstərin. CEO-nun meneceri yoxdur, amma o da görünməlidir (manager NULL).

- **Sütunlar:** \`employee_id\`, \`employee\` (ad, boşluq, soyad), \`manager\` (eyni formatda)
- **Sıralama:** \`employee_id\` üzrə.`,
      hints: [`\`employees\`-i özü ilə join edin: \`employees e LEFT JOIN employees m ON m.employee_id = e.manager_id\`.`],
      explanation: `Eyni cədvəlin iki alias-ı fərqli rollar oynayır: \`e\` işçidir, \`m\` isə id-si işçinin \`manager_id\`-sinə bərabər olan sətirdir.

LEFT JOIN CEO-nu saxlayır. Şərti tərsinə çevirmək (\`m.manager_id = e.employee_id\`) əvəzində hər işçinin *tabeliyindəkiləri* tapır və menecerləri hər tabeli üçün bir dəfə təkrarlayır.`,
      commonMistakes: ['Inner join: bu, CEO-nu itirir.', 'Join şərtini tərsinə çevirmək.'],
    },
    't06-q02': {
      title: 'Sifarişi olan müştərilər, hərəsi bir dəfə',
      prompt: `**Ən azı bir sifariş** vermiş hər müştərini yalnız müştəri sütunları ilə **bir dəfə** göstərmək istəyirsiniz. Ən birbaşa düzgün seçim hansı sorğudur?`,
      hints: ['Hansı forma müştərini heç vaxt təkrarlaya bilməz?'],
      explanation: `EXISTS **semi-join**-dir: o, "ən azı bir uyğun sifariş varmı?" soruşur və hər müştərini ən çox bir dəfə qaytarır. Adi JOIN müştərini hər sifarişi üçün bir dəfə təkrarlayır (DISTINCT lazım olardı). LEFT JOIN sifarişi *olmayan* müştəriləri də saxlayır. CROSS JOIN hər müştərini hər sifarişlə cütləşdirir.`,
      commonMistakes: ['Mövcudluq yoxlaması üçün JOIN işlədib sonra təkrarlarla mübarizə aparmaq.'],
      options: [
        '`SELECT c.* FROM customers c JOIN orders o ON o.customer_id = c.customer_id;`',
        '`SELECT c.* FROM customers c WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id);`',
        '`SELECT c.* FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id;`',
        '`SELECT c.* FROM customers c CROSS JOIN orders o;`',
      ],
    },
    't06-q03': {
      title: 'Büdcə planlaşdırma şəbəkəsi',
      prompt: `Maliyyə şöbəsinə planlaşdırma şəbəkəsi lazımdır: **hər şöbə və hər rüb** \`'Q1'\`, \`'Q2'\`, \`'Q3'\`, \`'Q4'\` **üçün bir sətir**.

- **Sütunlar:** \`department\` (ad), \`quarter\`
- **Sıralama:** \`department\` üzrə, sonra \`quarter\`.`,
      hints: [`Rüblər daxili cədvəldən gələ bilər: \`(VALUES ('Q1'), ('Q2'), ('Q3'), ('Q4')) AS q(quarter)\`.`, 'Hər şöbə hər rüblə: CROSS JOIN.'],
      explanation: `CROSS JOIN hər şöbəni (10) hər rüblə (4) cütləşdirir və 40 sətir verir. FROM-da cədvəllər arasında vergül (\`FROM departments d, generate_series(1, 4) g\`) eyni şeyin köhnə yazılışıdır.`,
      commonMistakes: ['Bir rübü unutmaq.'],
    },
    't06-q04': {
      title: 'Self-join-dən cütlər',
      prompt: `Bu self-join nə qaytarır?`,
      hints: [`\`a.x < b.x\` bərabər dəyərləri xaric edir və hər cüt daxilində sıranı müəyyən edir.`],
      explanation: `\`<\` ilə hər sırasız cüt düz bir dəfə görünür (kiçik dəyər birinci) və heç bir dəyər özü ilə cütləşmir. Bu, 3 cütdür. \`<>\` bütün 6 sıralı cütü verərdi, \`<=\` isə özü ilə cütləri əlavə edərdi.`,
      commonMistakes: ['Hər cütün hər iki sırasını gözləmək.'],
    },
    't06-q05': {
      title: 'Rəy yazmış müştərilər',
      prompt: `**Ən azı bir rəy** yazmış müştəriləri hərəsini bir dəfə göstərin.

- **Sütunlar:** \`customer_id\`, \`first_name\`, \`last_name\`
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: ['"Ən azı bir" → EXISTS ilə semi-join.'],
      explanation: `\`EXISTS\` hər müştərini neçə rəy yazmasından asılı olmayaraq bir dəfə qaytarır. Adi JOIN bir neçə rəyi olan müştəriləri təkrarlayır (DISTINCT lazım olardı), LEFT JOIN isə rəyi olmayan müştəriləri də daxil edir.

Bəzi rəylərin customer_id-si NULL olsa da, \`IN (SELECT customer_id FROM reviews)\` burada problemsizdir. NULL tələsi yalnız **NOT** IN-ə təsir edir.`,
      commonMistakes: ['DISTINCT-siz JOIN: bu, müştəriləri təkrarlayır.'],
    },
    't06-q06': {
      title: 'Kataloqda heç nəyi olmayan təchizatçılar',
      prompt: `**Heç bir məhsul tədarük etməyən** təchizatçıları tapın.

- **Sütunlar:** \`supplier_id\`, \`name\`
- **Sıralama:** \`supplier_id\` üzrə.

*Diqqət: bəzi məhsulların təchizatçısı yoxdur (NULL \`supplier_id\`).*`,
      hints: ['Anti-join: NOT EXISTS və ya LEFT JOIN … IS NULL.', `\`supplier_id NOT IN (SELECT supplier_id FROM products)\` niyə heç nə qaytarmazdı?`],
      explanation: `Subquery-də NULL olduğu üçün \`NOT IN\` hər təchizatçı üçün naməlumdur və **heç nə** qaytarmır. Bu, klassik anti-join tələsidir. NOT EXISTS və LEFT JOIN … IS NULL NULL üçün təhlükəsizdir. NOT IN yalnız NULL-ları subquery-dən süzsəniz işləyir.`,
      commonMistakes: ['NULL-lar olan sütuna qarşı NOT IN.', 'Inner join "uyğunluq yoxdur" sətirləri yarada bilmir.'],
    },
    't06-q07': {
      title: '2023-cü il Yeni il günündə maaşlar',
      prompt: `\`salary_history\`-dən istifadə edərək hər işçinin **1 yanvar 2023**-də nə qədər qazandığını tapın. \`effective_from <= '2023-01-01'\` olarsa və \`effective_to\` NULL-dursa və ya həmin tarixdə/ondan sonradırsa, dövr qüvvədədir. O vaxta qədər işə qəbul olunmamış işçilər görünmür.

- **Sütunlar:** \`employee_id\`, \`salary\`
- **Sıralama:** \`employee_id\` üzrə.`,
      hints: [`Join şərti yalnız \`=\` yox, \`<=\` və \`>=\` də işlədə bilər.`, `Unutmayın ki, hazırkı dövr üçün \`effective_to\` NULL-dur.`],
      explanation: `"Range join" zaman nöqtəsini onu əhatə edən dövrlə uyğunlaşdırır. İki hissə:

- dövr həmin tarixdə və ya ondan əvvəl başlayıb;
- həmin tarixdə və ya ondan sonra bitir, **ya da** hələ bitməyib (NULL).

NULL halını unutmaq o vaxtdan maaşı dəyişməyən hər kəsi itirir. Bitmə şərtini unutmaq *bütün* əvvəlki dövrləri, hər işçi üçün bir neçə sətir qaytarır. \`coalesce(effective_to, far-future date)\` (12-ci mövzu) geniş yayılmış qısa yoldur.`,
      commonMistakes: ['Açıq-uclu dövrləri (NULL effective_to) nəzərə almamaq.', 'Yalnız başlanğıc tarixini yoxlamaq.'],
    },
    't06-q08': {
      title: 'Maaşları eyni olan həmkarlar',
      prompt: `**Eyni şöbədə** işləyən və **düz eyni maaş** alan **aktiv işçi cütlərini** (\`termination_date IS NULL\`) tapın. Hər cütü bir dəfə, kiçik işçi id-si birinci olmaqla göstərin.

- **Sütunlar:** \`department_id\`, \`employee_a\`, \`employee_b\`, \`salary\`
- **Sıralama:** \`department_id\`, \`employee_a\`, \`employee_b\` üzrə.`,
      hints: ['Şöbə və maaş üzrə self-join.', `Hər cütü bir dəfə almaq üçün \`a.employee_id < b.employee_id\` işlədin.`, 'Hər iki işçi aktiv olmalıdır.'],
      explanation: `Self-join hər işçini şöbəsi və maaşı eyni olan hər həmkarı ilə uyğunlaşdırır. \`a.employee_id < b.employee_id\` özü ilə uyğunluqları *və* güzgü təkrarını (B, A) silir. Hər iki tərəfə "aktiv" filtri lazımdır.

Şöbəsi olmayan işçilər heç vaxt cütləşmir, çünki join şərtində \`NULL = NULL\` true deyil.`,
      commonMistakes: ['<> işlətmək: bu, hər cütü iki dəfə göstərir.', 'Aktiv işçilər üçün yalnız bir tərəfi filtrləmək.'],
    },
    't06-q09': {
      title: 'Düzəlt: heç kimi tövsiyə etməmiş müştərilər',
      prompt: `Bu sorğu **heç vaxt başqa müştərini tövsiyə etməmiş** müştəriləri (heç kimdə \`referred_by\` kimi qeyd olunmayanları) göstərməlidir. O, ümumiyyətlə heç bir sətir qaytarmır. Düzəldin.

- **Sütunlar:** \`customer_id\`
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: ['Heç kim tərəfindən tövsiyə olunmamış çoxsaylı müştərilər üçün subquery nə qaytarır?'],
      explanation: `Müştərilərin çoxu tövsiyə ilə gəlməyib, ona görə də \`SELECT referred_by FROM customers\` NULL-lar ehtiva edir. \`x NOT IN (…, NULL)\` heç vaxt true ola bilməz, ona görə də hər sətir süzülür.

NOT EXISTS işlədin və ya NULL-ları subquery daxilində xaric edin. Yanlış cavab başqa suala cavab verir: "kim *tövsiyə ilə gəlməyib*", "kim *heç kimi tövsiyə etməyib*" yox.`,
      commonMistakes: ['"Tövsiyə ilə gəlib" və "kimisə tövsiyə edib"-i qarışdırmaq.'],
    },
    't06-q10': {
      title: 'Hər Yeni Zelandiya müştərisinin son iki sifarişi',
      prompt: `**Yeni Zelandiyada** (\`country_id = 31\`) yaşayan hər müştəri üçün onun **ən son iki sifarişini** göstərin (az sifarişi varsa, az; sifarişi olmayan müştərilər görünmür).

- **Sütunlar:** \`customer_id\`, \`order_id\`, \`ordered_at\`
- **Sıralama:** \`customer_id\` üzrə, sonra \`ordered_at\` azalan sıra ilə.`,
      hints: [`Hazırkı müştərini görə bilən subquery: \`CROSS JOIN LATERAL (SELECT … WHERE o.customer_id = c.customer_id ORDER BY … LIMIT 2)\`.`],
      explanation: `\`LATERAL\` subquery-yə \`c.customer_id\`-yə istinad etməyə imkan verir, ona görə də PostgreSQL onu hər müştəri üçün bir dəfə icra edir: həmin müştərinin sifarişlərini ən yenidən başlayaraq sıralayır və 2-sini saxlayır.

Xarici sorğudakı LIMIT hər müştəri üçün 2 yox, *bütün* nəticəni 2 sətrə kəsir. CROSS JOIN LATERAL tələb olunduğu kimi subquery-si heç nə qaytarmayan müştəriləri də atır. \`LEFT JOIN LATERAL … ON true\` onları saxlayardı.`,
      commonMistakes: ['Hər müştəri üçün LIMIT əvəzinə ümumi LIMIT.', 'Artan sıra ilə sıralamaq (ən köhnə sifarişlər).'],
    },
    't06-q11': {
      title: 'Təsdiqlənmiş alışa əsaslanan rəylər',
      prompt: `Rəy **təsdiqlənmiş alış** sayılır, əgər onun müəllifi **rəyi yazmazdan əvvəl həmin məhsulu ehtiva edən, ləğv edilməmiş sifariş** verib (\`orders.ordered_at < reviews.created_at\`).

Təsdiqlənmiş rəyləri göstərin.

- **Sütunlar:** \`review_id\`, \`product_id\`, \`customer_id\`
- **Sıralama:** \`review_id\` üzrə.`,
      hints: [`Hər rəy üçün soruşun: *belə sifariş varmı?* Bu, order_items ilə join edilmiş orders üzərində EXISTS-dir.`, 'EXISTS daxilində müştərini, məhsulu, statusu və tarixi uyğunlaşdırın.'],
      explanation: `EXISTS subquery dörd şərtli semi-join-dir: eyni müştəri, eyni məhsul, real sifariş, rəydən əvvəl verilib. O, hər rəyi ən çox bir dəfə qaytarır.

- Adi join rəyi **hər uyğun sifariş üçün bir dəfə** qaytarır. Məhsulu iki dəfə almış müştərilər təkrar sətirlər yaradır.
- Yalnız "müştərinin *hər hansı* sifarişi var" yoxlaması yanlış şeyi təsdiqləyir: rəy həqiqətən aldıqları məhsul haqqında olmalıdır.

Anonimləşdirilmiş rəylər (NULL müştəri) heç vaxt təsdiqlənmir, çünki \`o.customer_id = NULL\` heç vaxt uyğun gəlmir.`,
      commonMistakes: ['DISTINCT-siz join: bu, təkrar rəylər verir.', 'Sifarişin rəy yazılan məhsulu ehtiva etdiyini yoxlamamaq.'],
    },
    't06-q12': {
      title: 'Gündəlik geri qaytarma sorğuları, boşluqlar daxil',
      prompt: `**2025-ci ilin iyununda hər gün üçün geri qaytarma sorğularının sayını** göstərin (\`requested_at\`-in UTC tarixinə görə). **İyunun hər günü** görünməlidir, sorğusu olmayan günlər **0** göstərir.

- **Sütunlar:** \`day\` (tipi \`date\`), \`requests\`
- **Sıralama:** \`day\` üzrə.`,
      hints: [`Təqvimi qurun: \`generate_series(DATE '2025-06-01', DATE '2025-06-30', INTERVAL '1 day')::date\`.`, 'returns-i günə görə LEFT JOIN edin, sonra günə görə GROUP BY.', 'returns tərəfindən bir sütunu sayın ki, boş günlər 0 sayılsın.'],
      explanation: `Verilənləri olmayan günlər verilənlərdə mövcud deyil, ona görə də onları **yaratmalısınız**. \`generate_series\` hər gün üçün bir sətir yaradır (11-ci mövzu), LEFT JOIN isə həmin günün geri qaytarmalarını bağlayır.

\`count(r.return_id)\` yalnız real uyğunluqları sayır, ona görə də boş gün 0 verir. \`count(*)\` NULL ilə genişləndirilmiş sətri 1 kimi sayardı. Təqvim olmadan boş günlər nəticədə sadəcə olmur.`,
      commonMistakes: ['returns cədvəlini birbaşa qruplaşdırmaq: bu, boş günləri buraxır.', 'LEFT JOIN-dən sonra count(*): bu, boş günlər üçün 1 göstərir.'],
    },
    't06-q13': {
      title: 'Menecer və bir səviyyə yuxarıdakı menecer',
      prompt: `Hər işçi üçün menecerinin id-sini və **menecerinin menecerinin** id-sini ("skip-level") göstərin. İyerarxiyanın yuxarısına yaxın hər ikisi NULL ola bilər və həmin işçilər də görünməlidir.

- **Sütunlar:** \`employee_id\`, \`manager_id\`, \`skip_level_id\`
- **Sıralama:** \`employee_id\` üzrə.`,
      hints: [`İki dəfə self-join: işçi → menecer → menecerin meneceri.`, 'Hər iki join LEFT join olmalıdır.'],
      explanation: `Hər əlavə iyerarxiya səviyyəsi bir self-join deməkdir. Hamısı LEFT join olmalıdır: CEO-nun meneceri yoxdur, VP-lərin menecerinin (CEO-nun) da meneceri yoxdur. İkinci inner join məhz həmin sətirləri atır.

Alternativ daha qısadır: menecerin \`manager_id\`-si *elə* skip-level id-dir, ona görə də bir join kifayətdir. Dərinliyi naməlum iyerarxiyalar üçün rekursiv CTE işlədin (20-ci mövzu).`,
      commonMistakes: ['İkinci səviyyədə inner join.'],
    },
    't06-q14': {
      title: 'Cross join-i saymaq',
      prompt: `Bu sorğu neçə sətir sayır?`,
      hints: ['CROSS JOIN 3 × 2 sətir verir. Onlardan ikisində x = 1-dir və hər biri c-nin **iki** sətrinə uyğun gəlir.'],
      explanation: `1. CROSS JOIN: 3 × 2 = **6** sətir.
2. c-yə LEFT JOIN: x = 1 olan 2 sətrin hər biri c-nin hər iki sətrinə uyğun gəlir və 4 sətir verir. x = 2 və ya 3 olan 4 sətir heç nəyə uyğun gəlmir və hərəsi bir dəfə saxlanılır, 4 sətir verir.

4 + 4 = **8**. LEFT JOIN heç vaxt sətir atmır, amma onları çoxalda bilər.`,
      commonMistakes: ['LEFT JOIN-in sətir sayını dəyişmədiyini düşünmək.'],
    },
    't06-q15': {
      title: 'Həm noutbuk, həm də siçan almış',
      prompt: `Ləğv edilməmiş sifarişlərdə **həm** **Laptops** kateqoriyasından (slug \`'laptops'\`) bir məhsul, **həm də** **Mice** kateqoriyasından (slug \`'mice'\`) bir məhsul almış müştəriləri tapın. İki məhsul fərqli sifarişlərdə ola bilər.

- **Sütunlar:** \`customer_id\`
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: ['AND ilə birləşdirilmiş iki müstəqil mövcudluq yoxlaması.', 'Hər EXISTS orders → order_items → products → categories join edir.'],
      explanation: `"A **və** B alıb" **iki fərqli sətir** haqqında sualdır. Bir sətrin slug-ı həm 'laptops', həm də 'mice' ola bilməz, ona görə də \`slug = 'laptops' AND slug = 'mice'\` heç nə qaytarmır, \`IN\` isə "A *və ya* B" deməkdir.

Həllər:

1. Hər kateqoriya üçün bir olmaqla **iki EXISTS** (semi-join): oxunaqlı və səmərəli.
2. **Qruplaşdırıb fərqli kateqoriyaları saymaq** (alternativ, 14-cü mövzu): alışları arasında hər iki slug olan müştəriləri saxlayın. Bu, "bu N kateqoriyanın hamısı" sualına gözəl ümumiləşir.`,
      commonMistakes: ['Bir sətirdə AND (həmişə boş).', 'IN / OR: bu, hər iki kateqoriyadan birini almış müştəriləri tapır.'],
    },
    't06-q16': {
      title: 'Hər kateqoriyada ən son rəy',
      prompt: `**Hər kateqoriya** üçün həmin kateqoriyadakı istənilən məhsulun **ən son rəyini** göstərin (ən son \`created_at\`, bərabərlikdə daha böyük \`review_id\`). Heç bir rəyi olmayan kateqoriyalar (birbaşa məhsul saxlamayan valideyn kateqoriyalar da daxil) NULL-larla görünməlidir.

- **Sütunlar:** \`category_id\`, \`review_id\`, \`rating\`, \`created_at\`
- **Sıralama:** \`category_id\` üzrə.`,
      hints: [`Hər kateqoriya üçün bir rəy tapan subquery: \`LEFT JOIN LATERAL (… ORDER BY … LIMIT 1) ON true\`.`, 'Daxildə kateqoriyaya görə filtrləmək üçün rəyləri məhsullarla join edin.'],
      explanation: `\`LEFT JOIN LATERAL (…) ON true\` "hər sətir üçün əlaqəli top-1 sətri gətir, yoxdursa NULL" üçün PostgreSQL idiomudur:

- subquery \`c.category_id\`-ni görür və ən çox bir rəy qaytarır: ən yenisini, tie-breaker kimi id ilə;
- \`ON true\`, çünki uyğunlaşdırma artıq subquery daxilində baş verib;
- LEFT subquery-si heç nə qaytarmayan kateqoriyaları saxlayır. CROSS JOIN LATERAL onları atardı.

Alternativ hər kateqoriya üçün ən yeni rəyi \`DISTINCT ON\` ilə (1-ci mövzu) əvvəlcədən hesablayır və onu LEFT JOIN edir.`,
      commonMistakes: ['CROSS JOIN LATERAL: bu, rəyi olmayan kateqoriyaları atır.', 'Artan sıra ilə sıralamaq: bu, ən köhnə rəyi verir.'],
    },
  },
};

export default topic;
