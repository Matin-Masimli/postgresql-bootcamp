import type { TopicText } from '../../i18n.ts';

const explanation = `Qiymətlər, miqdarlar, maaşlar, faizlər: hesabatların çoxu hesab əməliyyatı tələb edir. Tələlər tam bölmə, yuvarlaqlaşdırma qaydaları və sürüşən nöqtənin sürprizləridir.

## Ədədi tiplər

| tip | istifadə | qeyd |
|---|---|---|
| \`integer\`, \`bigint\` | saylar, id-lər | dəqiqdir, kəsr yoxdur |
| \`numeric(p, s)\` | **pul**, dəqiq onluq kəsrlər | dəqiqdir. Qiymətlərimiz \`numeric(10,2)\`-dir |
| \`real\`, \`double precision\` | ölçmələr, elm | təxminidir (ikili sürüşən nöqtə) |

## Operatorlar

\`+ - * /\`, \`%\` (qalıq), \`^\` (qüvvət), \`|/\` (kvadrat kök), \`@\` və ya \`abs()\` (mütləq qiymət).

\`\`\`sql
SELECT 7 / 2        AS int_div,      -- 3   tam ədəd ÷ tam ədəd = tam ədəd!
       7 % 2        AS remainder,    -- 1
       7 / 2.0      AS exact_div,    -- 3.5
       7::numeric / 2 AS cast_first, -- 3.5
       2 ^ 10       AS power,
       |/ 16        AS square_root;
\`\`\`

**Tam bölmə** klassik səhvdir: a < b olduqda \`count_a / count_b * 100\` 0 olur. Bölməzdən *əvvəl* operandlardan birini numeric edin: \`100.0 * a / b\`.

## Yuvarlaqlaşdırma

\`\`\`sql
SELECT round(2.567, 2)  AS round_2dp,     -- 2.57
       round(1234.5, -2) AS round_hundreds,-- 1200
       trunc(2.567, 1)   AS trunc_1dp,     -- 2.5 (kəsir, yuvarlaqlaşdırmır)
       ceil(2.1)         AS ceil,          -- 3   (yuxarı)
       floor(-2.1)       AS floor,         -- -3  (aşağı, -sonsuzluğa doğru)
       round(2.5)        AS half_numeric,  -- 3   (numeric: yarım sıfırdan uzağa)
       round(2.5::float8) AS half_float;   -- 2   (float: yarım cüt ədədə!)
\`\`\`

- **Mənfi dəqiqlik** onluqlara, yüzlüklərə… yuvarlaqlaşdırır: \`round(x, -2)\`.
- \`trunc\` sıfıra doğru, \`floor\` isə −∞-a doğru hərəkət edir. Mənfi ədədlər üçün onlar fərqlənir.
- \`round\` **numeric** üzərində yarımları sıfırdan uzağa yuvarlaqlaşdırır. **double precision** üzərində isə yarımları cüt ədədə yuvarlaqlaşdırır ("bankir yuvarlaqlaşdırması").
- \`numeric(10,2)\` sütununa dəyər vermək də 2 onluq rəqəmə yuvarlaqlaşdırır.

## Sürüşən nöqtə təxminidir

\`0.1::float8 + 0.2::float8 = 0.3::float8\` **false**-dur (cəm 0.30000000000000004-dür). numeric ilə eyni müqayisə true-dur. Pulu numeric-də saxlayın və float-ları heç vaxt \`=\` ilə müqayisə etməyin.

## Faydalı funksiyalar

- \`abs(x)\`, \`sign(x)\`, \`mod(a, b)\`, \`power(a, b)\`, \`sqrt(x)\`, \`exp\`, \`ln\`, \`log10\`.
- \`greatest(a, b, …)\` / \`least(a, b, …)\`: ən böyük və ya ən kiçik arqument, **NULL-ları nəzərə almadan**.
- \`width_bucket(x, low, high, n)\` x-i low ilə high arasındakı n bərabər enli zolaqdan birinə yerləşdirir. Aralıqdan aşağı 0, yuxarı sərhəddə və ya ondan yuxarı isə n + 1 verir.
- \`div(a, b)\`: tam qismət. \`gcd\`, \`lcm\`, \`factorial\` də var.

\`\`\`sql
SELECT product_id, price,
       width_bucket(price, 0, 2500, 5) AS price_band,
       round((price - cost) / price * 100, 1) AS margin_pct
FROM products
ORDER BY product_id
LIMIT 8;
\`\`\`

## Tələlər

- \`x / 0\` xətadır ("division by zero"). Onu \`NULLIF(divisor, 0)\` ilə qoruyun (12-ci mövzu).
- Faiz dəyişməsi \`(new - old) / old * 100\`-dür, **köhnə** dəyərə bölünür.
- **Bir dəfə, sonda** yuvarlaqlaşdırın. Aralıq nəticələri yuvarlaqlaşdırmaq xətanı toplayır.
- \`numeric\` bölməsi çoxlu onluq rəqəm göstərir (\`3.5000000000000000\`). Göstərmək üçün yuvarlaqlaşdırın və ya \`numeric(p, s)\`-ə cast edin.`;

const topic: TopicText = {
  explanation,
  questions: {
    't10-q01': {
      title: 'Sətir dəyərləri',
      prompt: `**1-dən 5-ə qədər** sifarişlərin sətirləri üçün **sətir dəyərini** \`quantity * unit_price * (1 - discount)\` hesablayın, 2 onluq rəqəmə yuvarlaqlaşdırılmış.

- **Sütunlar:** \`order_item_id\`, \`order_id\`, \`line_value\`
- **Sıralama:** \`order_item_id\` üzrə.`,
      hints: [`\`discount\` kəsrdir: 0.150 15% endirim deməkdir, ona görə də qiymətin \`(1 - discount)\` hissəsini ödəyirsiniz.`],
      explanation: `\`discount\` *çıxılan* hissədir, ona görə də müştəri qiymətin \`1 - discount\` hissəsini ödəyir. Miqdara və vahid qiymətə vurun, sonra bir dəfə, sonda yuvarlaqlaşdırın. \`numeric(12,2)\`-yə cast da eyni cür yuvarlaqlaşdırır.`,
      commonMistakes: ['Endirimi nəzərə almamaq.', '(1 − discount) əvəzinə endirimə vurmaq.'],
    },
    't10-q02': {
      title: 'Yeddi bölünsün ikiyə',
      prompt: `PostgreSQL-də \`SELECT 7 / 2, 7 % 2;\` nə qaytarır?`,
      hints: ['7 və 2-nin tipləri nədir?'],
      explanation: `Hər iki operand tam ədəddir, ona görə də \`/\` **tam bölmə** aparır və kəsri atır: 3. \`%\` qalıqdır: 1. 3.5 üçün \`7 / 2.0\` və ya \`7::numeric / 2\` yazın.`,
      commonMistakes: ['Tam bölmədən kəsrli nəticə gözləmək.'],
      options: ['3.5 və 1', '3 və 1', '4 və 1', '3.5 və 0.5'],
    },
    't10-q03': {
      title: 'Mənfi ədədlərin yuvarlaqlaşdırılması',
      prompt: `Bu sorğu nə qaytarır?`,
      hints: ['numeric üçün round() yarımları sıfırdan uzağa aparır.', 'trunc sıfıra doğru, ceil +∞-a doğru, floor −∞-a doğru gedir.'],
      explanation: `- \`round(2.5)\` = **3**, \`round(-2.5)\` = **-3**: numeric yuvarlaqlaşdırması yarımları sıfırdan uzağa aparır.
- \`trunc(-2.7)\` = **-2**: o, kəsri kəsir və sıfıra doğru hərəkət edir.
- \`ceil(-2.3)\` = **-2**: ≥ −2.3 olan ən kiçik tam ədəd.
- \`floor(-2.3)\` = **-3**: ≤ −2.3 olan ən böyük tam ədəd.`,
      commonMistakes: ['Mənfi ədədlər üçün floor və trunc-ın eyni olduğunu düşünmək.'],
    },
    't10-q04': {
      title: 'Marja faizi',
      prompt: `\`cost\`-u məlum olan məhsullar üçün **marja faizini** \`(price - cost) / price * 100\` hesablayın, **1 onluq rəqəmə** yuvarlaqlaşdırılmış. **Ən yüksək 10** marjanı göstərin (bərabərlikdə \`product_id\` üzrə).

- **Sütunlar:** \`product_id\`, \`price\`, \`cost\`, \`margin_pct\`
- **Sıralama:** \`margin_pct\` üzrə (ən yüksək birinci), sonra \`product_id\`.`,
      hints: [`\`round((price - cost) / price * 100, 1)\`. Qiymətlər numeric-dir, ona görə də burada tam bölmə yoxdur.`],
      explanation: `Marja **satış qiymətinə** nisbətdir. cost-a bölmək *markup* verir, bu isə başqa göstəricidir. Cost-u olmayan məhsullar NULL marja alardı, DESC sıralamada isə NULL-lar birinci gəlir. Bu da onları süzmək üçün daha bir səbəbdir.`,
      commonMistakes: ['Qiymət əvəzinə cost-a bölmək (markup).', 'Naməlum cost-ları xaric etməyi unutmaq.'],
    },
    't10-q05': {
      title: 'Avro ilə komissiya',
      prompt: `**Komissiyası olan aktiv Sales işçiləri** (\`department_id = 2\`, \`termination_date IS NULL\`, \`commission_pct\` NULL deyil) üçün komissiyanı avro ilə hesablayın: \`salary * commission_pct\`, **tam avroya** yuvarlaqlaşdırılmış.

- **Sütunlar:** \`employee_id\`, \`salary\`, \`commission_pct\`, \`commission_eur\`
- **Sıralama:** \`commission_eur\` üzrə (ən yüksək birinci), sonra \`employee_id\`.`,
      hints: [`İkinci arqumentsiz \`round(x)\` tam ədədə yuvarlaqlaşdırır.`],
      explanation: `\`commission_pct\` kəsr kimi saxlanılır (0.050 = 5%), ona görə də birbaşa vurun. Yenidən 100-ə vurmayın. \`round(x)\` ən yaxın tam ədədə yuvarlaqlaşdırır, \`trunc\` isə həmişə aşağı yuvarlaqlaşdırardı.`,
      commonMistakes: ['Kəsrə faiz kimi yanaşmaq (×100).', 'Yuvarlaqlaşdırmaq əvəzinə kəsmək.'],
    },
    't10-q06': {
      title: 'Qramlar və çəki sinifləri',
      prompt: `\`weight_kg\`-i olan **ilk 20 məhsul** üçün (\`product_id\` üzrə) çəkini **tam qramla** və **çəki sinfini** göstərin: 1-ci sinif 5 kq-a qədər, 2-ci sinif 5-dən yuxarı və 10 kq-a qədər və s., yəni \`ceil(weight_kg / 5)\`.

- **Sütunlar:** \`product_id\`, \`weight_kg\`, \`grams\` (integer), \`weight_class\`
- **Sıralama:** \`product_id\` üzrə. 20 sətir.`,
      hints: [`Qramlar: \`round(weight_kg * 1000)::int\`.`, `Sinif: \`ceil(weight_kg / 5)\`. Düz 5 kq çəki 1-ci sinifdir.`],
      explanation: `\`ceil\` **yuxarı** yuvarlaqlaşdırır, bu da məhz "1-dən sayaraq bu, hansı 5 kq-lıq zolaqdadır" deməkdir: 0.4 kq → 1, 5.0 kq → 1, 5.2 kq → 2.

\`floor(x / 5) + 1\` ekvivalent görünür, amma 5-in tam qatlarında bir vahid çox verir. \`round\` yüngül məhsulları 0-cı sinfə qoyur. Qramlar üçün əvvəlcə vurun və bir dəfə yuvarlaqlaşdırın: kiloqramları əvvəlcə kəsmək onluq nöqtədən sonrakı hər şeyi atır.`,
      commonMistakes: ['floor + 1 (dəqiq sərhədlərdə yanlışdır).', 'ceil əvəzinə round.', 'Vahidləri çevirməzdən əvvəl yuvarlaqlaşdırmaq.'],
    },
    't10-q07': {
      title: 'Qiymət zolaqları',
      prompt: `**Hələ satışda olan** hər məhsulu **0 ilə 2500 arasındakı 5 bərabər enli qiymət zolağından** birinə yerləşdirin (1-ci zolaq = 0–500, …, 5-ci zolaq = 2000–2500; 2500 və ondan yuxarı hər şey 6-cı zolaqdır).

- **Sütunlar:** \`product_id\`, \`price\`, \`band\`
- **Sıralama:** \`product_id\` üzrə.`,
      hints: ['`width_bucket(value, low, high, number_of_buckets)`'],
      explanation: `\`width_bucket(price, 0, 2500, 5)\` [0, 2500)-ü eni 500 olan 5 zolağa bölür və 1–5, ≥ 2500 dəyərlər üçün isə 6 qaytarır. Hər zolaq **aşağı sərhədini daxil edir, yuxarı sərhədini xaric edir**, bu da burada \`floor(price / 500) + 1\`-ə ekvivalentdir.

Əl ilə yazarkən sərhədlərə diqqət edin: \`ceil(price / 500)\` ekvivalent görünür, amma düz 500.00 qiyməti 2-ci yox, 1-ci zolağa qoyur.`,
      commonMistakes: ['Yanlış zolaq sayı.', 'Zolaq sərhədlərində bir vahid fərq.'],
    },
    't10-q08': {
      title: 'Düzəlt: sətrin geri qaytarılan hissəsi',
      prompt: `Hər geri qaytarma üçün sorğu sifariş sətrinin miqdarının **neçə faizinin** geri qaytarıldığını göstərməlidir, 1 onluq rəqəmə yuvarlaqlaşdırılmış (3 vahiddən 1-ni qaytarmaq = 33.3). O, həmişə yalnız 0 və ya 100 göstərir. Düzəldin.

- **Sütunlar:** \`return_id\`, \`pct_returned\`
- **Sıralama:** \`return_id\` üzrə.`,
      hints: ['Hər iki miqdar tam ədəddir. Tam ədədlər hesabında 1 / 3 nədir?'],
      explanation: `\`r.quantity / oi.quantity\` iki tam ədədi bölür: 1 / 3 = 0, 3 / 3 = 1. *Sonradan* 100-ə vurmaq kəsri geri qaytara bilməz. Bölməni əvvəlcə numeric edin, ya \`100.0 * a / b\` ilə (soldan sağa icra olunur, ona görə də 100.0 * a numeric-dir), ya da operandlardan birini cast etməklə.

Tam bölmənin *nəticəsini* cast etmək (yanlış cavab) gecdir.`,
      commonMistakes: ['Tam bölmədən sonra cast etmək.'],
    },
    't10-q09': {
      title: 'İki göndərmə məbləğindən böyüyü',
      prompt: `**2025-ci ilin iyununda** verilmiş sifarişlərin göndərişləri üçün daşıyıcının bizdən aldığı məbləği (\`shipments.shipping_cost\`, bəzən NULL) müştərinin ödədiyi ilə (\`orders.shipping_fee\`) müqayisə edin. İkisindən **böyüyünü** göstərin. Daşıyıcı xərci naməlumdursa, haqqı işlədin.

- **Sütunlar:** \`shipment_id\`, \`shipping_cost\`, \`shipping_fee\`, \`higher\`
- **Sıralama:** \`shipment_id\` üzrə.`,
      hints: [`\`greatest(a, b)\` ən böyük arqumenti qaytarır və NULL-ları nəzərə almır.`],
      explanation: `PostgreSQL-də \`greatest\` və \`least\` **NULL arqumentləri ötürür**. Onlar yalnız *bütün* arqumentlər NULL olduqda NULL qaytarır. Bu, məhz "xərc naməlum olduqda haqqı işlət" deməkdir. \`(a + b + |a − b|) / 2\` hesab hiyləsi riyazi olaraq maksimumdur, amma istənilən NULL onu NULL edir.

(SQL standartı və bəzi verilənlər bazaları *hər hansı* arqument NULL olduqda greatest/least-dən NULL qaytarır. PostgreSQL qaytarmır.)`,
      commonMistakes: ['NULL-u NULL-a çevirən hesab düsturları.', 'greatest əvəzinə least.'],
    },
    't10-q10': {
      title: 'Üç ildən sonra maaş',
      prompt: `**Finance** şöbəsinin aktiv işçilərinin (\`department_id = 6\`, \`termination_date IS NULL\`) maaşlarını **mürəkkəb faizlə üç illik 3% artımdan** sonra proqnozlaşdırın, **ən yaxın yüzlüyə** yuvarlaqlaşdırılmış.

- **Sütunlar:** \`employee_id\`, \`salary\`, \`projected\`
- **Sıralama:** \`employee_id\` üzrə.`,
      hints: [`Mürəkkəb faiz: \`salary * 1.03 ^ 3\`.`, `Mənfi dəqiqliklə yüzlüklərə yuvarlaqlaşdırın: \`round(x, -2)\`.`],
      explanation: `Üç mürəkkəb artım 1.03-ə üç dəfə vurur: \`1.03 ^ 3\` ≈ 1.0927, 1.09 deyil. \`round(x, -2)\` ən yaxın yüzlüyə yuvarlaqlaşdırır, \`round(x / 100) * 100\` ilə eynidir.`,
      commonMistakes: ['Mürəkkəb faiz əvəzinə faizləri toplamaq.', 'Yüzlüklər əvəzinə qəpiklərə yuvarlaqlaşdırmaq.'],
    },
    't10-q11': {
      title: 'Float və numeric',
      prompt: `Bu sorğu nə qaytarır?`,
      hints: ['0.1-in dəqiq ikili təsviri yoxdur.', 'Sürüşən nöqtəli round() "yarımı cüt ədədə" qaydasını işlədir.'],
      explanation: `- İkili sürüşən nöqtədə 0.1 + 0.2 = 0.30000000000000004, ona görə də o, 0.3-ə **bərabər deyil**.
- Cast-sız \`0.1\` **numeric**-dir (dəqiq onluq), ona görə də cəm düz 0.3-dür: **true**.
- double precision üzərində \`round()\` yarımları ən yaxın **cüt** ədədə yuvarlaqlaşdırır: 2.
- numeric üzərində isə yarımları sıfırdan uzağa yuvarlaqlaşdırır: 3.

Pulun numeric-də saxlanmasının səbəbi budur.`,
      commonMistakes: ['Float-ların dəqiq olacağını gözləmək.', 'Hər round()-un .5-i yuxarı yuvarlaqlaşdırdığını düşünmək.'],
    },
    't10-q12': {
      title: 'Qiymətləri xalis məbləğə və ƏDV-yə bölün',
      prompt: `Siyahı qiymətlərimizə **19% ƏDV daxildir**. **Ən bahalı 10 məhsul** üçün (bərabərlikdə \`product_id\` üzrə) qiyməti **xalis** məbləğə və **ƏDV** məbləğinə bölün, hər ikisi qəpiyə qədər dəqiq və elə ki, **xalis + ƏDV həmişə qiymətə tam bərabər olsun**.

- **Sütunlar:** \`product_id\`, \`price\`, \`net\`, \`vat\`
- **Sıralama:** \`price\` üzrə (ən yüksək birinci), sonra \`product_id\`.`,
      hints: ['Xalis = price / 1.19, 2 onluq rəqəmə yuvarlaqlaşdırılmış.', `ƏDV-ni *fərq* kimi hesablayın, \`price - net\`, beləliklə ikisinin cəmi həmişə tutur.`],
      explanation: `ƏDV **xalis** qiymətin faizidir: brutto = xalis × 1.19, deməli xalis = brutto / 1.19. Brutto qiymətin 19%-ni götürmək geniş yayılmış səhvdir.

Hər iki hissəni müstəqil yuvarlaqlaşdırmaq bir qəpik fərqli cəmlər verə bilər. Bir hissəni yuvarlaqlaşdırın, digərini fərq kimi alın, hissələrin cəmi həmişə ilkin qiymətə bərabər olacaq. Eyni fikir istənilən məbləğin bölünməsinə (fakturalar, bölgülər) aiddir.`,
      commonMistakes: ['Brutto qiymətin 19%-ni götürmək.', 'Xalis məbləği və ƏDV-ni müstəqil yuvarlaqlaşdırmaq: bu, onları bir qəpik fərqli edə bilər.'],
    },
    't10-q13': {
      title: '5 qəpiyə yuvarlaqlaşdırılmış nağd qiymətlər',
      prompt: `İsveçrədə nağd məbləğlər ən yaxın **0.05**-ə yuvarlaqlaşdırılır. **1-dən 200-ə qədər** sifarişlərin **endirimli** sətirləri (\`discount > 0\`) üçün effektiv vahid qiyməti \`unit_price * (1 - discount)\` və onun ən yaxın 0.05-ə yuvarlaqlaşdırılmış nağd qiymətini hesablayın.

- **Sütunlar:** \`order_item_id\`, \`effective_price\` (2 onluq rəqəmə yuvarlaqlaşdırılmış), \`cash_price\` (\`numeric(10,2)\` kimi)
- **Sıralama:** \`order_item_id\` üzrə.`,
      hints: [`Ən yaxın 0.05-ə yuvarlaqlaşdırmaq = ən yaxın *iyirmidə birə* yuvarlaqlaşdırmaq: \`round(x * 20) / 20\`.`, `Yuvarlaqlaşdırılmamış effektiv qiyməti yuvarlaqlaşdırın, sonra cast edin: \`::numeric(10,2)\`.`],
      explanation: `Ən yaxın *addıma* yuvarlaqlaşdırmaq üçün addım 1 olsun deyə miqyası dəyişin, yuvarlaqlaşdırın və miqyası geri qaytarın: 0.05 addımlar üçün \`round(x * 20) / 20\`. Məsələn, 42.49 → 849.8 → 850 → 42.50, 8.4915 → 169.83 → 170 → 8.50.

- \`round(x, 1)\` **0.10** addımlarla yuvarlaqlaşdırır: 42.47 42.45 əvəzinə 42.5 olur.
- \`trunc\` həmişə aşağı yuvarlaqlaşdırır.

(.99 ilə bitən siyahı qiymətləri təsadüfən 0.05-ə və 0.10-a eyni cür yuvarlaqlaşır. Endirimli qiymətlər isə yox, buna görə də bu sual onlardan istifadə edir.)`,
      commonMistakes: ['0.05 əvəzinə bir onluq rəqəmə yuvarlaqlaşdırmaq.', 'Yuvarlaqlaşdırmaq əvəzinə kəsmək.'],
    },
    't10-q14': {
      title: 'Lazım olan qutular',
      prompt: `Bir qutu **4 vahid** tutur. Miqdarı **ən azı 3** olan hər sifariş sətri üçün neçə qutu lazımdır?

- **Sütunlar:** \`order_item_id\`, \`quantity\`, \`boxes\` (integer)
- **Sıralama:** \`order_item_id\` üzrə.`,
      hints: ['Qismən dolu qutular da sayılır, ona görə də **yuxarı** yuvarlaqlaşdırın.', `Tam bölməyə diqqət: \`quantity / 4\` artıq kəsri atır.`],
      explanation: `\`ceil(quantity / 4.0)\` yuxarı yuvarlaqlaşdırır: 5 vahid → 1.25 → 2 qutu. \`quantity / 4\` ilə tam bölmə ceil-dən *əvvəl* baş verir, ona görə də 5 / 4 = 1 və ceil(1) = 1 olur, bu da çox az qutudur.

Yalnız tam ədədlərlə işləyən \`(quantity + 3) / 4\` hiyləsi (bölən − 1 əlavə edib tam bölmək) klassik "ceiling division"-dır.`,
      commonMistakes: ['Tam bölmənin ceil-i.', 'ceil əvəzinə round.'],
    },
    't10-q15': {
      title: 'Ən böyük effektiv endirimlər',
      prompt: `Hər sifariş sətri üçün **effektiv vahid qiymət** \`unit_price * (1 - discount)\`-dur. Onu məhsulun **hazırkı siyahı qiyməti** (\`products.price\`) ilə müqayisə edin.

**Siyahı qiymətindən faizlə ən çox aşağı** olan, \`(price - effective) / price * 100\`, 2 onluq rəqəmə yuvarlaqlaşdırılmış, **10 sifariş sətrini** göstərin. Bərabərlikdə \`order_item_id\` üzrə.

- **Sütunlar:** \`order_item_id\`, \`list_price\`, \`effective_price\` (2 onluq rəqəmə yuvarlaqlaşdırılmış), \`pct_below_list\`
- **Sıralama:** \`pct_below_list\` üzrə (ən yüksək birinci), sonra \`order_item_id\`.`,
      hints: ['order_items-i products ilə join edin.', 'Siyahıdan aşağı faiz = (siyahı − effektiv) / **siyahı** × 100. Onu alias ilə bir dəfə hesablayın və həmin alias-a görə sıralayın.'],
      explanation: `"Siyahıdan ucuz" olmağın iki mənbəyi var: köhnə (daha aşağı) \`unit_price\` və sətir \`discount\`-u. Effektiv qiymət hər ikisini birləşdirir.

Faiz **siyahı** qiymətinə (müqayisə etdiyiniz istinada) nisbətdir. Effektiv qiymətə bölmək fərqli, daha böyük ədəd verir. Tam dəqiqliklə hesablayın və yalnız göstərmək üçün yuvarlaqlaşdırın.`,
      commonMistakes: ['Sətir endirimini nəzərə almamaq.', 'Siyahı qiyməti əvəzinə effektiv qiymətə bölmək.'],
    },
    't10-q16': {
      title: 'İllərlə iş stajı',
      prompt: `**Aktiv işçilər** üçün **2025-06-30** istinad tarixinə iş stajını **bir onluq rəqəmlə** illərlə hesablayın: işlənmiş günlər bölünsün 365.25-ə. **Ən uzun staja malik 15** işçini göstərin (bərabərlikdə \`employee_id\` üzrə).

- **Sütunlar:** \`employee_id\`, \`hire_date\`, \`tenure_years\`
- **Sıralama:** \`tenure_years\` üzrə (ən yüksək birinci), sonra \`employee_id\`.`,
      hints: [`\`DATE '2025-06-30' - hire_date\` günlərin sayıdır (integer).`, '365.25-ə (numeric literal) bölün ki, bölmə tam bölmə olmasın.'],
      explanation: `\`date - date\` tam **günləri** integer kimi qaytarır. *Tam* ədəd 365-ə bölmək kəsri səssizcə atan tam bölmədir (12.9 il 12.0 olur). numeric 365.25-ə bölmək kəsri saxlayır və orta hesabla uzun illəri də nəzərə alır.

Təqvimə görə dəqiq yaşlar üçün ("neçə ad günü keçib") \`age()\` və \`extract\` işlədin (11-ci mövzu).`,
      commonMistakes: ['365-ə tam bölmə.', 'Keçmiş işçiləri daxil etmək.'],
    },
  },
};

export default topic;
