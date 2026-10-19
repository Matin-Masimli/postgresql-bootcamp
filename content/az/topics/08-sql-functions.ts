import type { TopicText } from '../../i18n.ts';

const explanation = `**Funksiya** dəyərlər qəbul edib bir dəyər qaytarır: \`upper('abc')\`, \`round(2.567, 2)\`. Bu mövzu funksiyaların ümumiyyətlə necə işlədiyini və dəyərləri tiplər arasında **çevirən və formatlayan** funksiyaları əhatə edir. Sonra 9–12-ci mövzular mətn, ədədi, tarix və NULL funksiyalarını ətraflı öyrədir.

## Funksiya növləri

| növ | giriş → çıxış | nümunələr |
|---|---|---|
| **scalar** | bir sətir → bir dəyər | \`upper(name)\`, \`price::int\`, \`to_char(ordered_at, 'YYYY')\` |
| **aggregate** | çox sətir → bir dəyər | \`count(*)\`, \`sum(amount)\`, \`max(price)\` (14-cü mövzu) |
| **window** | çox sətir → *hər sətir üçün* bir dəyər | \`row_number() OVER (…)\` (15–18-ci mövzular) |
| **set-returning** | bir çağırış → çox sətir | \`generate_series(1, 5)\`, \`unnest(array)\` |

Funksiyalar iç-içə ola (\`upper(trim(name))\`) və ifadəyə icazə verilən hər yerdə işlədilə bilər: SELECT, WHERE, ORDER BY…

\`\`\`sql
SELECT upper('postgres')               AS scalar_result,
       pg_typeof(42)                   AS type_of_42,
       (SELECT count(*) FROM products) AS aggregate_result;
\`\`\`

## Cast: dəyərin tipini dəyişmək

\`\`\`sql
SELECT '42'::int + 1              AS pg_style,      -- PostgreSQL qısa yazılışı
       CAST('42' AS integer) + 1  AS sql_standard,  -- eyni şey
       DATE '2025-06-30'          AS typed_literal, -- mətn literalından əvvəl tip adı
       3.7::int                   AS numeric_to_int,-- yuvarlaqlaşdırır (4-ə)
       7 / 2                      AS int_division,  -- 3: tam ədəd ÷ tam ədəd tam ədəd qalır
       7::numeric / 2             AS numeric_division;
\`\`\`

- \`value::type\` və \`CAST(value AS type)\` ekvivalentdir.
- numeric → integer cast sıfırdan uzağa **yuvarlaqlaşdırır**. Kəsmir.
- Mümkün olmayan cast NULL yox, **xətadır**: \`'n/a'::numeric\` bütün sorğunu uğursuz edir.
- PostgreSQL 16+ əvvəlcə yoxlaya bilər: \`pg_input_is_valid('n/a', 'numeric')\` → false.
- \`pg_typeof(expr)\` istənilən ifadənin tipini göstərir, debug üçün rahatdır.
- **Gizli cast-lar** hədəf birmənalı olduqda baş verir: \`order_id = '42'\` işləyir, çünki literal integer-ə çevrilir. text tipli *sütunu* ədədlə müqayisə etmək isə işləmir.

## Dəyərləri mətn kimi formatlamaq: to_char

\`to_char(value, format)\` ədədləri və tarixləri şablona görə mətnə çevirir:

\`\`\`sql
SELECT to_char(1234.5, 'FM999,990.00')                      AS money_text,  -- '1,234.50'
       to_char(1234.5, '999,990.00')                        AS padded,      -- əvvəldə boşluqlar!
       to_char(TIMESTAMPTZ '2024-02-29 14:05:00+00', 'YYYY-MM-DD HH24:MI') AS iso_minute,
       to_char(DATE '2024-02-29', 'FMDay, FMDD FMMonth YYYY') AS long_date;  -- 'Thursday, 29 February 2024'
\`\`\`

Geniş yayılmış şablon elementləri: \`9\` rəqəm (lazım deyilsə boş), \`0\` rəqəm (həmişə göstərilir), \`,\` və \`.\` hərfi ayırıcılar, \`G\` və \`D\` locale-ə görə qrup və onluq ayırıcıları, \`YYYY\`, \`MM\`, \`DD\`, \`HH24\`, \`MI\`, \`SS\`, \`Mon\`/\`Month\`, \`Dy\`/\`Day\`. **\`FM\` doldurmanı silir**: onsuz ədədlər əvvəldə boşluq alır, ay və gün adları isə 9 simvola qədər doldurulur.

## Mətni oxumaq: to_date, to_timestamp, to_number

Əks istiqamət mətni verilmiş formatda oxuyur:

\`\`\`sql
SELECT to_date('05/04/2023', 'DD/MM/YYYY')        AS dmy,     -- 2023-04-05
       to_date('Apr 05, 2023', 'Mon DD, YYYY')    AS mon_dd,  -- 2023-04-05
       to_number('$1,234.50', 'L9G999G999D99')    AS money,   -- 1234.50
       '2023-04-05'::date                         AS iso_cast;-- ISO mətni birbaşa cast olunur
\`\`\`

Mətn PostgreSQL-in defolt formatında olmadıqda bunları işlədin. \`staging_customer_import\` cədvəlimiz belə mətnlərlə doludur: hər mənbə fayl öz tarix formatından istifadə edir.

## format(): mətn qurmaq

\`format('%s (%s)', name, sku)\` arqumentləri şablona yerləşdirir. \`%s\` istənilən dəyəri mətn kimi daxil edir, \`%L\` / \`%I\` isə dinamik SQL üçün literalları və identifikatorları təhlükəsiz şəkildə dırnağa alır.

## Tələlər

- **AND icra sırasına zəmanət vermir.** \`WHERE raw <> 'n/a' AND raw::numeric > 0\` yenə də 'n/a'-nı cast etməyə cəhd edə bilər. Sıraya yalnız \`CASE\` zəmanət verir (13-cü mövzu).
- \`to_char\` **text** qaytarır, text isə əlifba sırası ilə sıralanır: '10' < '9'. Əvəzində ilkin dəyərə görə sıralayın.
- Vaxt dəyərini date-ə cast etmək saatı **sessiyanın saat qurşağında** (burada UTC) atır.`;

const topic: TopicText = {
  explanation,
  questions: {
    't08-q01': {
      title: 'Tam avro qiymətləri',
      prompt: `\`product_id\` üzrə **ilk 10 məhsul** üçün qiyməti və **integer-ə cast olunmuş** qiyməti göstərin.

- **Sütunlar:** \`product_id\`, \`price\`, \`whole_price\`
- **Sıralama:** \`product_id\` üzrə. 10 sətir.`,
      hints: ['`price::int` və ya `CAST(price AS integer)`.'],
      explanation: `\`price::int\` numeric-i integer-ə çevirir və bunu edərkən PostgreSQL (sıfırdan uzağa) **yuvarlaqlaşdırır**: 49.99 50 olur. Onluq hissəni kəsmək istəyirsinizsə, \`trunc()\` və ya \`floor()\` işlədin (10-cu mövzu). Burada onlar 49 verərdi.`,
      commonMistakes: ['Cast-ın kəsəcəyini gözləmək. O, yuvarlaqlaşdırır.'],
    },
    't08-q02': {
      title: 'Funksiya növləri',
      prompt: `Bunlardan hansı **set-returning** funksiyadır, yəni bir çağırış **bir neçə sətir** yaradır?`,
      hints: ['Scalar: hər sətir üçün bir dəyər. Aggregate: çox sətir üçün bir dəyər. Window: çox sətir üzərində hesablanan, hər sətir üçün bir dəyər.'],
      explanation: `\`generate_series(1, 10)\` bir çağırışdan 10 sətir qaytarır, buna görə də adətən FROM-da işlədilir. \`upper\` scalar-dır, \`count\` aggregate-dir (çox sətir daxil olur, bir dəyər çıxır), \`row_number\` isə window function-dır (sətirlərin window-u üzərində hesablanan, hər sətir üçün bir dəyər).`,
      commonMistakes: ['Window function-ları (hər sətir üçün bir nəticə) set-returning funksiyalarla (bir çağırışa çox sətir) qarışdırmaq.'],
      options: ['`upper(name)`', '`count(*)`', '`generate_series(1, 10)`', '`row_number() OVER (ORDER BY id)`'],
    },
    't08-q03': {
      title: 'Cast-lar və bölmə',
      prompt: `Bu sorğu nə qaytarır?`,
      hints: ['3.7-ni integer-ə cast etmək yuvarlaqlaşdırır, yoxsa kəsir?', '7 / 2-nin tipi nədir?'],
      explanation: `- **a = 43:** '42' toplamadan əvvəl 42 tam ədədinə çevrilir. \`+\` hesab əməliyyatıdır, heç vaxt mətnlərin birləşdirilməsi deyil.
- **b = 4:** numeric → integer yuvarlaqlaşdırır.
- **c = 3:** tam ədəd ÷ tam ədəd tam bölmədir və kəsr hissəsi atılır.
- **d = 3.5:** operandlardan biri numeric olduqda bölmə dəqiqdir (3.5000000000000000 kimi göstərilir).`,
      commonMistakes: ['7 / 2 = 3.5 gözləmək.', 'Integer cast-ın kəsəcəyini gözləmək.'],
    },
    't08-q04': {
      title: 'Oxunaqlı sifariş tarixləri',
      prompt: `**29 fevral 2024**-də (UTC) verilmiş sifarişləri sifariş tarixi **\`29 Feb 2024\`** kimi formatlanmış halda göstərin.

- **Sütunlar:** \`order_id\`, \`order_day\` (text)
- **Sıralama:** \`order_id\` üzrə.`,
      hints: [`\`to_char(timestamp, pattern)\`. "29 Feb 2024" üçün şablon \`'DD Mon YYYY'\`-dir.`],
      explanation: `\`to_char\` vaxt dəyərini şablonla formatlayır: \`DD\` ayın günü, \`Mon\` ayın qısaldılmış adı, \`YYYY\` ildir. \`Month\` 9 simvola qədər doldurulmuş "February" verərdi. Doldurmanı silmək üçün \`FM\` əlavə edin (\`FMMonth\`).

Nəticə text-dir. Formatlanmış mətnə görə yox, ilkin vaxt dəyərinə görə sıralayın və ya filtrləyin.`,
      commonMistakes: ['Mon əvəzinə Month (tam ad, doldurulmuş) işlətmək.'],
    },
    't08-q05': {
      title: 'Fevral ixracının tarixlərini oxuyun',
      prompt: `\`staging_customer_import\`-də **\`crm_export_2024_02.csv\`** faylı qeydiyyat tarixlərini **gün/ay/il** formatında mətn kimi saxlayır, məsələn \`'18/03/2022'\`. Bəzi sətirlərdə əvəzində boş mətn, \`'unknown'\` və ya NULL var.

Həmin faylın real tarixi olan sətirləri üçün oxunmuş **\`date\`**-i qaytarın.

- **Sütunlar:** \`import_row_id\`, \`signup_date\` (tipi \`date\`)
- **Sıralama:** \`import_row_id\` üzrə.`,
      hints: [`\`to_date(text, 'DD/MM/YYYY')\` bu formatı oxuyur.`, `\`''\` və \`'unknown'\`-u xaric edin. NULL istənilən müqayisə ilə avtomatik xaric olur.`],
      explanation: `\`'18/03/2022'\` PostgreSQL-in defolt ISO formatında deyil, ona görə də sadə \`::date\` cast uğursuz olur. \`to_date(text, 'DD/MM/YYYY')\` PostgreSQL-ə günün, ayın və ilin harada olduğunu dəqiq bildirir.

Onu MM/DD kimi oxumaq gün ≤ 12 olduqda yanlış tarixlər, "ay" 13 və ya daha çox olduqda isə dərhal xəta verərdi. Zibil dəyərlər əvvəlcə süzülməlidir, çünki \`to_date('unknown', …)\` xətadır.`,
      commonMistakes: ['Günü və ayı yerdəyişmək.', '::date ilə cast etmək: o, bu formatı oxuya bilmir.'],
    },
    't08-q06': {
      title: 'Valyuta işarəsi ilə yazılmış pulu oxuyun',
      prompt: `**\`legacy_dump.csv\`** faylı lifetime value dəyərlərini \`'$1,234.50'\` kimi saxlayır (bəzi sətirlərdə əvəzində \`'n/a'\` və ya boş mətn var).

Həmin faylın real məbləği olan sətirləri üçün onu **ədədə** çevirin.

- **Sütunlar:** \`import_row_id\`, \`lifetime_value\` (numeric)
- **Sıralama:** \`import_row_id\` üzrə.`,
      hints: [`\`to_number(text, pattern)\`: \`L\` valyuta simvoluna, \`G\` minliklər ayırıcısına, \`D\` onluq nöqtəyə uyğun gəlir.`, `\`'L9G999G999D99'\` kimi şablon 9 999 999.99-a qədər dəyərləri əhatə edir.`],
      explanation: `\`to_number\` mətni formatın "şəkli" ilə oxuyur: \`L\` valyuta simvolu, \`9\` rəqəmlər, \`G\` qrup (minliklər) ayırıcısı, \`D\` onluq nöqtə. Şablon ən böyük dəyərə imkan verməli və onluq hissəni ehtiva etməlidir. \`D99\` olmadan qəpiklər itir, çox qısa şablon isə böyük məbləğləri kəsir.

Formatlamanı \`replace()\` ilə (9-cu mövzu) silib cast etmək də eyni dərəcədə düzgün yanaşmadır.`,
      commonMistakes: ['Ən böyük dəyərlər üçün çox qısa şablon.', 'Onluq hissəni buraxmaq.'],
    },
    't08-q07': {
      title: 'format() ilə məhsul etiketləri',
      prompt: `**Ən bahalı 10 məhsul** üçün (bərabərlikdə \`product_id\` üzrə) **\`<sku> | <name> | <price> EUR\`** formasında rəf etiketləri qurun, məsələn \`LAP-1014 | Halcyon Laptop 14" | 1999.00 EUR\`.

- **Sütunlar:** \`product_id\`, \`label\`
- **Sıralama:** \`price\` üzrə (ən yüksək birinci), sonra \`product_id\`.`,
      hints: [`\`format('%s | %s | %s EUR', sku, name, price)\``],
      explanation: `\`format()\` \`%s\` yer tutucularını arqumentləri ilə, sıra ilə, hər birini mətnə çevirərək doldurur. Bu, çox vaxt uzun \`||\` zəncirindən daha oxunaqlıdır.

Bonus: \`format\` NULL arqumentləri boş mətn kimi qəbul edir, \`||\` isə hər hansı hissə NULL olduqda bütün nəticəni NULL edir.`,
      commonMistakes: ['Arqumentlər yanlış sırada.', 'Valyuta sonluğunu unutmaq.'],
    },
    't08-q08': {
      title: 'Minliklər ayırıcısı ilə qiymətlər',
      prompt: `**Ən bahalı 10 məhsulu** (bərabərlikdə \`product_id\` üzrə) qiyməti **minliklər ayırıcısı vergül, düz iki onluq rəqəm** olan və **əvvəldə boşluqsuz** mətn kimi formatlanmış halda göstərin: \`1,999.00\`, \`549.99\`.

- **Sütunlar:** \`product_id\`, \`price_text\`
- **Sıralama:** \`price\` üzrə (ən yüksək birinci), sonra \`product_id\`.`,
      hints: [`\`to_char(price, '999,990.00')\` boşluqlarla doldurur. Hansı prefiks doldurmanı silir?`],
      explanation: `\`to_char\`-ın ədəd şablonlarında \`9\` məcburi olmayan rəqəm, \`0\` məcburi rəqəm, \`,\` / \`.\` isə hərfi ayırıcılardır. \`FM\` ("fill mode") olmadan nəticə solda şablonun tam eninə qədər, üstəgəl işarə üçün bir boşluqla doldurulur. \`FM\` bu doldurmanı silir.

\`'990.00'\` 1-dən kiçik dəyərlər üçün " .50" yox, "0.50" verilməsinə zəmanət verir.`,
      commonMistakes: ['FM-i unutmaq: bu, əvvəldə boşluqlar qoyur.', 'Minliklər ayırıcısı olmayan ::text işlətmək.'],
    },
    't08-q09': {
      title: 'Hansı xam tarixlər ISO tarix deyil?',
      prompt: `**\`crm_export_2024_01.csv\`** faylının \`signup_date_raw\` sütununda ISO tarixləri (\`YYYY-MM-DD\`) olmalıdır. Onun dəyəri **olan (NULL olmayan), amma PostgreSQL üçün düzgün tarix olmayan** sətirlərini tapın.

- **Sütunlar:** \`import_row_id\`, \`signup_date_raw\`
- **Sıralama:** \`import_row_id\` üzrə.`,
      hints: [`PostgreSQL 16+-da cast-ı xəta vermədən yoxlayan \`pg_input_is_valid(text, 'date')\` var.`],
      explanation: `\`pg_input_is_valid(value, type)\` sorğunu uğursuz etmədən "bu cast uğurlu olardımı?" sualına cavab verir. Bu, səhv verilənləri çevirməzdən əvvəl tapmağın səliqəli yoludur.

Praktikada NULL xüsusi emal tələb etmir: \`pg_input_is_valid(NULL, 'date')\` NULL qaytarır, onun NOT-u da NULL-dur və həmin sətirlər onsuz da düşür. Açıq \`IS NOT NULL\` sadəcə niyyəti sənədləşdirir.

Fayl filtrini unutmayın: digər fayllar ISO olmayan formatlar işlədir, ona görə də onların demək olar ki, bütün tarixləri "düzgün deyil" kimi göstərilərdi. Yalnız bir məlum zibil dəyəri axtarmaq isə boş mətnləri buraxır.`,
      commonMistakes: ['Qanuni olaraq başqa format işlədənlər də daxil, bütün faylları yoxlamaq.', 'Yalnız bir məlum zibil dəyəri axtarmaq.'],
    },
    't08-q10': {
      title: 'Düzəlt: zibil dəyərdə çökən cast',
      prompt: `Bu sorğu iki **CRM ixrac faylının** (\`source_file LIKE 'crm_export%'\`) lifetime value dəyəri **1000-dən yuxarı** olan sətirlərini göstərməlidir. Həmin fayllarda dəyər \`'2006.31'\` kimi sadə ədəddir, amma bəzi sətirlərdə \`'n/a'\` və ya \`''\` var. Sorğu uğursuz olur. Düzəldin.

- **Sütunlar:** \`import_row_id\`, \`lifetime_value_raw\`
- **Sıralama:** \`import_row_id\` üzrə.`,
      hints: ['Hansı dəyərlər numeric-ə cast oluna bilmir?', `AND təhlükəsiz şərtin birinci icra olunmasına zəmanət vermir. CASE verir: \`CASE WHEN … THEN raw::numeric END > 1000\`.`],
      explanation: `\`'n/a'::numeric\` *invalid input syntax for type numeric* xətası verir və bir səhv sətir bütün sorğunu uğursuz edir.

\`AND lifetime_value_raw NOT IN ('n/a', '')\` əlavə edib onun birinci yoxlanacağına ümid edə bilərsiniz, amma **SQL AND/OR üçün heç bir icra sırası vəd etmir**. Planner cast-ı birinci icra edə bilər. \`CASE WHEN safe THEN cast END\` THEN budağını yalnız şərt true olduqda icra etməyə zəmanət verir (13-cü mövzu). Təhlükəli sətirlər NULL olur və \`NULL > 1000\` onları sadəcə süzür.

**Mətn** kimi müqayisə (\`> '1000'\`) işləyir, amma yanlışdır: əlifba sırası ilə '999' > '1000'.`,
      commonMistakes: ['AND-in qısa qapanmasına güvənmək.', 'Ədədləri mətn kimi müqayisə etmək.'],
    },
    't08-q11': {
      title: 'Hər faylın tarixlərini oxuyun',
      prompt: `\`staging_customer_import\`-də hər fayl \`signup_date_raw\`-da öz tarix formatından istifadə edir:

| source_file | format | nümunə |
|---|---|---|
| \`crm_export_2024_01.csv\` | \`YYYY-MM-DD\` | 2022-12-23 |
| \`crm_export_2024_02.csv\` | \`DD/MM/YYYY\` | 18/03/2022 |
| \`legacy_dump.csv\` | \`Mon DD, YYYY\` | Jun 11, 2023 |

Hər üç fayl üzrə **real tarixi olan hər sətrin** (NULL deyil, \`''\` deyil, \`'unknown'\` deyil) oxunmuş tarixini qaytarın.

- **Sütunlar:** \`import_row_id\`, \`signup_date\` (tipi \`date\`)
- **Sıralama:** \`import_row_id\` üzrə.`,
      hints: [`Hər fayl üçün öz \`to_date\` şablonu olan bir SELECT, UNION ALL ilə birləşdirilmiş (7-ci mövzu).`, 'Zibil dəyərlər üzrə filtr hər budağa gedir.'],
      explanation: `Fərqli sətirlər fərqli çevirmələr tələb etdikdə işi bölün: hər format üçün öz \`to_date\` şablonu olan bir budaq və UNION ALL ilə birləşdirmə. Budaqlar üst-üstə düşə bilmir (fərqli fayllar), ona görə də UNION ALL düzgündür.

CASE (13-cü mövzu) alternativdə olduğu kimi eyni şeyi bir SELECT-də ifadə edə bilər. Hər iki halda zibil filtri istənilən çevirmədən əvvəl tətbiq olunmalıdır.`,
      commonMistakes: ['Bütün fayllar üçün bir şablon işlətmək.', 'Bir faylı unutmaq.'],
    },
    't08-q12': {
      title: 'Bu hansı tipdir?',
      prompt: `\`pg_typeof\` hər ifadə üçün nə göstərir?`,
      hints: ['Onluq nöqtəsi olan literal başqa cür cast olunmayıbsa, numeric-dir.', 'İki tarixi çıxmaq günlərin sayını verir.'],
      explanation: `- \`1\` **integer**-dir.
- \`1.5\` **numeric**-dir: PostgreSQL onluq literalları sürüşən nöqtəli yox, dəqiq numeric kimi qəbul edir.
- \`text || integer\` birləşdirir və nəticə **text**-dir.
- \`date - date\` günlərin sayıdır, **integer**. Vaxt dəyərlərini çıxmaq isə *interval* verir (11-ci mövzu).`,
      commonMistakes: ['Onluq literalların sürüşən nöqtəli olduğunu düşünmək.', 'Tarixləri çıxmaqdan interval gözləmək.'],
    },
    't08-q13': {
      title: 'Uzun formalı 29 fevral tarixləri',
      prompt: `**29 fevral 2024**-də (UTC) verilmiş sifarişlər üçün tarixi tam yazılmış halda, dəqiq **\`Thursday, 29 February 2024\`** kimi göstərin: heç yerdə artıq boşluq olmadan.

- **Sütunlar:** \`order_id\`, \`long_date\`
- **Sıralama:** \`order_id\` üzrə.`,
      hints: [`\`Day\` həftə gününün adını, \`Month\` isə ayın adını verir, hər ikisi 9 simvola qədər doldurulmuş.`, `Hər doldurulan sahənin önünə \`FM\` qoyun: \`'FMDay, FMDD FMMonth YYYY'\`.`],
      explanation: `\`Day\` və \`Month\` ən uzun adın ("Wednesday", "September") eninə qədər boşluqlarla doldurulur, ona görə də \`FM\` olmadan \`'Thursday , 29 February  2024'\` alırsınız. \`FM\` yalnız növbəti sahəyə tətbiq olunur, buna görə də hər sahədən əvvəl təkrarlanır.

\`Dy\` / \`Mon\` üç hərfli qısaltmalardır.`,
      commonMistakes: ['FM-i unutmaq (doldurma).', 'Qısaldılmış adları işlətmək.'],
    },
    't08-q14': {
      title: 'Faiz etiketi kimi komissiya',
      prompt: `**Aktiv Sales işçiləri** (\`department_id = 2\`, \`termination_date IS NULL\`) üçün komissiyalarını **\`'7.5%'\`** və ya **\`'10.0%'\`** kimi etiketlə göstərin (həmişə bir onluq rəqəm). Komissiyası olmayan işçilər NULL göstərir.

- **Sütunlar:** \`employee_id\`, \`commission_label\`
- **Sıralama:** \`employee_id\` üzrə.`,
      hints: [`\`commission_pct\` kəsrdir (0.075), ona görə də 100-ə vurun.`, `\`to_char(…, 'FM990.0')\`, sonra \`||\` ilə \`'%'\` əlavə edin.`],
      explanation: `1. Kəsrdən faizə: \`commission_pct * 100\` (0.075 7.500 olur).
2. Düz bir onluq rəqəm: \`to_char(…, 'FM990.0')\` və ya \`numeric(5,1)\`-ə cast. Xam ədədi birləşdirmək \`7.500%\` göstərərdi.
3. \`|| '%'\` işarəni əlavə edir. NULL komissiya NULL qalır: \`to_char(NULL)\` NULL-dur, NULL || '%' də NULL-dur.`,
      commonMistakes: ['100-ə vurmağı unutmaq.', 'Onluq rəqəmlərin sayına nəzarət etməmək.'],
    },
    't08-q15': {
      title: 'Hər fayldan təmiz lifetime value-lar',
      prompt: `\`staging_customer_import\`-in **bütün sətirləri** üçün \`lifetime_value_raw\`-u **numeric** dəyərə çevirin:

- CRM faylları sadə ədədlər saxlayır (\`'2006.31'\`), legacy fayl isə \`'$1,234.50'\` işlədir;
- \`'n/a'\`, \`''\` və NULL **NULL** olmalıdır (xəta olmadan).

- **Sütunlar:** \`import_row_id\`, \`lifetime_value\`
- **Sıralama:** \`import_row_id\` üzrə. Hər import sətri üçün bir sətir.`,
      hints: [`Əvvəlcə formatlamanı silin: \`replace(replace(raw, '$', ''), ',', '')\`.`, `\`NULLIF(x, '')\` boş mətni NULL-a çevirir (12-ci mövzu). \`'n/a'\`-ya da eyni cür yanaşın.`, 'NULL-u cast etmək xətasız NULL verir.'],
      explanation: `Mətni ədədlərə çevirərək təmizləmək gündəlik data engineering işidir. Etibarlı resept:

1. **Formatlamanı silin:** \`$\`-ı və minliklər ayırıcısını çıxarın. \`translate(raw, '$,', '')\` hər ikisini bir çağırışda silir.
2. **Zibili NULL-a çevirin:** \`NULLIF(x, 'n/a')\` və \`NULLIF(x, '')\` məhz həmin dəyərlər üçün NULL qaytarır.
3. **Cast edin:** \`::numeric\`. NULL xətasız NULL-a cast olunur.

1-ci addımın vergülünü unutsanız, \`'1,234.50'\` cast oluna bilmir. Legacy faylı süzmək problemdən "yayınır", amma çox az sətir qaytarır. \`pg_input_is_valid\` + CASE (alternativ) ən müdafiəçi versiyadır: oxuna bilməyən hər şey NULL olur.`,
      commonMistakes: ['Minliklər ayırıcısını silməmək.', 'Sətirləri çevirmək əvəzinə süzüb atmaq.'],
    },
    't08-q16': {
      title: 'Mümkün olmayan qeydiyyat tarixləri',
      prompt: `Qeydiyyat sətrin import edildiyi andan **sonra** ola bilməz. \`signup_date_raw\`-u hər faylın öz formatı ilə oxuyun ("Hər faylın tarixlərini oxuyun" sualındakı cədvələ baxın: ISO, DD/MM/YYYY, Mon DD, YYYY) və oxunmuş qeydiyyat tarixi **\`imported_at::date\`-dən gec** olan sətirləri tapın. NULL, \`''\` və \`'unknown'\`-u nəzərə almayın.

- **Sütunlar:** \`import_row_id\`, \`source_file\`, \`signup_date\`, \`imported_on\` (\`imported_at::date\`)
- **Sıralama:** \`import_row_id\` üzrə.

*Cavabın boş olması normaldır: təmiz nəticə də nəticədir. Burada o, yalnız verilənlərdə problem olduqda boş olmur…*`,
      hints: [`UNION ALL oxuma üsulunu təkrar işlədin, hər budaqda \`source_file\` və \`imported_at\`-i saxlayın.`, `UNION ALL-u subquery-yə alın, sonra \`signup_date > imported_on\` üzrə filtrləyin.`],
      explanation: `Oxunmuş verilənləri digər sütunlarla yoxlamaq real verilən keyfiyyəti yoxlamalarının iş prinsipidir. Hər faylı öz şablonu ilə oxuyun (UNION ALL), müqayisə üçün lazım olan sütunları saxlayın, sonra xarici sorğuda filtrləyin.

Düzgün gün/ay sırası ilə bütün qeydiyyatlar keçmişdədir, ona görə də bu sorğu **heç bir sətir qaytarmır**. Bu, düzgün cavabdır və yoxlayıcı burada boş nəticəni qəbul edir. DD/MM faylı üçün günü və ayı yerdəyişmək məhz bu yoxlamanın tutmalı olduğu səhvdir: birdən bir çox qeydiyyat "gələcəyə" düşür.`,
      commonMistakes: ['Günü və ayı yerdəyişmək (MM/DD).', '"Gec"in nə demək olduğuna qərar vermədən vaxt dəyərini tarixlə müqayisə etmək.'],
    },
  },
};

export default topic;
