import type { TopicText } from '../../i18n.ts';

const explanation = `15-ci mövzu qrupun cəmini hər sətrin yanına qoydu. OVER daxilinə **ORDER BY** və **frame** əlavə edin, eyni aqreqatlar "indiyədək" və "yaxınlıqdakı" suallara cavab verəcək: kumulyativ cəmlər, hərəkətli ortalar, sürüşən 30 günlük saylar.

## Kumulyativ cəmlər

\`\`\`sql
SELECT ordered_at::date AS day,
       count(*)                               AS orders,
       sum(count(*)) OVER (ORDER BY ordered_at::date) AS orders_so_far
FROM orders
WHERE ordered_at >= '2025-06-01'
GROUP BY 1
ORDER BY 1
LIMIT 10;
\`\`\`

ORDER BY ilə hər sətrin window-u **frame**-dir: partition-un cari sətrə nisbətən bir dilimi.

## Frame bəndi

\`\`\`text
{ ROWS | RANGE | GROUPS } BETWEEN <start> AND <end>  [EXCLUDE …]

start / end:  UNBOUNDED PRECEDING | n PRECEDING | CURRENT ROW | n FOLLOWING | UNBOUNDED FOLLOWING
\`\`\`

- **ROWS** fiziki sətirləri sayır: \`ROWS BETWEEN 2 PRECEDING AND CURRENT ROW\` = bu sətir və ondan əvvəlki iki sətir.
- **RANGE** ORDER BY sütununun *dəyərləri* üzərində işləyir: \`RANGE BETWEEN INTERVAL '6 days' PRECEDING AND CURRENT ROW\` = tarixi bu sətrinkindən 6 gün ərzində olan hər sətir, neçə sətir olursa olsun.
- **GROUPS** peer qruplarını (ORDER BY dəyərləri bərabər olan sətirlər) sayır.
- **Standartlar:** ORDER BY olmadan frame bütün partition-dur. ORDER BY ilə o, \`RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW\`-dur və **cari sətrin bütün peer-lərini daxil edir**.

## ROWS və RANGE: bərabərliklər

\`\`\`sql
SELECT x,
       sum(x) OVER (ORDER BY x)                       AS range_default,
       sum(x) OVER (ORDER BY x ROWS UNBOUNDED PRECEDING) AS rows_frame
FROM (VALUES (1), (2), (2), (3)) AS t(x)
ORDER BY x, rows_frame;
\`\`\`

RANGE ilə hər iki 2 bir-birini görür (5, 5). ROWS ilə onlar bir-bir sayılır (3, 5), amma bərabər sətirlərdən hansının birinci gəlməsi **təsadüfidir**. Bunu window-un ORDER BY-ında unikal tie-breaker ilə düzəldin: \`ORDER BY paid_at, payment_id\`. Unikal ORDER BY ilə ROWS və RANGE eyni kumulyativ cəmi verir.

## Hərəkətli window-lar

\`\`\`sql
-- Aylıq sifariş saylarının 3 aylıq hərəkətli ortası
SELECT date_trunc('month', ordered_at)::date AS month,
       count(*) AS orders,
       round(avg(count(*)) OVER (ORDER BY date_trunc('month', ordered_at)::date
                                 ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 1) AS moving_avg_3m
FROM orders
WHERE ordered_at >= '2025-01-01'
GROUP BY 1
ORDER BY 1;
\`\`\`

İlk sətirlərin frame-i daha qısadır (yanvar yalnız özünün ortasını alır). \`ROWS n PRECEDING\` "n *sətir*" deməkdir, bu da yalnız heç bir dövr çatışmadıqda n dövrə bərabərdir. Boşluqlar mümkün olduqda interval ilə \`RANGE\` işlədin.

## Partition-lar yığımı sıfırlayır

\`sum(x) OVER (PARTITION BY year ORDER BY month)\` hər ildə yenidən başlayır: **ilin əvvəlindən bu günə** (year-to-date) cəm. \`PARTITION BY customer_id ORDER BY ordered_at\` hər müştərinin öz kumulyativ xərcini verir.

## EXCLUDE

\`EXCLUDE CURRENT ROW\` sətrin özünü onun frame-indən çıxarır, məsələn, "məni saymadan həmkarlarımın ortası":

\`\`\`sql
SELECT employee_id, department_id, salary,
       round(avg(salary) OVER (PARTITION BY department_id
                               ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
                               EXCLUDE CURRENT ROW), 2) AS colleagues_avg
FROM employees
WHERE department_id = 1 AND termination_date IS NULL
ORDER BY employee_id
LIMIT 8;
\`\`\`

## Məhdudiyyətlər

- \`count(DISTINCT x) OVER (…)\` **dəstəklənmir**. Kumulyativ fərqli saylar başqa yanaşma tələb edir (hər dəyərin ilk görünüşünü tapın, sonra kumulyativ cəm işlədin).
- Window nəticələri eyni sorğu səviyyəsində filtrlənə bilməz. Sorğunu əhatə edin (19–20-ci mövzular).`;

const topic: TopicText = {
  explanation,
  questions: {
    't16-q01': {
      title: '2025-ci ilin iyununda kumulyativ gəlir',
      prompt: `**2025-ci ilin iyununun** sifarişi olan hər günü (UTC) üçün həmin gün ləğv edilməmiş sifarişlərin gəlirini və 1 iyundan bəri **kumulyativ cəmi** göstərin (hər ikisi 2 onluq rəqəmə yuvarlaqlaşdırılmış).

- **Sütunlar:** \`day\` (date), \`revenue\`, \`running_total\`
- **Sıralama:** \`day\` üzrə.`,
      hints: ['Gün üzrə qruplaşdırın. `sum(sum(…)) OVER (ORDER BY day)` gündəlik cəmləri yığır.'],
      explanation: `Window-lar GROUP BY-dan sonra işləyir, ona görə də window **gündəlik** cəmləri toplayır: \`sum(sum(x)) OVER (ORDER BY day)\`. Qruplaşdırmadan sonra gün dəyərləri unikaldır, ona görə də standart RANGE frame-i və \`ROWS UNBOUNDED PRECEDING\` eyni nəticəni verir.

\`OVER ()\` ayın cəmini hər günə qoyur. O, yığmır.`,
      commonMistakes: ['OVER (ORDER BY day) əvəzinə OVER ().', 'Gündəlik cəmlər əvəzinə sətir dəyərləri üzərində window.'],
    },
    't16-q02': {
      title: 'Standart frame',
      prompt: `Frame yazmadıqda \`sum(amount) OVER (ORDER BY paid_at)\` hansı frame-i işlədir?`,
      hints: ['Kumulyativ cəmdə bərabər paid_at dəyərləri ilə nə baş verir?'],
      explanation: `ORDER BY ilə standart \`RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW\`-dur. RANGE ORDER BY dəyərləri bərabər olan sətirləri (*peer-lər*) bir addım kimi qəbul edir, ona görə də bərabər ödənişlər eyni kumulyativ cəmi alır. ORDER BY olmadan frame bütün partition-dur.`,
      commonMistakes: ['Standartın ROWS olduğunu düşünmək.'],
      options: [
        '`ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`',
        '`RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`, ona görə də eyni `paid_at`-a malik sətirlərin hamısı daxil edilir',
        '`ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`',
        'Standart yoxdur. ORDER BY işlədildikdə frame tələb olunur.',
      ],
    },
    't16-q03': {
      title: 'Bərabərliklərdə ROWS və RANGE',
      prompt: `Bu sorğu nə qaytarır?`,
      hints: ['RANGE peer-ləri (bərabər x) daxil edir. ROWS cari fiziki sətirdə dayanır.'],
      explanation: `Standart frame (RANGE) hər iki 2-yə bütün peer-lər daxil olmaqla cəmi verir: 1 + 2 + 2 = 5. \`ROWS UNBOUNDED PRECEDING\` (\`ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW\`-ın qısaltması) cari sətirdə dayanır, ona görə də birinci 2 3, ikincisi isə 5 alır. İki fiziki 2-dən hansının 3 alması təsadüfidir, sorğunun \`rows_sum\` üzrə də sıralaması buna görədir.`,
      commonMistakes: ['ROWS və RANGE-in eyni olduğunu düşünmək.'],
    },
    't16-q04': {
      title: '2024-də müştəri bazasının artımı',
      prompt: `**2024**-ün hər ayı üçün həmin ay neçə müştərinin qeydiyyatdan keçdiyini və həmin ayın sonuna qədər 2024 qeydiyyatlarının **kumulyativ** sayını göstərin.

- **Sütunlar:** \`month\` (date, ayın ilk günü), \`signups\`, \`cumulative_signups\`
- **Sıralama:** \`month\` üzrə.`,
      hints: [`\`date_trunc('month', signup_at)::date\``, 'Sonra `sum(count(*)) OVER (ORDER BY month)`.'],
      explanation: `GROUP BY-dan sonra hər ay üçün bir sətir var. \`count(*) OVER (ORDER BY month)\` həmin **ay sətirlərini** sayardı (1, 2, 3, … 12). Aylıq sayları yığmaq üçün \`sum(count(*)) OVER (…)\` lazımdır: daxili count aqreqatdır, xarici sum isə window.`,
      commonMistakes: ['Ayları sayan, qruplaşdırılmış sətirlər üzərində count(*) OVER (…).'],
    },
    't16-q05': {
      title: '3 aylıq hərəkətli orta',
      prompt: `**2024-ün yanvarından 2025-in iyununa qədər** hər ay üçün ləğv edilməmiş sifarişlərin gəlirini və onun **3 aylıq hərəkətli ortasını** göstərin (ayın özü və ondan əvvəlki iki ay, bu dövr daxilində; ilk iki ay daha az ayın ortasını alır). Hər ikisini 2 onluq rəqəmə yuvarlaqlaşdırın.

- **Sütunlar:** \`month\` (date), \`revenue\`, \`moving_avg_3m\`
- **Sıralama:** \`month\` üzrə.`,
      hints: ['`avg(sum(…)) OVER (ORDER BY month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)`'],
      explanation: `\`ROWS BETWEEN 2 PRECEDING AND CURRENT ROW\` üç sətirlik frame-dir: cari ay və ondan əvvəlki iki ay. "3 PRECEDING" onu dörd ay edərdi. Frame olmadan standartı (ilk sətirdən cari sətrə qədər), yəni 2024-ün yanvarından bəri kumulyativ ortanı alırsınız.

Burada hər ayın sifarişləri var, ona görə də "2 sətir geri" "2 ay geri"yə bərabərdir. Aylar çatışmaya bilsəydi, \`RANGE BETWEEN INTERVAL '2 months' PRECEDING AND CURRENT ROW\` (alternativ) yenə də təqvim ayları demək olardı.`,
      commonMistakes: ['Bir vahid sürüşmə: 3 PRECEDING dörd sətirdir.', 'Kumulyativ orta verən frame-in olmaması.'],
    },
    't16-q06': {
      title: 'İlin əvvəlindən bu günə gəlir',
      prompt: `**2023-dən 2025-in iyununa qədər** hər ay üçün ləğv edilməmiş sifarişlərin gəlirini və **ilin əvvəlindən bu günə** (year-to-date) gəliri (eyni ilin yanvarından həmin ay daxil olmaqla) göstərin. Hər ikisini 2 onluq rəqəmə yuvarlaqlaşdırın.

- **Sütunlar:** \`year\` (integer), \`month\` (date), \`revenue\`, \`ytd_revenue\`
- **Sıralama:** \`month\` üzrə.`,
      hints: ['İl üzrə partition, ay üzrə sıralama.'],
      explanation: `PARTITION BY year kumulyativ cəmin hər yanvarda **yenidən başlamasını** təmin edir. Onsuz cəm illər boyu artmağa davam edir. ORDER BY olmadan isə hər ay bütün ilin cəmini göstərir.`,
      commonMistakes: ['PARTITION BY year yoxdur, ona görə də cəm heç vaxt sıfırlanmır.', 'Window-da ORDER BY yoxdur.'],
    },
    't16-q07': {
      title: 'Düzəlt: təkrarlanan sifariş nömrələri',
      prompt: `Bu sorğu hər müştərinin sifarişlərini verildikləri sıra ilə (\`ordered_at\` üzrə, bərabərlikdə \`order_id\` üzrə) 1, 2, 3, … nömrələməlidir. Amma bəzi müştərilər eyni gün iki sifariş verib və onlar eyni nömrəni alır. Ranking funksiyaları işlətmədən düzəldin.

- **Sütunlar:** \`customer_id\`, \`order_id\`, \`order_no\`
- **Sıralama:** \`customer_id\` üzrə, sonra \`order_no\`.`,
      hints: ['Date-ə cast eyni gün sifarişlərini peer edir, standart RANGE frame-i isə bütün peer-ləri sayır.', 'Tam vaxt dəyəri və unikal tie-breaker üzrə sıralayın.'],
      explanation: `Kumulyativ say yalnız heç iki sətir peer olmadıqda nömrələmədir. \`ordered_at::date\` vaxtı atır, ona görə də eyni gündəki iki sifariş peer olur və standart RANGE frame-i hər ikisini sayır: hər biri daha böyük nömrəni alır.

\`ORDER BY ordered_at, order_id\` ilə hər sətir unikaldır, ona görə də frame hər dəfə düz bir sətir böyüyür. (Təkcə \`ROWS UNBOUNDED PRECEDING\` də fərqli nömrələr verərdi, amma tie-breaker olmadan bərabər sətirlərin sırası təsadüfidir.) 17-ci mövzunun \`row_number()\`-i bunu birbaşa edir.`,
      commonMistakes: ['Bərabərlikləri olan dəyər üzrə sıralamaq.', 'Tie-breaker olmadan ROWS əlavə etmək, bu da təsadüfi nömrələmə verir.'],
    },
    't16-q08': {
      title: 'Mərkəzləşdirilmiş window',
      prompt: `Bu sorğu nə qaytarır?`,
      hints: ['Hər frame əvvəlki sətir, sətrin özü və növbəti sətirdir, onlar mövcud olduqda.'],
      explanation: `Frame üç sətrə qədərdir: x = 1-in əvvəlki sətri yoxdur (1 + 2 = 3), x = 2 1 + 2 + 3 = 6 görür, x = 3 2 + 3 + 4 = 9 görür, x = 4-ün isə növbəti sətri yoxdur (3 + 4 = 7). Frame-lər kənarlarda sadəcə qısalır. Onlar NULL vermir.`,
      commonMistakes: ['Kənarlarda NULL gözləmək.', 'Onu kumulyativ cəmlə qarışdırmaq.'],
    },
    't16-q09': {
      title: 'Kumulyativ ödəniş balansı',
      prompt: `**2025-ci ilin may və ya iyununda** verilmiş sifarişlər üçün hər ödənişi sifarişin **kumulyativ balansı** ilə sadalayın: captured ödənişlər məbləğini əlavə edir, refunded olanlar onu çıxır, failed olanlar heç nəyi dəyişmir. Ödənişlər \`paid_at\` sırası ilə, bərabərlikdə \`payment_id\` üzrə tətbiq olunur.

- **Sütunlar:** \`order_id\`, \`payment_id\`, \`status\`, \`amount\`, \`balance\`
- **Sıralama:** \`order_id\` üzrə, sonra \`paid_at\`, sonra \`payment_id\`.`,
      hints: ['`sum(CASE status WHEN … THEN amount WHEN … THEN -amount ELSE 0 END) OVER (PARTITION BY order_id ORDER BY paid_at, payment_id)`'],
      explanation: `Aqreqatın içindəki CASE hər ödənişi işarəli hərəkətə çevirir, window isə onları hər sifariş üzrə yığır. Hər sifarişin balansının sıfırdan başlamasını sifariş üzrə partition təmin edir. Onsuz balans bütün sifarişlər boyu davam edir.

Uğursuz ödəniş 0 töhfə verir, ona görə də balans olduğu yerdə qalır. \`ELSE 0\`-ı buraxmayın: ELSE olmayan CASE NULL verir və sifarişin *ilk* ödənişi uğursuz olubsa, onun kumulyativ cəmi 0 yox, NULL olur (yalnız NULL-ların cəmi). Bəzi ödənişlər eyni \`paid_at\`-ı paylaşır. \`payment_id\` tie-breaker-i onların kumulyativ balanslarını fərqli və deterministik saxlayır.`,
      commonMistakes: ['Xam məbləğləri toplamaq (uğursuz və geri qaytarılmış ödənişlər əlavə olunur).', 'PARTITION BY order_id-ni unutmaq.'],
    },
    't16-q10': {
      title: 'Kumulyativ fərqli alıcılar',
      prompt: `**2024**-ün hər ayı üçün **həmin ayın sonuna qədər** 2024-də ən azı bir sifariş (istənilən statusda) vermiş **fərqli müştərilərin** sayı neçədir?

- **Sütunlar:** \`month\` (date), \`new_buyers\` (ilk 2024 sifarişi həmin ay olan müştərilər), \`cumulative_buyers\`
- **Sıralama:** \`month\` üzrə.`,
      hints: ['PostgreSQL-də `count(DISTINCT …) OVER` dəstəklənmir.', 'Hər müştərinin **ilk** 2024 sifariş ayını tapın, hər ilk ay üzrə müştəriləri sayın və həmin saylar üzərində kumulyativ cəm işlədin.'],
      explanation: `Aylıq fərqli sayları toplamaq bir neçə ayda alış edən hər müştərini iki dəfə sayır. Həll hər müştərini **bir dəfə**, ilk göründüyü ayda saymaqdır, onda "yeni" müştərilərin kumulyativ cəmi məhz kumulyativ fərqli saydır.

İkinci yanlış cavab **ümumiyyətlə** ilk sifarişi tapır, ona görə də 2024-dən əvvəl artıq alış etmiş müştərilər heç vaxt sayılmır. Sualın əhatəsi yalnız 2024-dür.`,
      commonMistakes: ['Aylıq fərqli sayları toplamaq.', '2024-dəki ilk sifariş əvəzinə ümumiyyətlə ilk sifarişi işlətmək.'],
    },
    't16-q11': {
      title: 'Sifariş partlayışları',
      prompt: `Hər sifariş üçün eyni müştərinin **ondan əvvəlki 30 gün ərzində, özü daxil olmaqla** (\`ordered_at - 30 days\`-dan \`ordered_at\`-a qədər, istənilən status) neçə sifariş verdiyini sayın. Yalnız həmin say **3 və ya daha çox** olan sifarişləri göstərin.

- **Sütunlar:** \`customer_id\`, \`order_id\`, \`ordered_at\`, \`orders_30d\`
- **Sıralama:** \`customer_id\` üzrə, sonra \`ordered_at\`, sonra \`order_id\`.`,
      hints: [`\`count(*) OVER (PARTITION BY customer_id ORDER BY ordered_at RANGE BETWEEN INTERVAL '30 days' PRECEDING AND CURRENT ROW)\``, 'Say üzrə xarici sorğuda filtrləyin.'],
      explanation: `"Son 30 gün" sətirlərin sayı yox, **vaxt** aralığıdır, ona görə də interval sürüşməli RANGE frame-i tələb edir: hər sifariş üçün frame müştərinin \`ordered_at\`-ı ondan əvvəlki 30 gün ərzində olan sifarişlərini saxlayır. \`ROWS 29 PRECEDING\` "nə qədər əvvəl olsa da, əvvəlki 29 sifariş" deməkdir, standart frame isə indiyədək bütün sifarişləri sayır.

Sürüşməli RANGE bunu dəstəkləyən tipdə (ədədlər, tarixlər, vaxt dəyərləri) düz bir ORDER BY sütunu tələb edir.`,
      commonMistakes: ['Vaxt window-u üçün ROWS n PRECEDING.', 'İlk sifarişdən bəri kumulyativ say.'],
    },
    't16-q12': {
      title: 'Gəlirin yarısını təşkil edən məhsullar',
      prompt: `Məhsulları ləğv edilməmiş sifarişlərdən bütün dövrlər üzrə gəlirlərinə görə dərəcələndirin (ən yüksək birinci, bərabərlikdə \`product_id\` üzrə). **Birləşmiş gəliri ümumi gəlirin ən azı 50%-inə çatan ən kiçik ən yuxarı məhsullar çoxluğunu** qaytarın, yəni kumulyativ payın 50%-i keçdiyi məhsul daxil olmaqla ona qədər hər məhsulu.

- **Sütunlar:** \`product_id\`, \`revenue\` (2 onluq rəqəm), \`running_share_pct\` (faizlə kumulyativ pay, 2 onluq rəqəm)
- **Sıralama:** \`revenue\` üzrə (ən yüksək birinci), sonra \`product_id\`.`,
      hints: ['Kumulyativ cəm: `sum(revenue) OVER (ORDER BY revenue DESC, product_id)`, cəm üçün isə `sum(revenue) OVER ()`.', 'Məhsul çoxluğa aiddir, əgər ondan **əvvəlki** pay hələ 50%-dən aşağı idisə.'],
      explanation: `Klassik Pareto sualı. Eyni hər məhsul sətirləri üzərində iki window: kumulyativ cəm (ciddi artan olsun deyə tie-breaker ilə gəlirə görə sıralanmış) və ümumi cəm.

Sərhəd incədir: \`running <= 50%\` xətti keçən məhsuldan **əvvəl** dayanır, ona görə də çoxluq heç vaxt həqiqətən 50%-ə çatmır. Cari məhsuldan *əvvəlki* payı yoxlamaq (\`running - revenue < 50%\`) keçən məhsulu daxil edir və ondan sonra heç nəyi.`,
      commonMistakes: ['Həddi keçən məhsuldan əvvəl dayanmaq.', 'Ləğv filtrini unutmaq.'],
    },
    't16-q13': {
      title: 'EXCLUDE CURRENT ROW',
      prompt: `Bu sorğu nə qaytarır?`,
      hints: ['Frame bütün partition-dur, cari sətir çıxılmaqla.'],
      explanation: `Frame hər sətri əhatə edir, \`EXCLUDE CURRENT ROW\` isə sətrin özünü çıxarır: 10 üçün digərləri 20 + 30 = 50; 20 üçün 10 + 30 = 40; 30 üçün 10 + 20 = 30. Hər biri 2 sətir görür. Digər variantlar: \`EXCLUDE GROUP\` (sətir və onun peer-ləri), \`EXCLUDE TIES\` (peer-lər, amma sətir yox), \`EXCLUDE NO OTHERS\` (standart).`,
      commonMistakes: ['EXCLUDE-un sayı yox, yalnız cəmi təsir etdiyini düşünmək.'],
    },
    't16-q14': {
      title: 'Maaş və həmkarlar',
      prompt: `Departamentdəki **aktiv** işçilər üçün onların maaşını və **eyni departamentdəki aktiv həmkarlarının, özləri sayılmadan, orta maaşını** göstərin (2 onluq rəqəm; həmkarları yoxdursa NULL).

- **Sütunlar:** \`department_id\`, \`employee_id\`, \`salary\`, \`colleagues_avg\`
- **Sıralama:** \`department_id\` üzrə, sonra \`employee_id\`.`,
      hints: ['`EXCLUDE CURRENT ROW` ilə bütün partition üzərində frame.', 'Və ya: `(sum - salary) / nullif(count - 1, 0)`.'],
      explanation: `\`EXCLUDE CURRENT ROW\` işçini öz frame-indən çıxarır. Frame açıq \`ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING\` tələb edir. Boş frame (bir nəfərlik departament) \`avg\`-ın NULL qaytarmasına səbəb olur.

Hesab alternativi də işləyir: departament cəmindən öz maaşını çıxın və bir nəfər az olana bölün. \`nullif\` bir nəfərlik departamentlər üçün sıfıra bölmənin qarşısını alır. "1 PRECEDING" yalnız window sırasında işçidən *əvvəlki* həmkarlara baxır.`,
      commonMistakes: ['İşçini öz ortasına daxil etmək.', 'Yalnız geriyə baxan frame.'],
    },
    't16-q15': {
      title: 'Rekord satış günləri',
      prompt: `Hansı günlər (UTC) ləğv edilməmiş sifarişlərin gündəlik gəliri üçün **bütün dövrlərin yeni rekordunu** qoyub, yəni hər əvvəlki günün gəlirindən yüksək olub? Ən birinci gün rekord sayılır.

- **Sütunlar:** \`day\` (date), \`revenue\` (2 onluq rəqəm), \`previous_record\` (2 onluq rəqəm, ilk gün üçün NULL)
- **Sıralama:** \`day\` üzrə.`,
      hints: ['Əvvəlki rekord bütün **əvvəlki** sətirlər üzərində max-dır: `ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING`.', 'Əvvəlki rekord NULL və ya daha aşağıdırsa, gün rekorddur.'],
      explanation: `\`ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING\` frame-i hər əvvəlki günü saxlayır, amma cari günü **yox**, ona görə də onun max-ı "bu gündən əvvəlki rekord"dur. Cari sətri daxil etmək hər günün özü ilə müqayisə edilməsinə səbəb olardı.

İlk gün üçün frame boşdur və max NULL qaytarır. \`revenue > NULL\` naməlumdur, birinci yanlış cavabın ilk günü itirməsi buna görədir. İl üzrə partition rekordu hər yanvarda sıfırlayardı ("illik rekordlar"), bu isə başqa sualdır.`,
      commonMistakes: ['NULL müqayisəsi səbəbindən ilk günü itirmək.', 'Rekordu hər il sıfırlamaq.'],
    },
    't16-q16': {
      title: '1 000-i keçən sifariş',
      prompt: `Hər müştəri üçün **kumulyativ xərcinin ilk dəfə 1 000 və ya daha çoxa çatdığı sifarişi** tapın (ləğv edilməmiş sifarişlər, çatdırılmasız sətir dəyərləri, sifarişlər \`ordered_at\` sırası ilə, bərabərlikdə \`order_id\` üzrə). Heç vaxt 1 000-ə çatmayan müştərilər nəzərə alınmır.

- **Sütunlar:** \`customer_id\`, \`order_id\`, \`ordered_at\`, \`cumulative_spend\` (2 onluq rəqəm, həmin sifariş daxil olmaqla kumulyativ cəm)
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: ['1-ci addım: sifariş dəyərləri. 2-ci addım: hər müştəri üzrə kumulyativ cəm. 3-cü addım: kumulyativ cəmi ≥ 1 000 olan ilk sifariş.', '`DISTINCT ON (customer_id) … ORDER BY customer_id, ordered_at, order_id` ilk uyğun sifarişi saxlayır.'],
      explanation: `Kumulyativ cəmlər düzgün **dənəvərlikdə** (grain) hesablanmalıdır. Sifariş *sətirləri* üzərində yığmaq (birinci yanlış cavab) düzgün sifarişi tapır, amma qismən cəm göstərir: sifarişin tam kumulyativ cəmini yox, sifariş daxilində 1 000-in keçildiyi anı.

Kumulyativ cəm yalnız artdığı üçün (dəyərlər mənfi deyil), \`cumulative >= 1000\` olan ilk sətir keçən sifarişdir. \`DISTINCT ON\` onu saxlayır. Ekvivalent olaraq, keçən sifariş ondan *əvvəlki* cəmin hələ 1 000-dən aşağı olduğu sifarişdir (alternativ).`,
      commonMistakes: ['Sətir səviyyəsində yığmaq.', 'Ləğv filtrini unutmaq.'],
    },
  },
};

export default topic;
