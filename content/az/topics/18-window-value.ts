import type { TopicText } from '../../i18n.ts';

const explanation = `Dəyər funksiyaları window-un **başqa sətrindən** dəyər qaytarır: əvvəlkindən, növbətindən, birincidən, sonuncudan və ya n-cidən. Onlar "əvvəlki dəfə ilə müqayisədə" suallarına cavab verir: əvvəlki sifarişdən bəri keçən günlər, aydan-aya artım, hər kəsin yanında ən çox qazanan.

## LAG və LEAD

\`\`\`text
lag(expr [, offset [, default]])  OVER (PARTITION BY … ORDER BY …)   -- offset sətir əvvəl
lead(expr [, offset [, default]]) OVER (PARTITION BY … ORDER BY …)   -- offset sətir sonra
\`\`\`

- \`offset\` standart olaraq 1-dir. Partition-da belə sətir olmadıqda nəticə \`default\`-dur (verilməyibsə NULL).
- Onlar frame-i nəzərə almır: sətirləri partition-un ORDER BY sırası ilə sayırlar. Onlara unikal ORDER BY verin (tie-breaker əlavə edin), əks halda bərabərliklər arasında "əvvəlki sətir" təsadüfi olur.

\`\`\`sql
SELECT customer_id, order_id, ordered_at::date AS order_date,
       lag(ordered_at::date)  OVER w AS previous_order,
       ordered_at::date - lag(ordered_at::date) OVER w AS days_since_previous,
       lead(ordered_at::date) OVER w AS next_order
FROM orders
WHERE customer_id <= 3
WINDOW w AS (PARTITION BY customer_id ORDER BY ordered_at, order_id)
ORDER BY customer_id, ordered_at;
\`\`\`

## Dövrdən-dövrə

Əvvəlcə hər dövr üzrə aqreqasiya edin, sonra \`lag\` ilə müqayisə edin:

\`\`\`sql
SELECT date_trunc('month', ordered_at)::date AS month,
       count(*) AS orders,
       lag(count(*)) OVER (ORDER BY date_trunc('month', ordered_at)::date) AS previous_month,
       count(*) - lag(count(*)) OVER (ORDER BY date_trunc('month', ordered_at)::date) AS change
FROM orders
WHERE ordered_at >= '2025-01-01'
GROUP BY 1
ORDER BY 1;
\`\`\`

Aylıq sətirlər üzərində \`lag(x, 12)\`, heç bir ay çatışmadığı müddətcə, "keçən ilin eyni ayı"dır. **WHERE-in window-lardan əvvəl işlədiyini** unutmayın: 2025-ə qədər filtrləsəniz, yanvarın geriyə baxacağı dekabrı yoxdur. Window-u daha geniş aralıq üzərində hesablayın, sonra xarici sorğuda filtrləyin.

## FIRST_VALUE, LAST_VALUE, NTH_VALUE

Bunlar frame-i **işlədir** və bu, klassik tələdir:

\`\`\`sql
SELECT x,
       first_value(x) OVER (ORDER BY x) AS first_v,
       last_value(x)  OVER (ORDER BY x) AS last_default_frame,
       last_value(x)  OVER (ORDER BY x ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS last_whole
FROM (VALUES (1), (2), (3)) AS t(x)
ORDER BY x;
\`\`\`

Standart frame cari sətirdə (və onun peer-lərində) bitir, ona görə də \`last_value\` sadəcə cari sətrin dəyərini qaytarır. Frame-i \`UNBOUNDED FOLLOWING\`-ə qədər uzadın və ya ORDER BY-ı çevirib \`first_value\` işlədin. Eynilə, frame ikinci sətrə çatmasa, \`nth_value(x, 2)\` birinci sətirdə NULL-dur.

## Pattern-lər

| sual | alət |
|---|---|
| əvvəlki hadisədən bəri keçən günlər | \`t - lag(t) OVER (PARTITION BY who ORDER BY t)\` |
| əvvəlki dövrlə müqayisədə artım | dövr üzrə GROUP BY-dan sonra \`(v - lag(v)) / lag(v)\` |
| "N gün ərzində qayıtdılarmı?" | \`lead(t) OVER (…) <= t + interval 'N days'\` |
| hadisələri sessiyalara bölmək (gaps and islands) | \`lag\`-a qədər boşluğun həddi aşdığı sətirləri işarələyin, sonra işarələrin kumulyativ \`sum\`-ı sessiyaları nömrələyir |
| hər sətirdə qrupun ən yaxşısı/ən pisi | \`first_value(…) OVER (… ORDER BY … DESC)\` |

## Tələlər

- PARTITION BY-ı unutmaq: hər müştərinin ilk sətri əvvəlki müştərinin son sifarişini "görür".
- \`lag(x, 1, 0)\` çatışmayan əvvəlki dəyəri həqiqi 0 kimi göstərir. Adətən NULL daha dürüstdür.
- PostgreSQL 18 bu funksiyalarda \`IGNORE NULLS\`-u dəstəkləmir.`;

const topic: TopicText = {
  explanation,
  questions: {
    't18-q01': {
      title: 'Əvvəlki sifarişdən bəri keçən günlər',
      prompt: `**Çili**dən (\`country_id = 6\`) olan müştərilər üçün hər sifarişi **müştərinin əvvəlki sifarişinin** tarixi və ondan bəri keçən **günlərin** sayı ilə sadalayın (UTC tarixləri; müştərinin ilk sifarişi üçün NULL). Müştərinin sifarişlərini \`ordered_at\` üzrə, bərabərlikdə \`order_id\` üzrə sıralayın.

- **Sütunlar:** \`customer_id\`, \`order_id\`, \`order_date\`, \`previous_order_date\`, \`days_since_previous\` (integer)
- **Sıralama:** \`customer_id\` üzrə, sonra \`order_date\`, sonra \`order_id\`.`,
      hints: ['`lag(o.ordered_at::date) OVER (PARTITION BY o.customer_id ORDER BY o.ordered_at, o.order_id)`', '`date - date` günlərin integer sayıdır.'],
      explanation: `\`lag\` əvvəlki sətri **partition daxilində** oxuyur, ona görə də hər müştərinin ilk sifarişi NULL alır. PARTITION BY olmadan müştərinin ilk sifarişi əvvəlki müştərinin son sifarişini "görərdi".

\`lead\` irəli baxır: o, *növbəti* sifarişi, yəni güzgü sualını verir.`,
      commonMistakes: ['Müştəri üzrə PARTITION BY yoxdur.', 'lag əvəzinə lead.'],
    },
    't18-q02': {
      title: 'last_value sürprizi',
      prompt: `\`last_value(price) OVER (PARTITION BY category_id ORDER BY price)\` hər sətirdə hər kateqoriyanın **ən yüksək** qiymətini göstərməli idi, amma əsasən sətrin öz qiymətini göstərir. Niyə?`,
      hints: ['ORDER BY olduqda və frame verilmədikdə frame-də hansı sətirlər var?'],
      explanation: `ORDER BY ilə standart frame \`RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW\`-dur. Həmin frame-in son sətri cari sətirdir (və ya onun son peer-i). Bunu \`ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING\` ilə düzəldin, və ya \`first_value(price) OVER (… ORDER BY price DESC)\`, və ya sadəcə \`max(price) OVER (PARTITION BY category_id)\` işlədin.`,
      commonMistakes: ['last_value-nun standart olaraq bütün partition-a baxacağını gözləmək.'],
      options: [
        'last_value ORDER BY-ı nəzərə almır və təsadüfi sətir qaytarır',
        'Standart frame cari sətirdə (və onun peer-lərində) bitir, ona görə də frame-in "son" sətri cari sətirdir',
        'last_value yalnız PARTITION BY olmadan işləyir',
        'DESC lazımdır: artan sırada last_value ən kiçik dəyəri qaytarır',
      ],
    },
    't18-q03': {
      title: 'Sürüşmələr və standart dəyərlərlə LAG və LEAD',
      prompt: `Bu sorğu nə qaytarır?`,
      hints: ['Standart dəyər yalnız verildiyi funksiyaya tətbiq olunur.'],
      explanation: `\`lag(x)\` əvvəlki sətrin x-idir: NULL, 10, 20. \`lead(x, 1, 0)\` növbəti sətrinkidir, olmayan yerdə 0: 20, 30, 0. \`lag(x, 2)\` iki sətir geriyə baxır, ona görə də yalnız üçüncü sətirdə var (10).`,
      commonMistakes: ['Standart dəyəri hər funksiyaya tətbiq etmək.', '2 sürüşməsinin "bu da daxil olmaqla iki sətir" demək olduğunu düşünmək.'],
    },
    't18-q04': {
      title: 'Aydan-aya dəyişiklik',
      prompt: `**2024**-ün hər ayı üçün ləğv edilməmiş sifarişlərin gəlirini, **əvvəlki ayın gəlirini** və **dəyişikliyi** (gəlir − əvvəlki) göstərin. Yanvar üçün əvvəlki ay və dəyişiklik NULL-dur. 2 onluq rəqəmə yuvarlaqlaşdırın.

- **Sütunlar:** \`month\` (date), \`revenue\`, \`previous_month\`, \`change\`
- **Sıralama:** \`month\` üzrə.`,
      hints: ['Ay üzrə qruplaşdırın, sonra `lag(sum(…)) OVER (ORDER BY month)`.'],
      explanation: `Qruplaşdırmadan sonra hər ay bir sətirdir, ona görə də \`lag(sum(…))\` əvvəlki ayın cəmidir. Window-un ORDER BY-ı qruplaşdırılmış ifadə olmalıdır.

0 standart dəyəri yanvarı bütün gəliri qədər artmış kimi göstərərdi. NULL ("əhatədə əvvəlki ay yoxdur") dürüst cavabdır.`,
      commonMistakes: ['lag əvəzinə lead.', 'Çatışmayan əvvəlki ay üçün 0 standart dəyəri.'],
    },
    't18-q05': {
      title: 'Aylar üzrə ildən-ilə',
      prompt: `**2024-ün yanvarından 2025-in iyununa qədər** hər ay üçün ləğv edilməmiş sifarişlərin gəlirini, **bir il əvvəlki eyni ayın** gəlirini və artımı faizlə (1 onluq rəqəm) göstərin. 2023-dən bəri hər ayın sifarişləri var.

- **Sütunlar:** \`month\` (date), \`revenue\` (2 onluq rəqəm), \`last_year\` (2 onluq rəqəm), \`yoy_pct\`
- **Sıralama:** \`month\` üzrə.`,
      hints: ['Aylıq sətirlər üzərində `lag(revenue, 12)` keçən ilin eyni ayıdır.', '2024-dən geriyə baxmaq üçün window 2023-ü görməlidir, ona görə də əvvəlcə onu hesablayın, ayları isə xaricdə filtrləyin.'],
      explanation: `Hər ay üçün bir sətir üzərində \`lag(x, 12)\` = 12 ay əvvəlki dəyər. Amma **WHERE window-lardan əvvəl işləyir**: eyni sorğuda 2024+ ilə filtrləmək (birinci yanlış cavab) window-a geriyə baxacaq heç nə qoymur, ona görə də hər 2024 ayı NULL alır. Window-u daha geniş aralıq üzərində hesablayın və xarici sorğuda filtrləyin.

Artım **köhnə** dəyərə nisbətəndir: (yeni − köhnə) / köhnə. Self-join alternativi ayları tarix hesabı ilə uyğunlaşdırır, bu da aylar çatışmadıqda da işləyir.`,
      commonMistakes: ['Window-dan əvvəl filtrləmək, ona görə də 2024-ün tarixçəsi yoxdur.', 'Yeni dəyərə bölmək.'],
    },
    't18-q06': {
      title: 'Hər sətirdə ən çox qazanan',
      prompt: `Departamenti olan **aktiv** işçilər üçün hər işçinin yanında **onun departamentindəki ən yüksək maaşlı aktiv işçinin id-sini və maaşını** göstərin (bərabərlikdə ən kiçik \`employee_id\`).

- **Sütunlar:** \`department_id\`, \`employee_id\`, \`salary\`, \`top_earner_id\`, \`top_salary\`
- **Sıralama:** \`department_id\` üzrə, sonra \`employee_id\`.`,
      hints: ['`first_value(employee_id) OVER (PARTITION BY department_id ORDER BY salary DESC, employee_id)`'],
      explanation: `Azalan sıra ilə \`first_value\` "qrupun ən yuxarı sətri"ni almağın təhlükəsiz yoludur: birinci sətir həmişə standart frame-dədir. \`employee_id\` tie-breaker-i iki nəfər ən yüksək maaşı paylaşdıqda ən çox qazananı dəqiq müəyyən edir.

Artan sıra ilə \`last_value\` yalnız \`UNBOUNDED FOLLOWING\`-ə qədər uzadılmış frame ilə işləyir. Standart frame ilə o, cari işçini qaytarır.`,
      commonMistakes: ['Standart frame ilə last_value.', 'Ən az maaş alanı verən artan sıra.'],
    },
    't18-q07': {
      title: 'Düzəlt: hər sətirdə ən son sifariş',
      prompt: `**Çili**dən (\`country_id = 6\`) olan müştərilər üçün bu sorğu hər sifarişi müştərinin **ən son** sifarişinin tarixi ilə birlikdə göstərməlidir. Bunun əvəzinə \`latest_order_date\` sadəcə hər sətrin öz tarixini təkrarlayır. Düzəldin.

- **Sütunlar:** \`customer_id\`, \`order_id\`, \`order_date\`, \`latest_order_date\`
- **Sıralama:** \`customer_id\` üzrə, sonra \`order_id\`.`,
      hints: ['Standart frame-in son sətri nədir?', 'Frame-i `UNBOUNDED FOLLOWING`-ə qədər uzadın və ya `max(…) OVER (PARTITION BY …)` işlədin.'],
      explanation: `Window-un ORDER BY-ı var, amma frame-i yoxdur, ona görə də frame cari sətirdə dayanır: "son dəyər" cari sifarişin tarixidir. Üç həll:

1. Frame-i uzadın: \`ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING\`.
2. Sıranı çevirin və birinci dəyəri götürün: \`first_value(…) OVER (… ORDER BY ordered_at DESC)\`.
3. Ən son *tarix* üçün adi \`max(…) OVER (PARTITION BY customer_id)\` ən sadədir. last_value son sətrin başqa sütunu lazım olduqda öz faydasını göstərir.`,
      commonMistakes: ['Heç nəyi dəyişməyən standart frame-i açıq yazmaq.', 'Frame-i düzəldərkən PARTITION BY-ı atmaq.'],
    },
    't18-q08': {
      title: 'Bərabərliklərlə first_value və last_value',
      prompt: `Bu sorğu nə qaytarır?`,
      hints: ['Standart frame cari sətirdə, **onun peer-ləri daxil olmaqla**, bitir.'],
      explanation: `Frame birinci sətirdən başlayır, ona görə də \`first_value\` hər yerdə 1-dir. O, cari sətrin son peer-ində bitir, ona görə də \`last_value\` cari dəyərdir: hər iki 2-nin frame-ində bir-biri var və onların sonuncusu 2-dir. Yalnız \`UNBOUNDED FOLLOWING\` ilə last_value hər yerdə 3 olardı.`,
      commonMistakes: ['last_value-nun hər sətirdə 3 olacağını gözləmək.'],
    },
    't18-q09': {
      title: 'Maaş dəyişiklikləri',
      prompt: `\`salary_history\`-dən hər maaş **dəyişikliyini** sadalayın: eyni işçi üçün əvvəlki dövrü olan hər dövr, köhnə maaş, yeni maaş və faizlə dəyişiklik (1 onluq rəqəm) ilə.

- **Sütunlar:** \`employee_id\`, \`effective_from\`, \`old_salary\`, \`new_salary\`, \`change_pct\`, \`change_reason\`
- **Sıralama:** \`employee_id\` üzrə, sonra \`effective_from\`.`,
      hints: ['`lag(salary) OVER (PARTITION BY employee_id ORDER BY effective_from)`', 'İlk dövrü (əvvəlki maaş yoxdur) xarici sorğuda silin.'],
      explanation: `"Əvvəlki" **eyni işçi** üçün **zamanca** əvvəlki deməkdir: işçi üzrə partition, \`effective_from\` üzrə sıralama.

PARTITION BY olmadan hər işçinin ilk dövrü əvvəlki işçinin son maaşı ilə müqayisə olunur və saxta "dəyişikliyə" çevrilir. Maaş üzrə sıralama maaşların yalnız artdığını fərz edir. Verilənlərdə bir işçinin maaşı azaldılıb və həmin sətir yanlış çıxardı.`,
      commonMistakes: ['İşçi üzrə PARTITION BY yoxdur.', 'Tarix əvəzinə maaş üzrə sıralamaq.'],
    },
    't18-q10': {
      title: 'Sifarişlər arasında ən uzun fasilə',
      prompt: `Hansı **10 müştərinin** iki **ardıcıl** sifarişi (istənilən status) arasında ən uzun fasiləsi (günlərlə, UTC tarixinə görə) olub?

- **Sütunlar:** \`customer_id\`, \`longest_gap_days\`
- **Sıralama:** \`longest_gap_days\` üzrə (ən yüksək birinci), sonra \`customer_id\`; **10 sətir**.`,
      hints: ['Daxili sorğu: `lag` ilə əvvəlki sifarişə qədər fasilə.', 'Xarici sorğu: hər müştəri üzrə `max(gap)`.'],
      explanation: `Window function-lar eyni səviyyədə aqreqatların içinə yerləşdirilə bilməz, ona görə də bu, iki addım tələb edir: hər fasiləni \`lag\` ilə hesablayın, sonra aqreqasiya edin. Tək sifarişli müştərilərin yalnız NULL fasiləsi var, ona görə də onların \`max\`-ı NULL-dur. **Azalan sıralamada NULL-lar birinci gəlir**, ona görə də HAVING (və ya fasilə üzrə WHERE) olmadan ilk 10 bir sifarişli müştərilərlə dolur.

**İlk** sifarişdən ölçmək (\`first_value\`) ardıcıl sifarişlər arasındakı fasiləni yox, müştərinin müddətini verir.`,
      commonMistakes: ['Əvvəlki əvəzinə ilk sifarişdən olan məsafə.', 'NULL fasiləsi birinci sıralanan bir sifarişli müştəriləri saxlamaq.'],
    },
    't18-q11': {
      title: 'Birinci sifarişdən ikinciyə',
      prompt: `**2024-də qeydiyyatdan keçmiş** və **ən azı iki sifarişi** (istənilən status) olan müştərilər üçün onların birinci və ikinci sifarişlərinin tarixlərini (UTC) və aralarındakı günləri göstərin. Müştərinin sifarişlərini \`ordered_at\` üzrə, bərabərlikdə \`order_id\` üzrə sıralayın.

- **Sütunlar:** \`customer_id\`, \`first_order\`, \`second_order\`, \`days_between\`
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: ['`nth_value(ordered_at::date, 2)` hər sətirdən ikinci sətrə çatan frame tələb edir: `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`.', 'Alternativ olaraq: hər müştərinin ilk sifarişində `lead`.'],
      explanation: `Tam frame ilə müştərinin hər sətri eyni birinci və ikinci tarixi daşıyır, DISTINCT isə onları hər müştəri üçün bir sətrə yığır. Bir sifarişli müştərilər ikinci tarix üçün NULL alır və silinir.

\`lead\` alternativi müştərinin birinci sətrini (\`row_number\` vasitəsilə) götürür və növbəti sətri oxuyur. Azalan sıra "birinci və ikinci"ni "ən son və sondan ikinci"yə çevirir.`,
      commonMistakes: ['Bir sifarişli müştəriləri saxlamaq.', 'Window daxilində azalan sıra.'],
    },
    't18-q12': {
      title: '30 gün ərzində qayıtdılarmı?',
      prompt: `**2024**-ün hər ayı üçün həmin ay verilmiş bütün sifarişləri (istənilən status) götürün və **30 gün ərzində eyni müştərinin başqa sifarişi ilə davam etdirilənlərin** payını hesablayın (\`next ordered_at <= ordered_at + 30 days\`). Növbəti sifariş 2025-ə düşə bilər.

- **Sütunlar:** \`month\` (date), \`orders\`, \`reordered_30d\`, \`reorder_pct\` (1 onluq rəqəm)
- **Sıralama:** \`month\` üzrə.`,
      hints: ['**Bütün** sifarişlər üzərində `lead(ordered_at) OVER (PARTITION BY customer_id ORDER BY ordered_at, order_id)`.', 'Sonra 2024 ilə məhdudlaşdırın və `count(*) FILTER (WHERE …)` ilə aqreqasiya edin.'],
      explanation: `\`lead\` hər sifarişin *növbəti* sifarişini self-join olmadan birbaşa tapır. Window **bütün** sifarişlər üzərində işləməlidir: 2024 əvvəlcə filtrlənsə (birinci yanlış cavab), dekabr sifarişləri 2025-in yanvarındakı davamlarını görə bilmir və dekabr nisbəti düşür.

\`lag\` başqa suala cavab verir ("bu sifariş əvvəlkindən 30 gün ərzində gəldimi?").`,
      commonMistakes: ['Window-dan əvvəl 2024-ə qədər filtrləmək.', 'İrəli əvəzinə geriyə (lag) baxmaq.'],
    },
    't18-q13': {
      title: 'nth_value və qısa frame',
      prompt: `Bu sorğu nə qaytarır?`,
      hints: ['Birinci sətirdə standart frame yalnız həmin sətri ehtiva edir.', 'İkinci frame "bu sətir və varsa, növbəti"dir.'],
      explanation: `Standart frame ilə \`nth_value(x, 2)\`: 1-ci sətirdə frame-də bir sətir var, ona görə də 2-ci dəyər yoxdur (NULL). 2-ci sətirdən başlayaraq 2-ci dəyər 2-dir.

\`ROWS BETWEEN CURRENT ROW AND 1 FOLLOWING\` sətri və növbətini saxlayır. Son sətirdə frame-də yalnız sətrin özü var, ona görə də last_value NULL yox, 3-dür.`,
      commonMistakes: ['nth_value-nun bütün partition-u görəcəyini gözləmək.', 'Frame qısaldıqda NULL gözləmək.'],
    },
    't18-q14': {
      title: 'Hər kateqoriyada ən böyük qiymət sıçrayışı',
      prompt: `Hər kateqoriya daxilində **satışda olan** məhsulları qiymətə görə sıralayın (bərabərlikdə \`product_id\` üzrə). Hər məhsul üçün *sıçrayış* onun qiyməti çıxılsın ondan dərhal əvvəlki məhsulun qiymətidir. Hər kateqoriya üzrə **ən böyük sıçrayışı** olan məhsulu qaytarın (bərabərlikdə ən kiçik \`product_id\`). Satışda tək məhsulu olan kateqoriyaların sıçrayışı yoxdur və nəzərə alınmır.

- **Sütunlar:** \`category_id\`, \`product_id\`, \`price\`, \`previous_price\`, \`jump\`
- **Sıralama:** \`category_id\` üzrə.`,
      hints: ['`price - lag(price) OVER (PARTITION BY category_id ORDER BY price, product_id)`', '`DISTINCT ON (category_id) … ORDER BY category_id, jump DESC …`. Azalan sıralamada NULL-lar hara gedir?'],
      explanation: `Hər kateqoriyada ən ucuz məhsulun əvvəlki məhsulu yoxdur, ona görə də onun sıçrayışı NULL-dur. **Azalan sıralamada NULL-lar birinci gəlir** və DISTINCT ON məhz həmin sətri seçərdi (birinci yanlış cavab). NULL-ları silin və ya \`DESC NULLS LAST\` ilə sıralayın.

Satışdan çıxarılmış məhsulları window-dan *sonra* filtrləmək (ikinci yanlış cavab) satışda olan məhsulları satışdan çıxarılmış qonşularla müqayisə edir.`,
      commonMistakes: ['Azalan sıralamada NULL sıçrayışların qalib gəlməsi.', 'Window-dan sonra filtrləmək.'],
    },
    't18-q15': {
      title: 'Ardıcıl üç artan sifariş',
      prompt: `Eyni müştərinin **ciddi artan dəyərli ardıcıl üç sifarişindən** ibarət silsiləni tamamlayan sifarişləri tapın: sifarişin dəyəri əvvəlki sifarişinkindən yüksəkdir, o da özündən əvvəlkindən yüksəkdir. Yalnız ləğv edilməmiş sifarişlər, çatdırılmasız sətir dəyərləri, \`ordered_at\` sırası ilə (bərabərlikdə \`order_id\` üzrə).

- **Sütunlar:** \`customer_id\`, \`order_id\`, \`two_before\`, \`one_before\`, \`value\` (bütün dəyərlər 2 onluq rəqəmə yuvarlaqlaşdırılmış)
- **Sıralama:** \`customer_id\` üzrə, sonra \`order_id\`.`,
      hints: ['Əvvəlcə sifariş dəyərlərini hesablayın (sifariş üzrə GROUP BY).', 'Müştərinin sifarişləri üzərində `lag(value, 1)` və `lag(value, 2)`.'],
      explanation: `\`lag(value, 2)\` iki sifariş geriyə çatır. Ciddi artan silsilə **hər iki** halqanı tələb edir: v₋₂ < v₋₁ **və** v₋₁ < v. Yalnız cari sifarişin hər iki əvvəlkini üstələdiyini yoxlamaq (birinci yanlış cavab) 50 → 20 → 80-i də qəbul edir.

Üçdən az sifarişi olan müştərilərin lag-ları NULL-dur, müqayisələr naməlumdur və WHERE onları atır, bu da məhz istədiyimizdir.`,
      commonMistakes: ['Zəncirləmək əvəzinə cari sifarişi hər iki əvvəlki ilə müqayisə etmək.', 'Müştərilər boyu lag.'],
    },
    't18-q16': {
      title: 'Alış-veriş həvəsləri (gaps and islands)',
      prompt: `**Çili**dən (\`country_id = 6\`) olan müştərilər üçün hər müştərinin sifarişlərini (istənilən status, \`ordered_at\` üzrə, bərabərlikdə \`order_id\` üzrə) **həvəslərə** (spree) qruplaşdırın: yeni həvəs müştərinin ilk sifarişi ilə və əvvəlki sifarişindən bəri **30 gündən çox** keçdikdə başlayır. Həvəsləri hər müştəri üzrə 1, 2, 3… nömrələyin və **ən azı 2 sifariş** ehtiva edən həvəsləri qaytarın.

- **Sütunlar:** \`customer_id\`, \`spree_no\`, \`orders\`, \`spree_start\`, \`spree_end\` (ilk və son sifarişin UTC tarixləri)
- **Sıralama:** \`customer_id\` üzrə, sonra \`spree_no\`.`,
      hints: ['1-ci addım: `lag(ordered_at)` NULL və ya 30 gündən çox əvvəl olduqda flag = 1, əks halda 0.', '2-ci addım: `sum(flag) OVER (PARTITION BY customer_id ORDER BY ordered_at, order_id)` həvəsləri nömrələyir.', '3-cü addım: müştəri və həvəs nömrəsi üzrə GROUP BY.'],
      explanation: `**Gaps-and-islands** pattern-i:

1. \`lag\` yeni adanın başladığı sətirləri işarələyir (flag 1).
2. İşarələrin kumulyativ \`sum\`-ı hər sətrə onun ada nömrəsini verir: o, yalnız başlanğıc sətrində artır.
3. Hər adanı təsvir etmək üçün ada nömrəsi üzrə GROUP BY.

İlk sifarişin əvvəlki sifarişi yoxdur. Onun müqayisəsi NULL-dur, ona görə də açıq \`IS NULL\` yoxlaması olmadan flag 0 olur və ilk həvəs 0 nömrələnir (ikinci yanlış cavab). \`lead\` ilə *irəli* baxmaq hər həvəsin birinci yox, **sonuncu** sifarişini işarələyir, bu da hər sərhədi bir sifariş sürüşdürür.`,
      commonMistakes: ['İlk həvəsi başlatmamaq (NULL lag).', 'Həvəsin başlanğıcı əvəzinə sonunu işarələmək.'],
    },
  },
};

export default topic;
