import type { TopicText } from '../../i18n.ts';

const explanation = `**Window function** əlaqəli sətirlər çoxluğundan, yəni öz *window*-undan dəyər hesablayır, amma GROUP BY-dan fərqli olaraq **hər sətri saxlayır**. Detalı *və* aqreqatı yan-yana alırsınız.

\`\`\`sql
SELECT order_item_id, order_id,
       quantity * unit_price                          AS line_value,
       sum(quantity * unit_price) OVER (PARTITION BY order_id) AS order_total,
       count(*) OVER (PARTITION BY order_id)          AS lines_in_order
FROM order_items
WHERE order_id <= 3
ORDER BY order_item_id;
\`\`\`

## OVER-in anatomiyası

\`\`\`text
function(args) OVER (
    PARTITION BY …     -- hansı sətirlər bir yerə aiddir (standart: bütün sətirlər)
    ORDER BY …         -- hər partition daxilində sıra (dərəcələmə, kumulyativ cəmlər, LAG… üçün lazımdır)
    frame              -- ROWS/RANGE … (16-cı mövzu)
)
\`\`\`

- \`OVER ()\`: window bütün nəticədir: \`count(*) OVER ()\` = ümumi sətir sayı, hər sətirdə.
- \`OVER (PARTITION BY x)\`: eyni x-ə malik sətirlər. Hər partition müstəqil hesablanır.
- İstənilən aqreqat (\`sum\`, \`avg\`, \`min\`, \`max\`, \`count\`) window function kimi işlədilə bilər. Ranking funksiyaları (17-ci mövzu) və dəyər funksiyaları (18-ci mövzu) **yalnız** OVER ilə işləyir.

## GROUP BY və window-lar

| | GROUP BY | window |
|---|---|---|
| çıxan sətirlər | hər qrup üçün bir | **bütün** giriş sətirləri |
| detal sütunlarını göstərə bilər | yalnız qruplaşdırılmışları | istənilənini |
| tipik istifadə | hər qrup üzrə cəmlər | "hər sətri öz qrupu ilə müqayisə et" |

\`\`\`sql
-- Hər məhsulun qiyməti onun kateqoriyasının ortası və maksimumu ilə yanaşı
SELECT product_id, category_id, price,
       round(avg(price) OVER (PARTITION BY category_id), 2) AS category_avg,
       max(price)       OVER (PARTITION BY category_id)     AS category_max
FROM products
ORDER BY category_id, product_id
LIMIT 10;
\`\`\`

## OVER daxilindəki ORDER BY mənanı dəyişir

Window-da ORDER BY olduqda aqreqat **kumulyativ** olur: o, partition-un əvvəlindən cari sətrə qədər olan sətirləri, **onunla bərabər olan sətirlər daxil olmaqla** (peer-lər), əhatə edir. ORDER BY olmadan bütün partition-u əhatə edir. 16-cı mövzu bunu ətraflı araşdırır.

\`\`\`sql
SELECT x,
       sum(x) OVER ()            AS whole_total,
       sum(x) OVER (ORDER BY x)  AS running_total
FROM (VALUES (1), (2), (2), (3)) AS t(x);
\`\`\`

## Window-lar nə vaxt hesablanır

Məntiqi sıra: FROM → WHERE → GROUP BY → HAVING → **window functions** → SELECT siyahısı → DISTINCT → ORDER BY → LIMIT.

Deməli:

- **WHERE birinci işləyir.** Onun sildiyi sətirlər heç bir window-da olmur. "Bu, müştərinin ilk sifarişidirmi?" filtrləməzdən əvvəl *bütün* sifarişlər üzərində hesablanmalıdır.
- **WHERE-də window function üzrə filtrləyə bilməzsiniz.** Onu subquery və ya CTE-də hesablayın və xaricdə filtrləyin (19–20-ci mövzular).
- **Window-lar aqreqatları işlədə bilər:** qruplaşdırılmış sorğuda \`sum(sum(x)) OVER ()\` hər qrupun yanında ümumi cəmi verir.

Tərifi adlandırılmış window ilə təkrar işlədin: \`… OVER w … WINDOW w AS (PARTITION BY department_id)\`.

## Tələlər

- \`avg(x) OVER (ORDER BY …)\` qrupun ortası yox, *kumulyativ* ortadır. Qrup dəyəri üçün ORDER BY-ı buraxın.
- PARTITION BY bərabərlik işlədir: bütün NULL-lar bir partition təşkil edir.
- Window nəticələri eyni sorğu səviyyəsinin WHERE, GROUP BY və ya HAVING-ində mövcud deyil.`;

const topic: TopicText = {
  explanation,
  questions: {
    't15-q01': {
      title: 'Sifariş cəminin yanında sətir dəyəri',
      prompt: `**1-dən 5-ə qədər** sifarişlərin sətirləri üçün hər sətrin dəyərini (\`quantity * unit_price * (1 - discount)\`, 2 onluq rəqəmə yuvarlaqlaşdırılmış) və eyni sətirdə **onun sifarişinin cəmini** (həmçinin yuvarlaqlaşdırılmış) göstərin.

- **Sütunlar:** \`order_item_id\`, \`order_id\`, \`line_value\`, \`order_total\`
- **Sıralama:** \`order_item_id\` üzrə.`,
      hints: ['`sum(…) OVER (PARTITION BY order_id)` eyni sifarişin bütün sətirlərini toplayır, hər sətirdə.'],
      explanation: `\`PARTITION BY order_id\` hər sifarişi öz window-u edir, ona görə də cəm həmin sifarişin sətirlərini əhatə edir və onların hər birində görünür. \`OVER ()\` beş sifarişin hamısının cəmi olardı.

Window-un içinə ORDER BY əlavə etmək cəmi *kumulyativ* cəmə çevirir (16-cı mövzu). Burada istənilən bu deyil.`,
      commonMistakes: ['PARTITION BY əvəzinə OVER ().', 'Kumulyativ cəm verən window daxilindəki ORDER BY.'],
    },
    't15-q02': {
      title: 'Neçə sətir çıxır?',
      prompt: `Məşq verilənlərində \`orders\`-in 4 kanalla 7 785 sətri var. Bunlar neçə sətir qaytarır?

1. \`SELECT channel, count(*) FROM orders GROUP BY channel;\`
2. \`SELECT channel, count(*) OVER (PARTITION BY channel) FROM orders;\``,
      hints: ['Window function-lar sətirləri yığırmı?'],
      explanation: `GROUP BY **hər qrup üçün bir sətir** qaytarır (4). Window function **hər giriş sətrini** qaytarır (7 785), hər biri öz qrupunun sayını daşıyır. İkinci sorğuya DISTINCT əlavə etsəniz, yenə 4-ə qayıdardınız.`,
      commonMistakes: ['PARTITION BY-ın sətirləri GROUP BY kimi qruplaşdırdığını düşünmək.'],
      options: ['4 və 4', '4 və 7 785', '7 785 və 4', '7 785 və 7 785'],
    },
    't15-q03': {
      title: 'OVER ilə saymaq',
      prompt: `Bu sorğu nə qaytarır?`,
      hints: ['OVER () bütün nəticədir. PARTITION BY g eyni g-yə malik sətirlərdir.'],
      explanation: `Hər sətir öz kimliyini saxlayır. \`count(*) OVER ()\` 3 sətrin hamısını sayır, \`PARTITION BY g\` isə sətrin g-sini paylaşan sətirləri sayır: 'a' üçün 2, 'b' üçün 1. Window-da ORDER BY olmadan say kumulyativ deyil, bütün partition üzərindədir.`,
      commonMistakes: ['ORDER BY olmadan kumulyativ saylar gözləmək.', 'Sətirlərin yığılacağını gözləmək.'],
    },
    't15-q04': {
      title: 'Qiymət və kateqoriya ortası',
      prompt: `Hər məhsul üçün onun qiymətini, **kateqoriyasının orta qiymətini** (2 onluq rəqəmə yuvarlaqlaşdırılmış) və \`price - category average\` **fərqini** (2 onluq rəqəmə yuvarlaqlaşdırılmış) göstərin.

- **Sütunlar:** \`product_id\`, \`category_id\`, \`price\`, \`category_avg\`, \`diff\`
- **Sıralama:** \`product_id\` üzrə.`,
      hints: ['`avg(price) OVER (PARTITION BY category_id)`. Fərqi yuvarlaqlaşdırılmamış ortadan hesablayın.'],
      explanation: `Window ortası hər sətirdə durur, ona görə də onunla birbaşa hesab əməliyyatları edə bilərsiniz. GROUP BY ilə bu, mümkün deyil, çünki o, ayrı-ayrı məhsulları silərdi.

Window-a ORDER BY əlavə etmək onu kumulyativ ortaya çevirir: 1-ci məhsulun "ortası" onun öz qiyməti olardı.`,
      commonMistakes: ['Kateqoriyanın yox, ümumi orta.', 'Window daxilində ORDER BY.'],
    },
    't15-q05': {
      title: 'Ümumi büdcədə pay',
      prompt: `**Büdcəsi olan** hər departament üçün onun **bütün departamentlərin ümumi büdcəsinin** neçə faizini təşkil etdiyini göstərin (1 onluq rəqəm).

- **Sütunlar:** \`name\`, \`budget\`, \`share_pct\`
- **Sıralama:** \`share_pct\` üzrə (ən yüksək birinci), sonra \`name\`.`,
      hints: ['`sum(budget) OVER ()` hər sətirdə ümumi cəmdir.', 'Büdcəsi NULL olan departamentlər window-dan əvvəl xaric edilir, ona görə də onlar cəmdə də yoxdur. İstədiyiniz budurmu? Burada, bəli.'],
      explanation: `"Ümumidə pay" = dəyər / cəm. \`sum(budget) OVER ()\` cəmi hər sətrə qoyur. name üzrə partition hər departamenti öz cəmi edir (hər yerdə 100%), ORDER BY isə cəmi kumulyativ edir.

\`budget\` numeric-dir, ona görə də \`100 * budget / …\` dəqiqdir.`,
      commonMistakes: ['Sətrin öz açarı üzrə partition.', 'Məxrəc kimi kumulyativ cəm.'],
    },
    't15-q06': {
      title: 'Departament ortasından yuxarı maaş alanlar',
      prompt: `Maaşı **öz departamentinin aktiv işçilərinin orta maaşından yuxarı** olan **aktiv** işçiləri sadalayın. Departamenti olmayan işçilər nəzərə alınmır.

- **Sütunlar:** \`department_id\`, \`employee_id\`, \`salary\`, \`dept_avg\` (2 onluq rəqəmə yuvarlaqlaşdırılmış)
- **Sıralama:** \`department_id\` üzrə, sonra \`salary\` (ən yüksək birinci), sonra \`employee_id\`.`,
      hints: ['`avg(salary) OVER (PARTITION BY department_id)`-ı aktiv işçilər üzərində subquery-də hesablayın.', '`salary > dept_avg`-ı xaricdə filtrləyin. Window nəticələri eyni sorğunun WHERE-ində işlədilə bilməz.'],
      explanation: `İki dərs:

1. \`WHERE salary > avg(salary) OVER (…)\` yaza bilməzsiniz, çünki window-lar WHERE-dən sonra hesablanır. Ortanı daxili sorğuda hesablayın və xaricdə müqayisə edin.
2. **Window-da nəyin olması vacibdir.** Tapşırıq "departamentin *aktiv* işçilərinin ortası" deyir, ona görə də aktivlik filtri window-dan əvvəl, *daxildə* olmalıdır. Sonradan filtrləmək (birinci yanlış cavab) keçmiş işçilərin maaşlarına ortanı təhrif etməyə imkan verir.`,
      commonMistakes: ['Ortanı hesabladıqdan sonra aktiv işçiləri filtrləmək.', 'Bütün şirkət üzrə orta.'],
    },
    't15-q07': {
      title: 'Hər sifarişdə müştərinin sifariş sayı',
      prompt: `**Çili**də (\`country_id = 6\`) yaşayan müştərilər üçün onların bütün sifarişlərini sadalayın və hər sətirdə **həmin müştərinin cəmi neçə sifarişi olduğunu**, həmçinin **ilk** və **ən son** sifarişinin tarixini (UTC tarixləri) göstərin.

- **Sütunlar:** \`customer_id\`, \`order_id\`, \`orders_total\`, \`first_order\`, \`latest_order\`
- **Sıralama:** \`customer_id\` üzrə, sonra \`order_id\`.`,
      hints: ['Müştəri üzrə partition edilmiş window function-lar kimi count, min və max.', 'Adlandırılmış window onu qısa saxlayır: `WINDOW w AS (PARTITION BY o.customer_id)`.'],
      explanation: `Bir neçə window aqreqatı bir window-u paylaşa bilər, \`WINDOW\` bəndi isə onu bir dəfə adlandırır. Window-da ORDER BY olmadan hər funksiya müştərinin bütün sifarişlərini görür, ona görə də hər sətir eyni cəmləri göstərir.

ORDER BY ilə count və max "indiyədək" dəyərlərə çevrilir: 1-ci sifariş 1 sifariş, ən son tarix kimi isə öz tarixini göstərərdi.`,
      commonMistakes: ['Window daxilində ORDER BY (kumulyativ dəyərlər).', 'PARTITION BY yoxdur.'],
    },
    't15-q08': {
      title: 'Düzəlt: kateqoriya ortasının yanında qiymət',
      prompt: `Bu sorğu hər məhsulu qiyməti və **kateqoriyasının orta qiyməti** (2 onluq rəqəmə yuvarlaqlaşdırılmış) ilə sadalamalıdır. O, uğursuz olur. Düzəldin.

- **Sütunlar:** \`product_id\`, \`category_id\`, \`price\`, \`category_avg\`
- **Sıralama:** \`product_id\` üzrə.`,
      hints: ['GROUP BY hər kateqoriyanın məhsullarını bir sətrə yığır, ona görə də product_id və price artıq ayrı-ayrılıqda mövcud deyil.', 'Siz ortanı *və* hər sətri istəyirsiniz: window function.'],
      explanation: `GROUP BY hər kateqoriya üçün yalnız bir sətir çıxara bilər, ona görə də product_id və price-ı seçmək uğursuz olur (*must appear in the GROUP BY clause…*). Bunun əvəzinə product_id üzrə qruplaşdırmaq hər məhsulu öz qrupu edir və "orta" sadəcə onun öz qiymətidir.

\`avg(price) OVER (PARTITION BY category_id)\` sətirləri yığmadan kateqoriya ortasını hesablayır. Window function-lar məhz bunun üçündür. Qruplaşdırılmış subquery-ni geri join etmək (alternativ) window-lardan əvvəlki üsuldur.`,
      commonMistakes: ['Ortanı mənasız edən məhsul üzrə qruplaşdırma.'],
    },
    't15-q09': {
      title: 'Hər sifariş və müştərinin ən böyüyü',
      prompt: `**2025**-də verilmiş (ləğv edilməmiş) sifarişlər üçün hər sifarişin dəyərini (sətir dəyərlərinin cəmi, çatdırılmasız, 2 onluq rəqəmə yuvarlaqlaşdırılmış) və həmin **müştərinin ən böyük 2025 sifarişinin** dəyərini hesablayın.

- **Sütunlar:** \`order_id\`, \`customer_id\`, \`order_value\`, \`customer_max\`
- **Sıralama:** \`customer_id\` üzrə, sonra \`order_id\`.`,
      hints: ['Sifariş dəyərlərini almaq üçün sifariş üzrə GROUP BY. Eyni sorğuda `max(sum(…)) OVER (PARTITION BY customer_id)` müştəri maksimumunu hər sifarişin yanına qoyur.'],
      explanation: `Window-lar GROUP BY-dan **sonra** işləyir, ona görə də aqreqatları aqreqasiya edə bilir. \`sum(…)\` hər sifarişin dəyəridir (hər sifariş üçün bir sətir), \`max(sum(…)) OVER (PARTITION BY customer_id)\` isə hər müştəri üzrə həmin dəyərlərin ən böyüyüdür.

\`o.order_id\` üzrə qruplaşdırmaq \`o.customer_id\`-ni seçməyə imkan verir (funksional asılılıq). Window-un PARTITION BY-ı da onu işlədə bilər, çünki window-lar qruplaşdırılmış sətirləri görür.`,
      commonMistakes: ['Sifariş dəyərləri əvəzinə sətir dəyərləri üzərində window.', 'PARTITION BY yoxdur.'],
    },
    't15-q10': {
      title: 'Bərabərliklərlə OVER daxilində ORDER BY',
      prompt: `Bu sorğu nə qaytarır?`,
      hints: ['ORDER BY ilə standart frame ilk sətirdən cari sətrə **və onun bütün peer-lərinə** (eyni x-ə malik sətirlər) qədər uzanır.'],
      explanation: `Window-dakı ORDER BY cəmi kumulyativ edir. Standart frame (\`RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW\`) cari sətrin hər **peer**-ini daxil edir: x = 2 olan hər iki sətir 1 + 2 + 2 = **5** görür. Unikal olmayan sıralama açarları üzərində kumulyativ cəmlərin "sıçraması" buna görədir. 16-cı mövzu \`ROWS\`-un bunu necə dəyişdiyini göstərir.`,
      commonMistakes: ['Bərabər sətirlər üçün əvvəl 3, sonra 5 gözləmək.'],
    },
    't15-q11': {
      title: 'Kateqoriyanın zirvəsindən nə qədər aşağı',
      prompt: `**Hələ satışda olan** məhsullar üçün hər birinin qiymətinin **öz kateqoriyasındakı ən bahalı satışda olan məhsuldan** nə qədər aşağı olduğunu göstərin (ən bahalı üçün 0).

- **Sütunlar:** \`product_id\`, \`category_id\`, \`price\`, \`below_top\`
- **Sıralama:** \`category_id\` üzrə, sonra \`below_top\`, sonra \`product_id\`.`,
      hints: ['`max(price) OVER (PARTITION BY category_id) - price`', 'Satışda olma filtri WHERE-ə gedir ki, satışdan çıxarılmış məhsullar maksimumu təyin etməsin.'],
      explanation: `WHERE window-lardan **əvvəl** işləyir, ona görə də orada filtrləmək window-un nəyi gördüyünü müəyyən edir: maksimum üçün yalnız satışda olan məhsullar yarışır. Window-dan *sonra* filtrləmək (birinci yanlış cavab) satışdan çıxarılmış məhsula "zirvə" qiymətini təyin etməyə imkan verir.

Window daxilində \`ORDER BY price\` ilə max "indiyədək max"-a, yəni sətrin öz qiymətinə çevrilir, ona görə də hər fərq 0 olur.`,
      commonMistakes: ['Window-dan sonra filtrləmək.', 'Window daxilində ORDER BY.'],
    },
    't15-q12': {
      title: 'Hər ildə kateqoriyanın payı',
      prompt: `Hər **il** (UTC) və **category_id** üçün ləğv edilməmiş sifarişlərin gəlirini və həmin kateqoriyanın **ilin ümumi gəlirindəki payını** faizlə (2 onluq rəqəm) göstərin. Yalnız payı **ən azı 5%** olan sətirlər.

- **Sütunlar:** \`year\`, \`category_id\`, \`revenue\` (2 onluq rəqəm), \`share_pct\`
- **Sıralama:** \`year\` üzrə, sonra \`share_pct\` (ən yüksək birinci), sonra \`category_id\`.`,
      hints: ['İl və kateqoriya üzrə qruplaşdırın, ilin cəmi üçün `sum(sum(…)) OVER (PARTITION BY year)` işlədin.', 'Pay üzrə filtrləmək xarici sorğu tələb edir.'],
      explanation: `\`sum(sum(x)) OVER (PARTITION BY year)\` "bu ilin qrupları üzrə qrup cəmlərinin cəmi", yəni ilin cəmi kimi oxunur və hər (il, kateqoriya) sətrinə əlavə olunur. Bölmək hər kateqoriyanın payını verir.

İki səviyyəli filtrləmə: WHERE-də ləğv filtri (sətirlər) və xaricdə 5% həddi, çünki window nəticələri eyni səviyyədə filtrlənə bilməz. \`OVER ()\` bütün dövrlərin cəminə bölərdi.`,
      commonMistakes: ['Bütün dövrlərin cəminə bölmək.', 'Ləğv filtrini unutmaq.'],
    },
    't15-q13': {
      title: 'Hər sətirdə departament statistikası',
      prompt: `Departamenti olan **aktiv** işçilər üçün hər birinin maaşını departamentin **minimum, maksimum və orta** (2 onluq rəqəm) maaşı və **işçi sayı** ilə birlikdə, həmçinin işçinin maaşını **departament maksimumunun faizi** kimi (1 onluq rəqəm) göstərin. Adlandırılmış window işlədin.

- **Sütunlar:** \`department_id\`, \`employee_id\`, \`salary\`, \`dept_min\`, \`dept_max\`, \`dept_avg\`, \`headcount\`, \`pct_of_max\`
- **Sıralama:** \`department_id\` üzrə, sonra \`employee_id\`.`,
      hints: ['`… OVER d … WINDOW d AS (PARTITION BY department_id)`'],
      explanation: `Adlandırılmış window (\`WINDOW d AS (…)\`) bir dəfə təyin olunur və bir neçə funksiya tərəfindən təkrar işlədilir. Bu, daha qısadır və hamısının eyni tərifi işlətməsinə zəmanət verir.

Hər dəyər yalnız departamentin aktiv işçiləri üzərində hesablanır, çünki WHERE window-lardan əvvəl işləyir. Window tərifinə ORDER BY əlavə etmək hamısını kumulyativ statistikaya çevirərdi.`,
      commonMistakes: ['Window tərifində ORDER BY.', 'Aktivlik filtrini unutmaq.'],
    },
    't15-q14': {
      title: 'Bu, müştərinin ilk sifarişi idimi?',
      prompt: `**2025-ci ilin iyununda** verilmiş sifarişlər üçün hər birinin **müştərinin ümumiyyətlə ilk sifarişi** olub-olmadığını göstərin (istənilən status, bütün tarixçəsi üzrə ən erkən \`ordered_at\`).

- **Sütunlar:** \`order_id\`, \`customer_id\`, \`is_first\` (boolean)
- **Sıralama:** \`order_id\` üzrə.`,
      hints: ['İlk sifariş yalnız iyun sifarişləri üzərində yox, müştərinin **bütün** sifarişləri üzərində tapılmalıdır.', '`min(ordered_at) OVER (PARTITION BY customer_id)`-i subquery-də bütün sifarişlər üzərində hesablayın, sonra iyunu xaricdə filtrləyin.'],
      explanation: `Window function-lar haqqında ən vacib qayda: **WHERE birinci işləyir**. Yanlış cavabda window yalnız iyun sifarişlərini görür, ona görə də köhnə müştərinin ilk iyun sifarişi onun "ilk sifarişi" kimi görünür.

Window-u daxili sorğuda bütün tarixçə üzərində hesablayın, iyun filtrini isə xarici sorğuda tətbiq edin.`,
      commonMistakes: ['Window-u hesablamazdan əvvəl filtrləmək.'],
    },
    't15-q15': {
      title: 'Bir sifariş xərcdə üstünlük təşkil edir',
      prompt: `**Ən azı 2 ləğv edilməmiş sifarişi** olan və **tək ən böyük sifarişi** ümumi xərclərinin (sətir dəyərləri, çatdırılmasız) **50%-dən çoxunu** təşkil edən müştəriləri tapın.

- **Sütunlar:** \`customer_id\`, \`orders\`, \`total_spend\`, \`largest_order\`, \`largest_share_pct\` (məbləğlər 2 onluq rəqəmə, pay 1 onluq rəqəmə yuvarlaqlaşdırılmış)
- **Sıralama:** \`largest_share_pct\` üzrə (ən yüksək birinci), sonra \`customer_id\`.`,
      hints: ['1-ci addım: sifariş dəyərləri (sifariş üzrə GROUP BY).', '2-ci addım: hər müştəri üzrə həmin dəyərlər üzərində count, sum və max (window-lar və ya GROUP BY).', '3-cü addım: nisbət və sifariş sayı üzrə filtrləyin.'],
      explanation: `Onu qatlarla qurun: sətir → sifariş → müştəri. Ən böyük **sifariş** sifariş cəmlərindən hesablanmalıdır. \`max(line value)\` (ikinci yanlış cavab) ən böyük *sətri* tapır.

"Ən azı 2 sifariş" qaydası olmadan hər tək sifarişli müştəri asanlıqla uyğun gəlir (onun yeganə sifarişi 100%-dir). Window alternativi qruplaşdırılmış sətirlər üzərində window-ların ikinci GROUP BY-ı necə əvəz edə biləcəyini göstərir, amma DISTINCT tələb etmək hesabına.`,
      commonMistakes: ['Ən böyük sifariş əvəzinə ən böyük sətir.', 'Minimum sifariş qaydasını unutmaq.'],
    },
    't15-q16': {
      title: 'Ortadan yuxarı satış günləri',
      prompt: `**2024**-ün (UTC) hansı günlərində ləğv edilməmiş sifarişlərin gündəlik gəliri **2024-ün orta gündəlik gəlirindən 1.5 dəfədən çox** olub? (Orta sifarişi olan günlər üzrə.)

- **Sütunlar:** \`day\` (date), \`revenue\` (2 onluq rəqəm), \`avg_day\` (2 onluq rəqəm)
- **Sıralama:** \`day\` üzrə.`,
      hints: ['Gün üzrə qruplaşdırın və gündəlik cəmlərin ortasını hər sətirdə almaq üçün `avg(sum(…)) OVER ()` əlavə edin.', 'Xarici sorğuda filtrləyin.'],
      explanation: `\`avg(sum(x)) OVER ()\` = "gündəlik cəmlərin ortası", hər günə əlavə olunur. O, gün üzrə GROUP BY-dan sonra, bütün gün sətirləri üzərində hesablanır. Window-da ORDER BY ilə o, hər günə qədər kumulyativ ortaya çevrilərdi: fərqli (və hərəkət edən) meyar.

Pərakəndə satıcı üçün gözlənildiyi kimi, zirvələr noyabr və dekabr ətrafında toplanır.`,
      commonMistakes: ['Gündəlik cəmlər əvəzinə sətir dəyərlərinin ortasını almaq.', 'Meyar kimi kumulyativ orta.'],
    },
  },
};

export default topic;
