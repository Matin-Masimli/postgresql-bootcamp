import type { TopicText } from '../../i18n.ts';

const explanation = `Tarix və vaxt bir çox "düzgün görünən" sorğunun səhv getdiyi yerdir: ay sonları, uzun ilin 29 fevralı, saat qurşaqları, yay vaxtı. Verilənlərimiz qəsdən bunların hamısını ehtiva edir.

> **İstinad tarixi:** verilənlər **2025-06-30**-da bitir. Bunu "bu gün" kimi qəbul edin və cavablar təkrarlana bilən qalsın deyə \`CURRENT_DATE\` və ya \`now()\` əvəzinə \`DATE '2025-06-30'\` yazın.

## Tiplər

| tip | saxlayır | nümunə |
|---|---|---|
| \`date\` | təqvim günü | \`DATE '2024-02-29'\` |
| \`timestamptz\` | mütləq **an** (UTC kimi saxlanılır, sessiyanın qurşağında göstərilir) | \`TIMESTAMPTZ '2024-02-29 14:30:00+00'\` |
| \`timestamp\` | qurşaq **olmadan** "divar saatı" tarixi və vaxtı | \`TIMESTAMP '2024-02-29 14:30'\` |
| \`interval\` | müddət | \`INTERVAL '1 month 3 days'\` |

Bizim \`ordered_at\`, \`paid_at\` və s. \`timestamptz\`-dir. Sessiyanın saat qurşağı UTC-dir, ona görə də \`ordered_at::date\` **UTC** təqvim günüdür.

## Hesab əməliyyatları

\`\`\`sql
SELECT DATE '2025-06-30' - DATE '2025-01-01'           AS days_between,    -- integer: 180
       DATE '2025-06-30' + 7                            AS week_later,      -- date
       TIMESTAMPTZ '2025-06-30 12:00+00' - INTERVAL '36 hours' AS earlier, -- timestamptz
       DATE '2024-01-31' + INTERVAL '1 month'           AS month_end_jump,  -- 2024-02-29: sıxışdırılıb!
       age(DATE '2025-06-30', DATE '2000-02-29')        AS age_of_leapling; -- 25 years 4 mons 1 day
\`\`\`

- \`date - date\` günlərin **integer** sayıdır. \`timestamptz - timestamptz\` isə **interval**-dır.
- Ay əlavə etmək ayın sonuna **sıxışdırır**: 31 yanvar + 1 ay = 29 fevral (2024-də).
- Interval-ları interval-larla müqayisə edin: \`delivered_at - shipped_at > INTERVAL '7 days'\`, heç vaxt \`> 7\` yox.
- \`extract(epoch FROM interval)\` saniyələri verir, 86400-ə bölmək isə kəsrli günləri verir.

## extract / date_part və date_trunc

\`\`\`sql
SELECT ordered_at,
       extract(year FROM ordered_at)   AS yr,
       extract(quarter FROM ordered_at) AS qtr,
       extract(isodow FROM ordered_at) AS iso_weekday,   -- 1 = bazar ertəsi … 7 = bazar
       date_trunc('month', ordered_at) AS month_start,   -- hələ də timestamptz
       date_trunc('week', ordered_at)::date AS iso_week_monday
FROM orders
ORDER BY order_id
LIMIT 5;
\`\`\`

- \`extract\` \`numeric\` qaytarır. Səliqəli nəticə üçün \`::int\` ilə cast edin.
- \`dow\` **bazar = 0** … şənbə = 6 sayır. \`isodow\` isə bazar ertəsi = 1 … **bazar = 7** sayır.
- ISO həftələri: \`extract(week …)\` ISO həftə nömrəsidir və o, \`year\`-dən fərqli ola bilən \`isoyear\`-ə aiddir. 30 dekabr 2024 **ISO 2025-ci ilin 1-ci həftəsindədir**.
- \`date_trunc('month', ts)\` ayın ilk anını qaytarır. Son gün üçün \`INTERVAL '1 month' - INTERVAL '1 day'\` əlavə edin.

## Saat qurşaqları

\`AT TIME ZONE\` hər iki istiqamətdə çevirir:

\`\`\`sql
SELECT TIMESTAMPTZ '2024-03-31 01:30:00+00' AT TIME ZONE 'Europe/Berlin' AS berlin_wall_clock, -- 03:30 (CEST)
       TIMESTAMP   '2024-03-31 12:00:00'    AT TIME ZONE 'Asia/Tokyo'    AS moment_from_tokyo;  -- 03:00+00
\`\`\`

- \`timestamptz AT TIME ZONE 'zone'\` oradakı **yerli divar saatı vaxtını** verir (\`timestamp\`).
- \`timestamp AT TIME ZONE 'zone'\` divar saatı vaxtını həmin qurşağın yerli vaxtı kimi oxuyur və **anı** verir (\`timestamptz\`).
- Sabit sürüşmələr yox, IANA adları (\`'Europe/Berlin'\`) işlədin. Adlar yay vaxtı qaydalarına əməl edir, sürüşmələr isə yox.
- "Yerli gün üzrə sifarişlər" \`(ordered_at AT TIME ZONE c.timezone)::date\` deməkdir, bu da gecə yarısına yaxın UTC günündən fərqlənir.

## Tarixlər yaratmaq

\`\`\`sql
SELECT d::date AS day, to_char(d, 'Dy') AS weekday
FROM generate_series(DATE '2024-02-26', DATE '2024-03-02', INTERVAL '1 day') AS d;
\`\`\`

\`make_date(2025, 6, 30)\`, \`make_timestamptz(…)\` və \`make_interval(days => 3)\` dəyərləri hissələrdən qurur.

## Tələlər

- Vaxt dəyərində \`BETWEEN '2024-02-01' AND '2024-02-29'\` 29-unun gecə yarısında dayanır. Yarıaçıq aralıqlar işlədin (4-cü mövzu).
- \`extract(day …) = 31\` "ayın son günü" deyil.
- \`ordered_at::date\` sessiyanın saat qurşağından asılıdır. Bizimki UTC-dir.
- \`now()\` / \`CURRENT_DATE\` hər gün dəyişir. Tətbiqlərdə problem deyil, amma təkrarlana bilən hesabatlarda olmaz.`;

const topic: TopicText = {
  explanation,
  questions: {
    't11-q01': {
      title: 'İlk sifarişlərin ili və ayı',
      prompt: `**1-dən 10-a qədər** sifarişlər üçün onların verildiyi ili və ayın nömrəsini (UTC) tam ədədlər kimi göstərin.

- **Sütunlar:** \`order_id\`, \`ordered_at\`, \`order_year\`, \`order_month\`
- **Sıralama:** \`order_id\` üzrə.`,
      hints: [`\`extract(year FROM ordered_at)\` və \`extract(month FROM …)\`. \`::int\` ilə cast edin.`],
      explanation: `\`extract(field FROM value)\` tarixdən və ya vaxt dəyərindən bir komponent çıxarır: il, ay, gün, saat, dow, rüb, epoch… O, \`numeric\` qaytarır, buna görə də \`::int\`. \`date_part('month', ts)\` eyni şeyin funksiya çağırışı formasıdır.`,
      commonMistakes: ['Yanlış sahəni çıxarmaq.'],
    },
    't11-q02': {
      title: 'Tarixləri və vaxt dəyərlərini çıxmaq',
      prompt: `\`DATE '2025-06-30' - DATE '2025-06-01'\` və \`TIMESTAMPTZ '2025-06-30 12:00+00' - TIMESTAMPTZ '2025-06-01 12:00+00'\` ifadələrinin nəticə tipləri nədir?`,
      hints: ['Tarixin günün saatı yoxdur.'],
      explanation: `\`date − date\` **günlərin** sayını integer kimi verir (29). \`timestamptz − timestamptz\` **interval** verir ('29 days'). Vaxt fərqini müqayisə etmək üçün interval işlədin (\`> INTERVAL '7 days'\`) və ya onu \`extract(epoch FROM …)\` ilə çevirin.`,
      commonMistakes: ['Interval-ı adi ədədlə müqayisə etmək.'],
      options: ['interval və interval', 'integer (günlər) və interval', 'date və timestamp', 'integer və integer'],
    },
    't11-q03': {
      title: 'Ayın sonunda bir ay əlavə etmək',
      prompt: `Bu sorğu nə qaytarır?`,
      hints: ['31 fevral mövcud deyil. PostgreSQL marta keçir, yoxsa son günə sıxışdırır?', 'date + interval timestamp verir.'],
      explanation: `Ay və ya il əlavə etmək mümkün olduqda gün nömrəsini saxlayır, əks halda hədəf ayın **son gününə sıxışdırır**:

- 31 yanvar 2024 + 1 ay 29 fevral 2024 verir (uzun il).
- 31 yanvar 2025 + 1 ay 28 fevral 2025 verir.
- 29 fevral 2024 + 1 il 28 fevral 2025 verir.

\`date + interval\` \`timestamp\` qaytarır, buna görə də vaxt hissəsi var. Diqqət: sıxışdırma geri qaytarılan deyil: 28 fevral − 1 ay 31 yanvar yox, 28 yanvardır.`,
      commonMistakes: ['Marta keçəcəyini gözləmək.', 'Uzun illəri unutmaq.'],
    },
    't11-q04': {
      title: 'Günlərlə yolda keçən vaxt',
      prompt: `**1-dən 30-a qədər** sifarişlərin **çatdırılmış** göndərişləri üçün göndərmə ilə çatdırılma arasında neçə **təqvim günü** (UTC) keçdiyini göstərin.

- **Sütunlar:** \`shipment_id\`, \`shipped_at\`, \`delivered_at\`, \`transit_days\` (integer)
- **Sıralama:** \`shipment_id\` üzrə.`,
      hints: ['Hər iki vaxt dəyərini date-ə cast edib çıxın: nəticə günlərin integer sayıdır.'],
      explanation: `"Təqvim günləri" keçilən gecə yarılarını sayır, ona görə də əvvəlcə tarixlərə çevirin: \`delivered_at::date - shipped_at::date\`.

\`extract(day FROM interval)\` interval-ın *günlər sahəsini*, yəni tam 24 saatlıq dövrləri qaytarır, ona görə də 23:00 → növbəti gün 01:00 0 verir. Ayın gün nömrələrini çıxmaq ay sərhədlərində pozulur.`,
      commonMistakes: ['Təqvim günləri əvəzinə 24 saatlıq dövrləri saymaq.', 'Ayın gün nömrələrini çıxmaq.'],
    },
    't11-q05': {
      title: 'Hər iyun sifarişinin ayı və həftəsi',
      prompt: `**2025-ci ilin iyununda** (UTC) verilmiş sifarişlər üçün sifarişin **ayının** ilk gününü və ISO həftəsinin **bazar ertəsini** göstərin, hər ikisi \`date\` kimi.

- **Sütunlar:** \`order_id\`, \`month_start\`, \`week_start\`
- **Sıralama:** \`order_id\` üzrə.`,
      hints: [`\`date_trunc('month', ts)\` və \`date_trunc('week', ts)\`. ISO həftələri bazar ertəsi başlayır.`, 'Nəticələri date-ə cast edin.'],
      explanation: `\`date_trunc(unit, ts)\` vaxt dəyərini vahidin başlanğıcına **aşağı** yuvarlaqlaşdırır. \`'week'\` üçün bu, bazar ertəsi 00:00-dır (ISO həftələri).

\`dow\` gün çıxmaq əvvəlki **bazar** gününü verir, çünki \`dow\` bazarı 0 sayır. Alternativ ISO həftələrinə uyğun gələn \`isodow\` işlədir (bazar ertəsi = 1).`,
      commonMistakes: ['dow vasitəsilə bazardan başlayan həftələr.'],
    },
    't11-q06': {
      title: 'İyunda həftəsonu sifarişləri',
      prompt: `**2025-ci ilin iyununda** **şənbə və ya bazar** günü (UTC) verilmiş sifarişləri həftə gününün adı ilə göstərin.

- **Sütunlar:** \`order_id\`, \`weekday\` (məsələn, \`'Saturday'\`, doldurmasız)
- **Sıralama:** \`order_id\` üzrə.`,
      hints: [`\`extract(isodow …)\` şənbə üçün 6, bazar üçün 7-dir.`, `Doldurmasız həftə günü adı: \`to_char(ordered_at, 'FMDay')\`.`],
      explanation: `İki nömrələmə sistemi var: \`dow\` (bazar = 0 … şənbə = 6) və \`isodow\` (bazar ertəsi = 1 … bazar = 7). Onları qarışdırmaq, məsələn \`dow IN (6, 7)\`, bazar günlərini səssizcə itirir, çünki dow heç vaxt 7 qaytarmır.

\`to_char(…, 'Day')\` 9 simvola qədər doldurur, \`FM\` isə doldurmanı silir.`,
      commonMistakes: ['dow IN (6, 7): bu, bazar günlərini buraxır.', 'Doldurulmuş həftə günü adları.'],
    },
    't11-q07': {
      title: 'Tokioda yerli sifariş vaxtı',
      prompt: `\`timezone\` dəyəri **\`'Asia/Tokyo'\`** olan müştərilər üçün onların **2025-ci ilin iyununda** (UTC) verdiyi sifarişləri Tokiodakı **yerli divar saatı vaxtı** ilə göstərin.

- **Sütunlar:** \`order_id\`, \`ordered_at\`, \`local_time\` (saat qurşağı olmayan \`timestamp\`)
- **Sıralama:** \`order_id\` üzrə.`,
      hints: [`\`ordered_at AT TIME ZONE c.timezone\` anı yerli divar saatı vaxtına çevirir.`],
      explanation: `\`timestamptz AT TIME ZONE 'Asia/Tokyo'\` "həmin anda Tokiodakı saat nəyi göstərirdi?" sualına cavab verir (UTC+9).

- \`::timestamp\` sadəcə qurşağı atır və **UTC** divar saatını verir.
- \`timestamp AT TIME ZONE\` *əks* istiqamətdə gedir: divar saatı vaxtını Tokio vaxtı kimi oxuyur və anı qaytarır. UTC divar saatına tətbiq edildikdə vaxtı yanlış istiqamətdə 9 saat sürüşdürür.`,
      commonMistakes: ['Çevirmək əvəzinə qurşağı atmaq.', 'Yanlış istiqamətdə çevirmək.'],
    },
    't11-q08': {
      title: 'İstinad tarixinə müştəri yaşları',
      prompt: `\`birth_date\`-i məlum olan **1-dən 60-a qədər** müştərilər üçün onların **2025-06-30**-da **tamamlanmış illərlə yaşını** hesablayın. Onlardan biri uzun ilin 29 fevralında doğulub.

- **Sütunlar:** \`customer_id\`, \`birth_date\`, \`age\` (integer)
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: [`\`age(later_date, earlier_date)\` "25 years 4 mons 1 day" kimi interval qaytarır.`, `Onun illərini götürün: \`extract(year FROM age(…))::int\`.`],
      explanation: `\`age(a, b)\` təqvimi nəzərə alan fərq hesablayır: tam illər, sonra aylar, sonra günlər. Onun il komponenti keçmiş ad günlərinin sayıdır, bu da məhz "tamamlanmış illərlə yaş" deməkdir.

- İlləri çıxmaq bu ilin ad gününün artıq keçib-keçmədiyini nəzərə almır.
- Günləri 365-ə bölmək hər dörd ildə bir gün sürüşür, ona görə də ad gününə yaxın olanlar yanlış yaş alır.

29 fevralda doğulmuş müştəri (2000-02-29) istinad tarixində 25 yaşındadır.`,
      commonMistakes: ['İllərin çıxılması.', 'Günlər ÷ 365.'],
    },
    't11-q09': {
      title: 'Düzəlt: yavaş çatdırılmalar',
      prompt: `Bu sorğu göndərmədən sonra **çatdırılması 7 gündən çox çəkən** göndərişləri göstərməlidir, amma uğursuz olur. Düzəldin.

- **Sütunlar:** \`shipment_id\`, \`transit\` (\`delivered_at - shipped_at\` interval-ı)
- **Sıralama:** \`shipment_id\` üzrə.`,
      hints: [`\`delivered_at - shipped_at\`-in tipi nədir? Onu 7 tam ədədi ilə müqayisə etmək olarmı?`],
      explanation: `\`timestamptz - timestamptz\` **interval**-dır, \`interval > integer\` isə mövcud deyil (*operator does not exist*). Interval literalı ilə müqayisə edin: \`> INTERVAL '7 days'\`.

**Təqvim** günlərini müqayisə etmək (\`::date - ::date > 7\`) başqa qaydadır: o, keçən vaxtı yox, keçilən gecə yarılarını sayır. Saat 08:00-da göndərilib 7 gün 3 saat sonra çatan bağlama saata görə "7 gündən çox"dur, amma cəmi 7 təqvim günü fərqi var. Sizə verilən tərifə əməl edin.`,
      commonMistakes: ['Interval-ı ədədlə müqayisə etmək.'],
    },
    't11-q10': {
      title: '2024-ün təqvimi',
      prompt: `**2024-ün hər ayı** üçün ayın ilk günü və tam adı ilə bir sətir yaradın.

- **Sütunlar:** \`month_start\` (date), \`month_name\` (məsələn, \`'January'\`, doldurmasız)
- **Sıralama:** \`month_start\` üzrə. 12 sətir.`,
      hints: [`\`generate_series(DATE '2024-01-01', DATE '2024-12-01', INTERVAL '1 month')\``, `\`to_char(d, 'FMMonth')\``],
      explanation: `Tarixlər və interval addımı ilə \`generate_series(start, stop, step)\` hər addım üçün bir vaxt dəyəri yaradır. \`'1 month'\` addımı həmişə 1-inə düşür. \`'30 days'\` isə sürüşür, 31 yanvara, 1 marta… düşür və 13 sətir verir.

\`generate_series(1, 12)\` üzərində \`make_date(year, month, day)\` eyni dərəcədə yaxşı yanaşmadır.`,
      commonMistakes: ['1 ay əvəzinə 30 günlük addım.', 'Doldurulmuş ay adları.'],
    },
    't11-q11': {
      title: 'Ayın son günündəki sifarişlər',
      prompt: `**Ayının son təqvim günündə** (UTC) verilmiş bütün sifarişləri göstərin: 31 yanvar, 29 fevral 2024, 30 aprel, …

- **Sütunlar:** \`order_id\`, \`order_day\` (date)
- **Sıralama:** \`order_id\` üzrə.`,
      hints: ['Ayın son günü = ayın ilk günü + 1 ay − 1 gün.', `Və ya: növbəti gün 1-idir, yəni \`extract(day FROM ordered_at::date + 1) = 1\`.`],
      explanation: `Aylarda 28, 29, 30 və ya 31 gün var, ona görə də heç bir tək gün nömrəsi işləmir. Ayın sonunu hesablayın: \`date_trunc('month', ts) + INTERVAL '1 month' - INTERVAL '1 day'\`. Və ya *növbəti* günün ayın 1-i olduğu gözəl hiyləsini işlədin.

Verilənlərdə qəsdən 29 fevral 2024 və 30 aprel 2024 sifarişləri var, 31-ci gün versiyası onları buraxır. 30 və ya 31 versiyası isə 30 yanvar və bənzər günləri səhvən daxil edir.`,
      commonMistakes: ['Ayların 31-ci gündə bitdiyini düşünmək.'],
    },
    't11-q12': {
      title: 'ISO 2025-ci ilin 1-ci həftəsindəki sifarişlər',
      prompt: `**ISO 2025-ci ilinin 1-ci ISO həftəsində** (UTC) verilmiş sifarişləri göstərin. Diqqət: həmin həftə **30 dekabr 2024**, bazar ertəsi başlayır.

- **Sütunlar:** \`order_id\`, \`order_day\` (date)
- **Sıralama:** \`order_id\` üzrə.`,
      hints: [`\`extract(week …)\` ISO həftəsidir və o, \`year\`-ə yox, \`extract(isoyear …)\`-a aiddir.`],
      explanation: `ISO həftələri bazar ertəsi başlayır, 1-ci həftə isə ilin ilk cümə axşamını ehtiva edən həftədir. Ona görə də 30–31 dekabr 2024 **2025-ci ilin 1-ci həftəsinə** aiddir. \`extract(year)\` həmin günlər üçün 2024 deyir, ona görə də \`year\`-i \`week\` ilə birləşdirmək onları itirir. \`week\` ilə birlikdə \`isoyear\`, açıq tarix aralığı və ya \`to_char\`-ın \`IYYY-IW\` şablonunu işlədin.`,
      commonMistakes: ['ISO həftəsini təqvim ili ilə cütləşdirmək.', '1-ci həftənin 1 yanvarda başladığını düşünmək.'],
    },
    't11-q13': {
      title: 'Qeydiyyatdan ilk sifarişə qədər vaxt',
      prompt: `Sifariş vermiş hər müştəri qeydiyyatdan nə qədər sonra **ilk** sifarişini (istənilən statusda) verib? Bunu **bir onluq rəqəmlə günlərlə** ifadə edin (24 saat = 1 gün).

- **Sütunlar:** \`customer_id\`, \`first_order_id\`, \`days_to_first_order\`
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: [`Hər müştərinin ilk sifarişi: \`DISTINCT ON (customer_id) … ORDER BY customer_id, ordered_at, order_id\`.`, `İki vaxt dəyəri arasındakı saniyələr: \`extract(epoch FROM later - earlier)\`. 86400-ə bölün.`],
      explanation: `\`ORDER BY customer_id, ordered_at, order_id\` ilə \`DISTINCT ON (customer_id)\` hər müştərinin ən erkən sifarişini saxlayır (1-ci mövzu).

Müddət interval-dır. \`extract(epoch FROM interval)\` onu kəsrli günlər daxil saniyələrə çevirir, \`/ 86400\` isə saniyələri günlərə çevirir.

- Tarixlərin çıxılması təqvim günlərini sayır və saatları itirir.
- \`extract(day FROM interval)\` yalnız *günlər sahəsini* qaytarır, saatları atır, uzun interval-lar üçün isə hətta günlərin ümumi sayı da deyil.`,
      commonMistakes: ['Date-ə cast edərək günün saatını itirmək.', 'Interval üzərində extract(day).'],
    },
    't11-q14': {
      title: 'Hər iki istiqamətdə AT TIME ZONE',
      prompt: `31 mart 2024-də Berlinin saatları 02:00-dan 03:00-a keçdi. Bu sorğu nə qaytarır?`,
      hints: ['Keçiddən sonra Berlin UTC+2-dir (CEST).', 'timestamptz → AT TIME ZONE yerli vaxtı verir. timestamp → AT TIME ZONE isə UTC anını verir.'],
      explanation: `- **a:** 01:30 UTC keçiddən sonradır (01:00 UTC = yerli 03:00), ona görə də Berlin UTC+2-dədir: yerli vaxt **03:30**. Nəticə qurşaqsız timestamp-dır.
- **b:** Berlinin divar saatı ilə 12:00, UTC+2-də, **10:00 UTC** anıdır. Nəticə UTC sessiyamızda göstərilən timestamptz-dir.

Sabit \`+01\` sürüşməsi həmin gün üçün hər ikisini səhv verərdi.`,
      commonMistakes: ['Keçiddən sonra qış vaxtını (+1) işlətmək.', 'Yanlış istiqamətdə çevirmək.'],
    },
    't11-q15': {
      title: 'Yaxınlaşan ad günləri',
      prompt: `Marketinq ad günü kuponu göndərir. **İstinad tarixi 2025-06-30-dan sonrakı növbəti ad günü** **30 gün ərzinə** (2025-07-01-dən 2025-07-30 daxil olmaqla) düşən müştəriləri tapın.

- **Sütunlar:** \`customer_id\`, \`birth_date\`, \`next_birthday\` (date), \`days_until\`
- **Sıralama:** \`days_until\` üzrə, sonra \`customer_id\`.`,
      hints: ['Növbəti ad günü = doğum tarixi + (illərlə yaş + 1) il.', `\`age(DATE '2025-06-30', birth_date)\` tamamlanmış illəri verir. Interval ilə il əlavə etmək 29 fevralı sıxışdırma ilə emal edir.`, `\`days_until\` = next_birthday − DATE '2025-06-30'.`],
      explanation: `Növbəti ad gününü almağın etibarlı yolu "doğum tarixi üstəgəl (tamamlanmış illər + 1) il"dir. İl interval-ı əlavə etmək 29 fevralı düzgün emal edir (uzun olmayan illərdə 28 fevrala sıxışdırır) və pəncərə nə olursa olsun, hətta Yeni ili keçsə də işləyir.

Alternativ bu ilin ayı və günü ilə \`make_date\` işlədir. Burada bu, problem deyil, çünki pəncərə bir ay daxilindədir və 29 fevralı ehtiva edə bilməz. İl sonunu keçən pəncərələr və ya 29 fevral ad günləri üçün isə pozulardı.

İkinci yanlış cavab "bu ilin ad günü"nü işlədir və ad günü məhz istinad tarixində olan adamları daxil edir. Onların *növbəti* ad günü bir il sonradır.`,
      commonMistakes: ['Pəncərənin son gününü xaric etmək.', 'Artıq keçmiş ola bilən bu ilin ad gününü işlətmək.'],
    },
    't11-q16': {
      title: 'Səssizləşmiş müştərilər',
      prompt: `**Ən son uğurlu girişi** istinad tarixindən **90 gündən çox əvvəl** olan müştəriləri tapın (\`last_login < DATE '2025-06-30' - 90\`, girişin UTC tarixini müqayisə edərək). Heç vaxt daxil olmamış müştərilər sayılmır.

- **Sütunlar:** \`customer_id\`, \`last_login\` (timestamptz), \`days_since\` (integer: istinad tarixi − giriş tarixi)
- **Sıralama:** \`days_since\` üzrə (ən yüksək birinci), sonra \`customer_id\`.`,
      hints: [`Hər müştərinin ən son girişi: \`DISTINCT ON (customer_id) … ORDER BY customer_id, logged_in_at DESC\`.`, 'Nəticəni xarici sorğuda filtrləyin.'],
      explanation: `Tələ belədir: ən son girişi seçməzdən **əvvəl** \`logged_in_at < cut-off\` ilə filtrləmək, hətta dünən daxil olmuş müştərilər üçün də hər müştərinin ən son *köhnə* girişini qaytarır. "Ən son" əvvəlcə **bütün** girişlər üzərində seçilməli, sonra filtrlənməlidir. Bu, DISTINCT ON ətrafında subquery (19-cu mövzu) və ya HAVING ilə GROUP BY-dır (14-cü mövzu).

\`DATE - integer\` günləri çıxır, ona görə də \`DATE '2025-06-30' - 90\` 2025-04-01-dir. \`days_since\` üçün **tarixləri** çıxın (integer). \`DATE - timestamptz\` isə interval verir. Uğursuz giriş cəhdləri aktivlik sayılmır.`,
      commonMistakes: ['Ən son girişi tapmazdan əvvəl tarixə görə filtrləmək.', 'Uğursuz girişləri saymaq.'],
    },
  },
};

export default topic;
