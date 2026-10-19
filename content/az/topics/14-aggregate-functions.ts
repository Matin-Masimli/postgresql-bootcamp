import type { TopicText } from '../../i18n.ts';

const explanation = `Aqreqat funksiyaları **çoxlu sətri bir dəyərə** çevirir: neçə, nə qədər, orta, ən böyük. \`GROUP BY\` ilə **hər qrup üçün** bir nəticə alırsınız.

\`\`\`sql
SELECT status,
       count(*)                 AS orders,
       min(ordered_at)::date    AS first_order,
       max(ordered_at)::date    AS last_order
FROM orders
GROUP BY status
ORDER BY orders DESC;
\`\`\`

## Əsas aqreqatlar

| funksiya | qeydlər |
|---|---|
| \`count(*)\` | sətirləri sayır |
| \`count(expr)\` | NULL olmayan dəyərləri sayır. \`count(DISTINCT expr)\` fərqli dəyərləri sayır |
| \`sum\`, \`avg\` | NULL-ları nəzərə almır. Tam ədədlərin \`avg\`-ı numeric qaytarır |
| \`min\`, \`max\` | ədədlər, mətn, tarixlər üzərində işləyir |
| \`string_agg(expr, sep ORDER BY …)\`, \`array_agg(… ORDER BY …)\` | dəyərləri birləşdirir (onları açıq sıralayın!) |
| \`bool_and\`, \`bool_or\` | "hamısı true-dur?" / "hər hansı biri true-dur?" |
| \`percentile_cont(0.5) WITHIN GROUP (ORDER BY x)\` | **median** (interpolyasiya edilmiş). \`percentile_disc\` həqiqi dəyəri seçir |
| \`mode() WITHIN GROUP (ORDER BY x)\` | ən çox təkrarlanan dəyər |

**Sıfır sətir** üzərində \`count\` 0, digər bütün aqreqatlar isə NULL qaytarır.

## GROUP BY qaydaları

SELECT siyahısındakı hər sütun ya **aqreqatın içində**, ya da **GROUP BY-da sadalanmış** olmalıdır. Əks halda PostgreSQL hansı dəyəri göstərəcəyini bilə bilməz (*must appear in the GROUP BY clause or be used in an aggregate function*). PostgreSQL bir istisna edir: cədvəlin **primary key**-i üzrə qruplaşdırsanız, onun digər sütunlarını seçə bilərsiniz.

İfadələr üzrə qruplaşdıra bilərsiniz: \`GROUP BY date_trunc('month', ordered_at)\`, və ya nəticə sütunlarına mövqeyə görə istinad edə bilərsiniz (\`GROUP BY 1\`).

## WHERE və HAVING

- \`WHERE\` qruplaşdırmadan **əvvəl sətirləri** filtrləyir. O, aqreqatları işlədə bilməz.
- \`HAVING\` aqreqasiyadan **sonra qrupları** filtrləyir.

\`\`\`sql
-- Ən azı 10 ləğv edilməmiş sifarişi olan müştərilər
SELECT customer_id, count(*) AS orders
FROM orders
WHERE status <> 'cancelled'      -- sətirlər
GROUP BY customer_id
HAVING count(*) >= 10            -- qruplar
ORDER BY orders DESC, customer_id;
\`\`\`

## FILTER: şərti aqreqatlar

\`\`\`sql
SELECT date_trunc('year', ordered_at)::date AS year,
       count(*)                                        AS all_orders,
       count(*) FILTER (WHERE status = 'cancelled')    AS cancelled,
       round(100.0 * count(*) FILTER (WHERE status = 'cancelled') / count(*), 1) AS cancel_pct
FROM orders
GROUP BY 1
ORDER BY 1;
\`\`\`

## İki səviyyəli aqreqasiya

"Orta **sifariş** dəyəri" iki addım tələb edir: əvvəlcə sətirləri **hər sifariş üzrə** toplayın, sonra həmin cəmlərin ortasını alın. Tək \`avg(line value)\` sətirlərin ortasını alır, bu isə başqa ədəddir. Subquery və ya CTE işlədin (19–20-ci mövzular).

## Aralıq cəmlər: GROUPING SETS, ROLLUP, CUBE

\`GROUP BY ROLLUP (region, country)\` hər region üçün aralıq cəm sətirləri və ümumi cəm əlavə edir. Yığılmış sütunlar orada NULL göstərir, \`GROUPING(col)\` isə NULL-ın aralıq cəm işarəsi olub-olmadığını deyir.

## Tələlər

- "Çox" tərəfli cədvəli join etmək sətirləri çoxaldır, ona görə də \`sum\` və ya \`count(*)\` artıq sayır (5-ci mövzu). Sifarişləri \`count(DISTINCT order_id)\` ilə sayın.
- x-də NULL-lar olduqda \`sum(x) / count(*)\` \`avg(x)\` deyil, tam ədədlərlə isə həm də tam bölmədir.
- ORDER BY olmadan \`string_agg\`-ın zəmanətli sırası yoxdur.`;

const topic: TopicText = {
  explanation,
  questions: {
    't14-q01': {
      title: 'Ölkə üzrə müştərilər',
      prompt: `Hər \`country_id\`-də neçə müştəri yaşayır? Ölkəsi olmayan müştərilər öz qrupunu (NULL) təşkil edir.

- **Sütunlar:** \`country_id\`, \`customers\`
- **Sıralama:** \`country_id\` üzrə artan (NULL qrupu sonda).`,
      hints: ['`GROUP BY country_id` və `count(*)`.'],
      explanation: `GROUP BY bütün NULL country_id-ləri **bir** qrupa toplayır, \`count(*)\` isə onun sətirlərini sayır.

\`count(country_id)\` NULL olmayan dəyərləri sayır, ona görə də NULL qrupu həqiqi müştərilərdən ibarət olsa da 0 göstərərdi.`,
      commonMistakes: ['NULL qrupu üçün 0 göstərən count(column).', 'NULL qrupunu atmaq.'],
    },
    't14-q02': {
      title: 'WHERE, yoxsa HAVING?',
      prompt: `**2024-də 5-dən çox sifariş vermiş** müştəriləri istəyirsiniz. Hansı skelet düzgündür?`,
      hints: ['Hansı şərtlər tək sətirlərə, hansıları isə qruplara aiddir?'],
      explanation: `Tarix şərti **sətirlərə** aiddir, ona görə də WHERE-ə (qruplaşdırmadan əvvəl) aiddir. Say şərti **qruplara** aiddir, ona görə də HAVING-ə (qruplaşdırmadan sonra) aiddir.

WHERE-də aqreqatlara icazə verilmir. HAVING \`ordered_at\` kimi qruplaşdırılmamış sətir sütunlarına istinad edə bilməz. WHERE isə GROUP BY-dan sonra gələ bilməz.`,
      commonMistakes: ['Aqreqat şərtlərini WHERE-ə qoymaq.'],
      options: [
        `\`… WHERE count(*) > 5 AND ordered_at >= '2024-01-01' … GROUP BY customer_id\``,
        `\`… WHERE ordered_at >= '2024-01-01' AND ordered_at < '2025-01-01' GROUP BY customer_id HAVING count(*) > 5\``,
        `\`… GROUP BY customer_id HAVING ordered_at >= '2024-01-01' AND count(*) > 5\``,
        `\`… GROUP BY customer_id WHERE count(*) > 5\``,
      ],
    },
    't14-q03': {
      title: 'Heç nəyi aqreqasiya etmək',
      prompt: `WHERE bəndi hər sətri silir. Sorğu nə qaytarır?`,
      hints: ['GROUP BY olmadan aqreqat sorğusu həmişə düz bir sətir qaytarır.'],
      explanation: `**GROUP BY olmayan** aqreqat sorğusu, hətta sıfır giriş sətri üzərində də, həmişə bir sətir qaytarır. \`count\` 0 verir, \`sum\` və \`max\` isə **NULL** verir: toplanacaq və ya müqayisə ediləcək heç nə yoxdur.

GROUP BY ilə sıfır giriş sətri sıfır qrup, yəni heç bir sətir verməzdi. 0 lazımdırsa, \`coalesce(sum(x), 0)\` işlədin.`,
      commonMistakes: ['Heç nə üzərində sum-ın 0 olacağını gözləmək.', 'Heç bir sətir gözləməmək.'],
    },
    't14-q04': {
      title: 'İl üzrə gəlir',
      prompt: `**Ləğv edilməmiş** sifarişlərdən il üzrə (\`ordered_at\`-ın UTC ili) ümumi gəlir. Gəlir = sifariş sətirləri üzrə \`quantity * unit_price * (1 - discount)\`-ın cəmi, 2 onluq rəqəmə yuvarlaqlaşdırılmış.

- **Sütunlar:** \`year\` (integer), \`revenue\`
- **Sıralama:** \`year\` üzrə.`,
      hints: ['orders-i order_items ilə join edin, statusu filtrləyin, çıxarılmış il üzrə qruplaşdırın.'],
      explanation: `Sətirləri WHERE ilə filtrləyin (ləğv edilmiş sifarişlər çıxır), il ifadəsi üzrə qruplaşdırın və sətir dəyərlərini toplayın. \`GROUP BY 1\` birinci nəticə sütununa istinad edir. Bir dəfə, sonda yuvarlaqlaşdırın.`,
      commonMistakes: ['Ləğv edilmiş sifarişləri daxil etmək.', 'Endirimi unutmaq.'],
    },
    't14-q05': {
      title: 'Kanal üzrə orta sifariş dəyəri',
      prompt: `**Ləğv edilməmiş** sifarişlər üçün hər \`channel\` üzrə **orta sifariş dəyəri** nədir? Sifarişin dəyəri onun sətir dəyərlərinin (\`quantity * unit_price * (1 - discount)\`) cəmi **üstəgəl shipping_fee**-dir. 2 onluq rəqəmə yuvarlaqlaşdırın.

- **Sütunlar:** \`channel\`, \`orders\`, \`avg_order_value\`
- **Sıralama:** \`channel\` üzrə.`,
      hints: ['İki səviyyə: əvvəlcə hər sifarişin dəyərini hesablayın (sifariş üzrə GROUP BY), sonra onların hər kanal üzrə ortasını alın.', 'Çatdırılma haqqını hər sətir üçün yox, hər sifariş üçün bir dəfə əlavə edin.'],
      explanation: `Ortalar yalnız düzgün vahid üzərində mənalıdır. **Sətirlərin** ortası orta sifariş dəyərini yox, orta sətir dəyərini verir. Ona görə də:

1. **Hər sifariş üzrə:** sətirləri toplayın və haqqı *bir dəfə* əlavə edin. Haqq \`orders\`-in sütunudur, ona görə də hər sətir üzrə toplanmır, qruplaşdırılır.
2. **Hər kanal üzrə:** həmin sifariş cəmlərinin ortasını alın.

İkinci yanlış cavab haqqı hər sətrə əlavə edir, ona görə də çox sətirli sifarişlər onu bir neçə dəfə ödəyir. PostgreSQL-də \`o.channel\` və \`o.shipping_fee\`-ni seçmək üçün təkcə \`o.order_id\` üzrə qruplaşdırmaq kifayətdir, çünki onlar primary key-dən funksional asılıdır.`,
      commonMistakes: ['Sifarişlər əvəzinə sətirlərin ortasını almaq.', 'Çatdırılma haqqını hər sətir üçün əlavə etmək.'],
    },
    't14-q06': {
      title: 'Daimi müştərilər',
      prompt: `**Ən azı 10 ləğv edilməmiş sifarişi** olan müştəriləri tapın.

- **Sütunlar:** \`customer_id\`, \`orders\`
- **Sıralama:** \`orders\` üzrə (ən yüksək birinci), sonra \`customer_id\`.`,
      hints: ['Status üçün WHERE, say üçün HAVING.'],
      explanation: `Status filtri sayılmazdan əvvəl **sətirlərə** tətbiq olunur, ona görə də WHERE-ə gedir. Hədd **saya** tətbiq olunur, ona görə də HAVING-ə gedir. "Ən azı 10" \`>= 10\` deməkdir.`,
      commonMistakes: ['Ləğv edilmiş sifarişləri saymaq.', '>= əvəzinə > işlətmək.'],
    },
    't14-q07': {
      title: 'Hər sifarişdə nə var idi?',
      prompt: `**2025-ci ilin iyununda** verilmiş sifarişlər üçün hər sifarişin **məhsul adlarını** \`', '\` ilə ayrılmış, **əlifba sırası ilə sıralanmış** bir mətn kimi sadalayın.

- **Sütunlar:** \`order_id\`, \`products\`
- **Sıralama:** \`order_id\` üzrə.`,
      hints: [`\`string_agg(p.name, ', ' ORDER BY p.name)\``],
      explanation: `\`string_agg(value, separator ORDER BY …)\` qrupun dəyərlərini birləşdirir. Aqreqatın **içindəki** ORDER BY mətndaxili sıranı idarə edir. Onsuz sıra join-in yaratdığı istənilən sıradır. Sorğunun son ORDER BY-ı yalnız nəticə sətirlərini sıralayır.`,
      commonMistakes: ['Ad əvəzinə sətir nömrəsi üzrə sıralamaq.', 'Yanlış ayırıcı.'],
    },
    't14-q08': {
      title: 'Ay üzrə sifarişlər və alıcılar',
      prompt: `**2024**-ün (UTC) hər ayı üçün sifarişləri (istənilən statusda) və sifariş vermiş **fərqli müştərilərin sayını** hesablayın.

- **Sütunlar:** \`month\` (date, ilk gün), \`orders\`, \`customers\`
- **Sıralama:** \`month\` üzrə.`,
      hints: [`Qrup kimi \`date_trunc('month', ordered_at)::date\`.`, '`count(DISTINCT customer_id)`'],
      explanation: `\`count(customer_id)\` yenə də sifarişləri, hər sətir üçün bir, sayır. \`count(DISTINCT customer_id)\` **fərqli** müştəriləri sayır.

İl filtri olmadan ay *nömrəsi* üzrə qruplaşdırmaq 2021–2025-in yanvarlarını bir qrupda birləşdirərdi.`,
      commonMistakes: ['count(DISTINCT) əvəzinə count.', 'İllər üzrə ay nömrəsinə görə qruplaşdırmaq.'],
    },
    't14-q09': {
      title: 'Düzəlt: kateqoriya üzrə məhsullar',
      prompt: `Bu sorğu hər kateqoriyanın id-sini, adını və məhsul sayını göstərməlidir. O, uğursuz olur. Düzəldin.

- **Sütunlar:** \`category_id\`, \`name\`, \`products\`
- **Sıralama:** \`category_id\` üzrə. Yalnız məhsulu olan kateqoriyalar.`,
      hints: ['Xətanı oxuyun: hansı sütun qruplaşdırılmayıb?', '**categories**-in primary key-i üzrə qruplaşdırın, onda onun digər sütunları seçilə bilər.'],
      explanation: `Xəta: *column "c.name" must appear in the GROUP BY clause or be used in an aggregate function*. Sorğu \`p.category_id\` üzrə qruplaşdırır və PostgreSQL \`c.name\`-i həmin sütunla müəyyən edilən kimi qəbul etmir.

\`categories\`-in primary key-i olan **\`c.category_id\`** üzrə qruplaşdırın. Onda PostgreSQL hər qrupun düz bir \`c.name\`-i olduğunu bilir (funksional asılılıq). \`c.name\`-i də GROUP BY-da sadalamaq hər yerdə işləyir.

LEFT JOIN boş kateqoriyaları 1 sayı ilə əlavə edərdi, çünki count(*) NULL ilə genişləndirilmiş sətri sayır.`,
      commonMistakes: ['Yanlış cədvəlin sütunu üzrə qruplaşdırmaq.', 'count(*) ilə LEFT JOIN.'],
    },
    't14-q10': {
      title: 'avg və sum / count',
      prompt: `Bu sorğu nə qaytarır?`,
      hints: ['avg NULL-ları nəzərə almır. count(*) isə nəzərə alır. Bütün dəyərlər tam ədəddir.'],
      explanation: `- \`avg(x)\` = (2 + 4) / 2 = **3** (numeric kimi göstərilir, 3.0000000000000000), NULL nəzərə alınmır.
- \`sum(x) / count(*)\` = 6 / 3 = **2**: NULL sətri məxrəcdə sayılır, üstəlik bu, tam bölmədir.
- \`sum(x) / count(x)\` = 6 / 2 = **3**.

Deməli, "cəm bölünsün saya" yalnız avg-ın işlətdiyi eyni sətirləri saydıqda ortaya bərabərdir.`,
      commonMistakes: ['NULL-lar olduqda sum/count(*)-ın avg-a bərabər olduğunu düşünmək.'],
    },
    't14-q11': {
      title: 'Kanal üzrə median sifariş dəyəri',
      prompt: `Hər kanal üzrə **median** sifariş dəyəri nədir (ləğv edilməmiş sifarişlər; sifariş dəyəri = sətir dəyərləri + shipping_fee), 2 onluq rəqəmə yuvarlaqlaşdırılmış? İnterpolyasiya edilmiş medianı işlədin.

- **Sütunlar:** \`channel\`, \`median_order_value\`
- **Sıralama:** \`channel\` üzrə.`,
      hints: ['Əvvəlcə hər sifarişin dəyərini hesablayın ("Kanal üzrə orta sifariş dəyəri"ndə olduğu kimi).', '`percentile_cont(0.5) WITHIN GROUP (ORDER BY value)` double precision qaytarır. Yuvarlaqlaşdırmazdan əvvəl numeric-ə cast edin.'],
      explanation: `Median orta dəyərdir: sifarişlərin yarısı daha ucuz, yarısı daha bahalıdır. Ortadan fərqli olaraq, o, bir neçə nəhəng sifarişlə yuxarı çəkilmir, bizim sifariş dəyərlərimiz isə güclü əyilmiş paylanmaya malikdir, ona görə də ikisi çox fərqlənir.

\`percentile_cont(0.5) WITHIN GROUP (ORDER BY x)\` say cüt olduqda iki orta dəyər arasında interpolyasiya edir. \`percentile_disc\` isə həqiqi verilən dəyərini qaytarardı. Nəticə double precision-dır, ona görə də \`round(…, 2)\`-dən əvvəl cast edin.

Orta qiymətdə olduğu kimi, onu sətirlər üzərində yox, **sifarişlər** üzərində hesablayın.`,
      commonMistakes: ['avg işlətmək (bu, median yox, ortadır).', 'Sətir dəyərlərinin medianını götürmək.'],
    },
    't14-q12': {
      title: 'Region aralıq cəmləri ilə gəlir',
      prompt: `**2024-dəki ləğv edilməmiş sifarişlərin** gəliri **çatdırılma ölkəsinin regionu və ölkəsi** üzrə, **hər region üçün aralıq cəm** və **ümumi cəm** ilə. Gəlir = sətir dəyərlərinin cəmi, 2 onluq rəqəmə yuvarlaqlaşdırılmış. Çatdırılma ölkəsi olmayan sifarişlər xaric edilir.

- **Sütunlar:** \`region\`, \`country\` (aralıq cəm sətirlərində NULL), \`revenue\` (ümumi cəmdə region da NULL)
- **Sıralama:** \`region\` üzrə (NULL-lar sonda), sonra \`country\` (NULL-lar sonda).`,
      hints: ['`GROUP BY ROLLUP (co.region, co.name)` (region, country), (region) və () qruplaşdırmalarını yaradır.'],
      explanation: `\`ROLLUP (a, b)\` \`GROUPING SETS ((a, b), (a), ())\`-ın qısaltmasıdır: detal sətirləri, hər \`a\` üçün aralıq cəm və ümumi cəm. Aralıq cəm sətirlərində yığılmış sütun NULL-dur. \`GROUPING(co.name) = 1\` NULL-ın həqiqi NULL yox, aralıq cəm işarəsi olduğunu deyərdi.

\`CUBE\` regionlar üzrə ölkə cəmləri daxil hər kombinasiyanı əlavə edir. Bu, istəniləndən çoxdur.`,
      commonMistakes: ['Adi GROUP BY (aralıq cəmlər yoxdur).', 'ROLLUP əvəzinə CUBE.'],
    },
    't14-q13': {
      title: 'Bütün sifarişləri çatmış müştərilər',
      prompt: `**Ən azı 3 sifarişi** olan və sifarişlərinin **hər biri** \`'delivered'\` statusunda olan müştəriləri tapın.

- **Sütunlar:** \`customer_id\`, \`orders\`
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: [`\`bool_and(status = 'delivered')\` yalnız şərt qrupun hər sətri üçün doğru olduqda true-dur.`, 'Statusları WHERE-də filtrləməyin, əks halda digər sifarişlər siz onları yoxlaya bilməmişdən əvvəl yox olur.'],
      explanation: `"Bütün sətirlər X-i ödəyir" qrup səviyyəli sualdır, ona görə də ona HAVING-də cavab verin: \`bool_and(X)\`, və ya filtrlənmiş sayı ümumi say ilə müqayisə edin.

WHERE-də \`status = 'delivered'\` filtri çatdırılmamış sifarişləri qruplaşdırmadan **əvvəl** silir, ona görə də qalan hər qrup mükəmməl görünür. \`bool_or\` "ən azı biri" deməkdir.`,
      commonMistakes: ['Qaydanı pozan sifarişləri gizlədən WHERE filtri.', 'bool_and əvəzinə bool_or.'],
    },
    't14-q14': {
      title: 'Kateqoriya üzrə ləğv nisbəti',
      prompt: `Hər məhsul kateqoriyası üçün cəmi neçə **vahid** sifariş edilib, onlardan neçəsi **ləğv edilmiş** sifarişlərdə olub və bu, neçə faizdir (1 onluq rəqəm)? Yalnız **ən azı 200 vahid** sifariş edilmiş kateqoriyalar.

- **Sütunlar:** \`category_id\`, \`units\`, \`cancelled_units\`, \`cancel_pct\`
- **Sıralama:** \`cancel_pct\` üzrə (ən yüksək birinci), sonra \`category_id\`.`,
      hints: [`\`sum(quantity)\` və \`sum(quantity) FILTER (WHERE o.status = 'cancelled')\`.`, 'Vahidlər üzrə hədd HAVING-ə gedir. Faizdə tam bölməyə diqqət edin.'],
      explanation: `\`FILTER (WHERE …)\` bir aqreqatı bəzi sətirlərlə məhdudlaşdırır, digərləri isə bütün qrupu görür. Bu, hissə ilə cəmi yan-yana, nisbət üçün hazır verir.

- Tam ədədli cəmlərlə \`100 * a / b\` faizi kəsir. \`100.0\` işlədin.
- \`count(*)\` vahidləri yox, sifariş **sətirlərini** sayır (sətrin quantity-si 10 ola bilər).
- Uyğun sətir olmayan filtrlənmiş cəm NULL-dur. Göstərmək üçün onu coalesce ilə 0 edin.`,
      commonMistakes: ['Tam bölmə.', 'Vahidləri toplamaq əvəzinə sətirləri saymaq.'],
    },
    't14-q15': {
      title: 'Qeydiyyat ayı üzrə 90 günlük təkrar nisbəti',
      prompt: `**2024**-də qeydiyyatdan keçmiş müştərilər üçün, **qeydiyyat ayı** (UTC) üzrə qruplaşdırılmış, onların neçə faizi **qeydiyyatdan sonra 90 gün ərzində ən azı iki ləğv edilməmiş sifariş** verib (\`ordered_at < signup_at + INTERVAL '90 days'\`)?

- **Sütunlar:** \`signup_month\` (date), \`customers\` (həmin ay qeydiyyatdan keçən hamı), \`repeaters\`, \`repeat_pct\` (1 onluq rəqəm)
- **Sıralama:** \`signup_month\` üzrə.`,
      hints: ['Əvvəlcə hər müştərinin uyğun sifarişlərini sayın: şərtləri ON-da olan LEFT JOIN, hər müştəri üzrə qruplaşdırılmış.', 'Sonra hər qeydiyyat ayı üzrə aqreqasiya edin: `count(*)` və `count(*) FILTER (WHERE n >= 2)`.'],
      explanation: `İki addımda kohort saxlanma (retention) sorğusu:

1. Uyğun sifarişlərin sayı ilə **hər müştəri üçün bir sətir**. **Sifariş şərtləri ON-da olan LEFT JOIN** sıfır erkən sifarişi olan müştəriləri saxlayır. Onlar məxrəcə aiddir!
2. Təkrarlayanlar üçün FILTER ilə **hər kohort üçün bir sətir**.

Hər iki yanlış cavab məxrəci kiçildir. Inner join və ya WHERE-dəki sifariş şərtləri (LEFT JOIN-i inner join-ə çevirir) heç vaxt erkən sifariş verməmiş müştəriləri atır və təkrar nisbətini şişirdir.`,
      commonMistakes: ['Alış etməyənləri məxrəcdən itirmək.', 'LEFT JOIN-dən sonra WHERE-də sifariş şərtləri.'],
    },
    't14-q16': {
      title: 'Hər ilin ən çox satan kateqoriyası',
      prompt: `Ləğv edilməmiş sifarişlərin hər ili (UTC) üçün hansı **kateqoriyanın** **ən yüksək gəliri** olub? İkisi bərabərdirsə, daha kiçik \`category_id\`-ni götürün.

- **Sütunlar:** \`year\`, \`category_id\`, \`revenue\` (2 onluq rəqəmə yuvarlaqlaşdırılmış)
- **Sıralama:** \`year\` üzrə.`,
      hints: ['Əvvəlcə gəliri hər (il, kateqoriya) üzrə aqreqasiya edin.', 'Sonra hər il üçün ən yuxarı sətri saxlayın: `DISTINCT ON (year) … ORDER BY year, revenue DESC, category_id` (1-ci mövzu).'],
      explanation: `"Hər qrupda ən yuxarı X" iki addım tələb edir: (qrup, X) səviyyəsinə qədər **aqreqasiya**, sonra hər qrup üçün ən yaxşı sətri **seçmək**.

\`max()\` seçimi edə bilməz. \`max(category_id)\` sadəcə ən böyük id-dir, gəlirlə əlaqəsi yoxdur. PostgreSQL-in \`DISTINCT ON\`-u verilmiş sıra ilə hər il üçün ilk sətri saxlayır. Portativ versiya \`row_number()\` işlədir (17-ci mövzu). Gəlir əvəzinə vahidlərə görə dərəcələndirmək başqa suala cavab verir.`,
      commonMistakes: ['Ən yuxarı kateqoriyanı "tapmaq" üçün max() işlətmək.', 'Gəlir əvəzinə vahidlərə görə dərəcələndirmək.'],
    },
    't14-q17': {
      title: 'Bir dəfədən çox işlədilən e-poçt ünvanları',
      prompt: `Verilənlərin keyfiyyət yoxlaması: hansı **normallaşdırılmış e-poçt ünvanları** (\`lower(trim(email))\`) **birdən çox müştəri** tərəfindən işlədilir? Müştəri id-lərini sıralanmış array kimi göstərin.

- **Sütunlar:** \`email\`, \`customers\` (say), \`customer_ids\` (integer array, artan)
- **Sıralama:** \`email\` üzrə.`,
      hints: ['Normallaşdırılmış ifadə üzrə GROUP BY, HAVING count(*) > 1.', '`array_agg(customer_id ORDER BY customer_id)`'],
      explanation: `Böyük-kiçik hərf və boşluq variantları bir qrupa birləşsin deyə **normallaşdırılmış** dəyər üzrə qruplaşdırın. HAVING birdən çox müştərisi olan qrupları saxlayır. \`array_agg(… ORDER BY …)\` üzvləri sadalayır, bu da sonrakı birləşdirmələr üçün əlverişlidir.

Xam e-poçt üzrə qruplaşdırmaq variantları buraxır. NULL-ı xaric etmədən e-poçtu olmayan ~150 müştəri bir böyük "dublikat" qrupu təşkil edir, çünki GROUP BY bütün NULL-ları bir dəyər kimi qəbul edir.`,
      commonMistakes: ['Xam dəyər üzrə qruplaşdırmaq.', 'NULL-ların bir qrup təşkil etdiyini unutmaq.'],
    },
  },
};

export default topic;
