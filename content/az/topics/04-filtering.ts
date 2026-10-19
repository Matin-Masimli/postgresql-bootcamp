import type { TopicText } from '../../i18n.ts';

const explanation = `\`WHERE\` yalnız şərti **true** olan sətirləri saxlayır. O, \`FROM\`-dan sonra və \`SELECT\`-dən əvvəl icra olunur, ona görə də cədvəlin sütunları ilə işləyir. Nəticə alias-ları o anda hələ mövcud deyil.

\`\`\`sql
SELECT order_id, status, channel, ordered_at
FROM orders
WHERE channel = 'phone'
  AND status <> 'cancelled'
ORDER BY order_id
LIMIT 10;
\`\`\`

## Müqayisə operatorları

\`=\`, \`<>\` (və ya \`!=\`), \`<\`, \`<=\`, \`>\`, \`>=\` ədədlər, mətnlər, tarixlər və vaxt dəyərləri ilə işləyir. Mətn müqayisəsi **böyük-kiçik hərfə həssasdır**: \`'Berlin' = 'berlin'\` false-dur.

- \`x BETWEEN a AND b\` \`x >= a AND x <= b\` deməkdir. **Hər iki uc daxildir.**
- \`x IN (a, b, c)\` \`x = a OR x = b OR x = c\`-nin qısa yazılışıdır.

## AND, OR, NOT və mötərizələr

\`NOT\` ən güclü bağlanır, sonra \`AND\`, sonra \`OR\`. Yəni \`a AND b OR c\` \`(a AND b) OR c\` deməkdir. AND və OR-u qarışdırdıqda **həmişə mötərizə qoyun**:

\`\`\`sql
-- Göndərilmiş və ya çatdırılmış telefon sifarişləri
SELECT order_id, channel, status
FROM orders
WHERE channel = 'phone'
  AND (status = 'shipped' OR status = 'delivered')
ORDER BY order_id
LIMIT 10;
\`\`\`

## NULL və üçqiymətli məntiq

NULL ilə müqayisə nə true, nə də false-dur. O, **naməlumdur** (NULL), WHERE isə şərti naməlum olan sətirləri atır.

| a | b | a AND b | a OR b |
|---|---|---|---|
| true | NULL | NULL | true |
| false | NULL | false | NULL |
| NULL | NULL | NULL | NULL |

\`NOT NULL\` NULL-dur. Nəticələri:

- \`WHERE email = NULL\` **heç nəyə** uyğun gəlmir. \`WHERE email IS NULL\` / \`IS NOT NULL\` yazın.
- \`WHERE status <> 'pending'\` status-u NULL olan sətirləri səssizcə atır.
- **NOT IN tələsi:** x NULL olduqda \`x NOT IN (1, 2)\` NULL-dur, ona görə də həmin sətirlər yox olur. *Siyahıda* NULL varsa, \`NOT IN\` ümumiyyətlə heç nəyə uyğun gəlmir.
- \`a IS DISTINCT FROM b\` NULL üçün təhlükəsiz "bərabər deyil"-dir: NULL ilə 5 true, NULL ilə NULL false verir. \`IS NOT DISTINCT FROM\` isə NULL üçün təhlükəsiz "bərabər"-dir.

\`\`\`sql
SELECT count(*) FILTER (WHERE country_id NOT IN (1, 2, 7))                       AS not_in_only,
       count(*) FILTER (WHERE country_id NOT IN (1, 2, 7) OR country_id IS NULL) AS with_unknown
FROM customers;
\`\`\`

## Şablon uyğunluğu: LIKE və ILIKE

- \`%\` istənilən simvol ardıcıllığına (heç biri daxil), \`_\` isə düz bir simvola uyğun gəlir.
- \`LIKE\` böyük-kiçik hərfə həssasdır. PostgreSQL-in \`ILIKE\`-ı hərf registrini nəzərə almır.
- Hərfi \`%\` və ya \`_\` axtarmaq üçün onu escape edin: \`LIKE '%\\_%'\` (backslash defolt escape simvoludur), ya da öz simvolunuzu seçin: \`LIKE '%!_%' ESCAPE '!'\`.

\`\`\`sql
SELECT product_id, name
FROM products
WHERE name ILIKE '%keyboard%'
ORDER BY product_id;
\`\`\`

## Tarix və vaxt dəyərlərini filtrləmək

\`orders.ordered_at\` \`timestamptz\`-dir (tarix **və** saat). Bütöv günlər və ya aylar üçün **yarıaçıq aralıqlar** işlədin:

\`\`\`sql
-- 2024-cü ilin fevralındakı bütün sifarişlər (uzun il!)
SELECT count(*)
FROM orders
WHERE ordered_at >= '2024-02-01'
  AND ordered_at <  '2024-03-01';
\`\`\`

\`BETWEEN '2024-02-01' AND '2024-02-29'\` düzgün görünür, amma **2024-02-29 00:00:00**-da dayanır, ona görə də son günün demək olar ki, hamısını buraxır.

Saat qurşağı olmayan vaxt literalı sessiyanın saat qurşağını (burada UTC) işlədir. Başqa yerin yerli vaxtını nəzərdə tutmaq üçün qurşaq adını əlavə edin: \`TIMESTAMPTZ '2024-03-31 00:00 Europe/Berlin'\`.

## Tələlər

- Dəyərlər üçün tək dırnaq, identifikatorlar üçün qoşa dırnaq: \`WHERE status = "pending"\` pending adlı *sütun* axtarır.
- WHERE nəticə alias-larından və aqreqatlardan istifadə edə bilmir. Aqreqatlar HAVING-ə gedir (14-cü mövzu).
- \`<> ''\` NULL-ları istisna etmir. Lazımdırsa, hər ikisini yoxlayın.`;

const topic: TopicText = {
  explanation,
  questions: {
    't04-q01': {
      title: 'Hələ satışda olan premium məhsullar',
      prompt: `Merçendayzinq komandası **hələ satışda olan premium məhsulların** siyahısını istəyir.

Satışdan **çıxarılmamış** (\`discontinued_at\` NULL-dur) və \`price\` dəyəri **ən azı 1000** olan hər məhsulu qaytarın.

- **Sütunlar, bu sırada:** \`product_id\`, \`name\`, \`price\`
- **Sıralama:** \`price\` üzrə, ən yüksək birinci. Qiymətlər bərabər olduqda \`product_id\` üzrə artan sıra ilə.`,
      hints: [
        'Hər iki şərt ödənməlidir, ona görə də onları WHERE-də AND ilə birləşdirin.',
        `Çatışmayan dəyər heç nəyə bərabər deyil, hətta NULL-a da. Onu \`IS NULL\` ilə yoxlayın.`,
        `İki açarla sıralayın: \`ORDER BY price DESC, product_id\`.`,
      ],
      explanation: `1. **Cədvəldən başlayın:** \`FROM products\`.
2. **Hələ satışda olan məhsulları saxlayın:** \`discontinued_at\`-in dəyəri olmadıqda məhsul satışdadır. Çatışmayan dəyər NULL-dur, NULL isə yalnız \`IS NULL\` ilə yoxlana bilər. \`= NULL\` yazmaq NULL ("naməlum") verir, WHERE isə TRUE olmayan hər sətri atır.
3. **Premium məhsulları saxlayın:** "ən azı 1000" 1000-in özünü də daxil edir, ona görə də \`>=\` işlədin.
4. **Şərtləri AND ilə birləşdirin:** sətrin qalması üçün hər ikisi true olmalıdır.
5. **Sıralayın:** \`ORDER BY price DESC\` ən bahalını birinci qoyur. Bəzi məhsulların qiyməti eynidir, ona görə də sıranı tam müəyyən etmək üçün tie-breaker kimi \`product_id\` əlavə edin.`,
      commonMistakes: [
        `\`discontinued_at = NULL\` yazmaq. Bu, heç vaxt true deyil, ona görə də sorğu heç bir sətir qaytarmır.`,
        'Satışdan çıxarılma filtrini buraxıb artıq alına bilməyən məhsulları siyahıya salmaq.',
        'Yalnız qiymətə görə sıralamaq. Onda qiymətləri bərabər olan sətirlər təsadüfi sırada gəlir.',
      ],
    },
    't04-q02': {
      title: 'Razılıq vermiş alman müştərilər',
      prompt: `Marketinq **Almaniyada yaşayan** (\`country_id = 9\`) və **marketinqə razılıq vermiş** (\`marketing_opt_in\` true-dur) müştərilərə e-poçt göndərmək istəyir.

- **Sütunlar:** \`customer_id\`, \`first_name\`, \`last_name\`, \`email\`
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: ['İki şərt, ikisi də mütləq: AND.', `Boolean sütun birbaşa şərt kimi istifadə oluna bilər: \`WHERE marketing_opt_in\`.`],
      explanation: `\`marketing_opt_in\` boolean-dır, ona görə də özü şərt ola bilər: \`WHERE marketing_opt_in\` \`WHERE marketing_opt_in = true\` ilə eynidir. AND ilə \`country_id = 9\` ilə birləşdirildikdə müştəri hər ikisini ödəməlidir.`,
      commonMistakes: ['OR işlətmək: bu, Almaniyadakı hər kəsi və harada olursa olsun razılıq verən hər kəsi qaytarır.'],
    },
    't04-q03': {
      title: 'BETWEEN sərhədləri daxil edirmi?',
      prompt: `\`WHERE price BETWEEN 10 AND 20\` hansı qiymətlərə uyğun gəlir?`,
      hints: ['BETWEEN AND ilə birləşdirilmiş iki müqayisənin qısa yazılışıdır.'],
      explanation: `\`x BETWEEN a AND b\` \`x >= a AND x <= b\` deməkdir: **hər iki** uc daxildir. 10.00 və 20.00 qiymətləri uyğun gəlir.

Vaxt dəyərləri ilə ehtiyatlı olun: \`BETWEEN '2024-02-01' AND '2024-02-29'\` 2024-02-29 **00:00**-da bitir, ona görə də 29-unun çox hissəsi xaric qalır. Əvəzində \`>= start AND < next_day\` işlədin.`,
      commonMistakes: ['Yuxarı sərhədin daxil olmadığını düşünmək.'],
      options: ['10 < price < 20', '10 <= price < 20', '10 <= price <= 20', '10 < price <= 20'],
    },
    't04-q04': {
      title: '1-ə bərabər deyil',
      prompt: `Bu sorğu nə qaytarır?`,
      hints: [`\`NULL <> 1\` nədir: true, false, yoxsa naməlum?`],
      explanation: `NULL sətri üçün \`NULL <> 1\` **naməlumdur** (NULL), WHERE isə yalnız şərti **true** olan sətirləri saxlayır. Ona görə də yalnız 3 qalır.

NULL-ları da saxlamaq üçün \`WHERE x <> 1 OR x IS NULL\` və ya NULL üçün təhlükəsiz \`WHERE x IS DISTINCT FROM 1\` yazın.`,
      commonMistakes: ['NULL-un 1-ə "bərabər olmadığını" düşünmək. O, naməlumdur.'],
    },
    't04-q05': {
      title: 'Göndərilmiş telefon sifarişləri',
      prompt: `**Telefonla** verilmiş (\`channel = 'phone'\`) və statusu **'shipped' və ya 'delivered'** olan bütün sifarişləri göstərin.

- **Sütunlar:** \`order_id\`, \`channel\`, \`status\`
- **Sıralama:** \`order_id\` üzrə.`,
      hints: ['AND OR-dan güclü bağlanır. İki statusu mötərizə ilə qruplaşdırın və ya IN işlədin.'],
      explanation: `\`channel = 'phone' AND status = 'shipped' OR status = 'delivered'\` \`(phone AND shipped) OR delivered\` kimi oxunur. Bu, bütün kanallardan bütün çatdırılmış sifarişləri qaytarır!

Ya OR-u mötərizəyə alın, ya da daha qısa olan və yanlış qruplaşdırıla bilməyən \`status IN ('shipped', 'delivered')\` işlədin.`,
      commonMistakes: ['AND və OR-u mötərizəsiz qarışdırmaq.'],
    },
    't04-q06': {
      title: '"pro" sözü olan məhsullar',
      prompt: `**Adında** istənilən yerdə, **istənilən böyük-kiçik hərflə** ("Pro", "PRO", "pro", …) **"pro" hərfləri olan** bütün məhsulları tapın.

- **Sütunlar:** \`product_id\`, \`name\`
- **Sıralama:** \`product_id\` üzrə.`,
      hints: [`\`%\` istənilən simvol ardıcıllığına uyğun gəlir.`, 'LIKE böyük-kiçik hərfə həssasdır. PostgreSQL-də hərf registrinə həssas olmayan variant var.'],
      explanation: `\`ILIKE\` PostgreSQL-in hərf registrinə həssas olmayan LIKE-ıdır. \`'%pro%'\` "istənilən şey, sonra pro, sonra istənilən şey" deməkdir, yəni mətn istənilən yerdə ola bilər: "Smartphone **Pro**", "Screen **Pro**tector", "**Pro**gramming" adları…

\`lower(name) LIKE '%pro%'\` portativ ekvivalentdir. \`~*\` hərf registrinə həssas olmayan regular expression-dır (9-cu mövzu).`,
      commonMistakes: ['Hərf registrinə həssas olan LIKE işlətmək.', 'Əvvəldəki %-i unutmaq: bu, yalnız "pro" ilə *başlayan* adlara uyğun gəlir.'],
    },
    't04-q07': {
      title: '2024-cü ilin fevralındakı sifarişlər',
      prompt: `**2024-cü ilin fevralında** (UTC) verilmiş **bütün sifarişləri** göstərin. 2024 uzun ildir.

- **Sütunlar:** \`order_id\`, \`ordered_at\`
- **Sıralama:** \`order_id\` üzrə.`,
      hints: [`\`ordered_at\` günün saatını da ehtiva edir. Tarix aralığının hansı ucu təhlükəlidir?`, 'Yarıaçıq aralıq işlədin: fevralın ilk günündən 1 marta qədər, 1 mart daxil olmamaqla.'],
      explanation: `Vaxt dəyəri ilə müqayisə olunduqda \`'2024-02-29'\` **2024-02-29 00:00:00** deməkdir. Ona görə də BETWEEN … AND '2024-02-29' uzun günün gecə yarısından sonrakı hər şeyini xaric edir, məşq verilənlərində isə həmin gün bir neçə sifariş var.

\`>= '2024-02-01' AND < '2024-03-01'\` yarıaçıq aralığı neçə günü olmasından asılı olmayaraq fevralın hər anını əhatə edir və istənilən vaxt dəqiqliyində düzgündür.`,
      commonMistakes: ['Vaxt dəyərində ayın son günü ilə BETWEEN.', '2024-cü ilin fevralının 29 gün olduğunu unutmaq.'],
    },
    't04-q08': {
      title: 'Üç böyük bazardan kənardakı müştərilər',
      prompt: `ABŞ (1), Kanada (2) və ya Böyük Britaniyada (7) **yaşamayan** müştəriləri göstərin. Ölkəsi **naməlum** (NULL) olan müştərilər də **daxil edilməlidir**.

- **Sütunlar:** \`customer_id\`, \`country_id\`
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: [`country_id NULL olduqda \`country_id NOT IN (1, 2, 7)\` true yox, NULL-dur.`, `Həmin sətirləri \`OR country_id IS NULL\` ilə açıq şəkildə əlavə edin.`],
      explanation: `\`country_id\`-si NULL olan müştəri üçün \`NULL NOT IN (1, 2, 7)\` naməlumdur, ona görə də sadə NOT IN onları səssizcə atır. \`OR country_id IS NULL\` onları geri qaytarır.

İkinci yanlış cavab klassik məntiq səhvidir: hər dəyər 1, 2 və 7-dən ən azı birindən fərqlidir, ona görə də \`<> 1 OR <> 2 OR <> 7\` NULL olmayan bütün ölkələr üçün true-dur. "Bunlardan heç biri" AND tələb edir: \`<> 1 AND <> 2 AND <> 7\`.`,
      commonMistakes: ['NOT IN-in NULL-ları atdığını unutmaq.', `Həmişə true olan \`<> a OR <> b\` yazmaq.`],
    },
    't04-q09': {
      title: 'Düzəlt: e-poçtu olmayan müştərilər',
      prompt: `Bu sorğu **e-poçt ünvanı olmayan** (NULL) müştəriləri göstərməlidir, amma heç bir sətir qaytarmır. Düzəldin.

- **Sütunlar:** \`customer_id\`, \`first_name\`, \`last_name\`
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: [`\`email = NULL\` hər sətir üçün nəyə bərabər olur?`],
      explanation: `\`email = NULL\` naməlum dəyərlə müqayisədir, ona görə də nəticə **hər** sətir üçün, email-i NULL olanlar da daxil, naməlumdur. WHERE heç nə saxlamır.

\`IS NULL\` bunun üçün nəzərdə tutulmuş yoxlamadır. Boş mətn \`''\` NULL deyil, real dəyərdir.`,
      commonMistakes: ['NULL əvəzinə boş mətni yoxlamaq.'],
    },
    't04-q10': {
      title: 'Alt xətti olan e-poçtlar',
      prompt: `E-poçt ünvanında **alt xətt simvolu** (\`_\`) olan müştəriləri göstərin.

- **Sütunlar:** \`customer_id\`, \`email\`
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: [`LIKE şablonlarında \`_\` istənilən tək simvola uyğun gələn wildcard-dır.`, `Hərfi alt xəttə uyğunlaşdırmaq üçün onu escape edin: \`'%\\_%'\`.`],
      explanation: `\`LIKE '%_%'\` "ən azı bir simvol" deməkdir: bu, boş olmayan hər e-poçta uyğun gəlir. Hərfi alt xətt axtarmaq üçün onu escape edin. \`\\\` LIKE-ın defolt escape simvoludur, ona görə də \`'%\\_%'\` işləyir, ya da \`ESCAPE '!'\` ilə öz simvolunuzu elan edin.

\`position('_' IN email) > 0\` şablon sintaksisindən tamamilə yayınır (mətn funksiyaları, 9-cu mövzu).`,
      commonMistakes: ['_-nin LIKE-da wildcard olduğunu unutmaq.'],
    },
    't04-q11': {
      title: 'Gözlənilməz yerə göndərilmiş sifarişlər',
      prompt: `**Göndərmə ölkəsi müştərinin öz ölkəsindən fərqli olan** sifarişləri tapın; burada "fərqli" bir tərəfin NULL, digərinin isə NULL olmamasını da əhatə edir. **Hər ikisi** NULL-dursa, sifariş fərqli sayılmır.

- **Sütunlar:** \`order_id\`, \`customer_country_id\` (müştərinin \`country_id\`-si), \`ship_country_id\`
- **Sıralama:** \`order_id\` üzrə.`,
      hints: [`Hər sifarişi öz müştərisi ilə join edin: \`FROM orders o JOIN customers c ON c.customer_id = o.customer_id\`.`, `Tərəflərdən biri NULL olduqda \`<>\` NULL verir. NULL üçün təhlükəsiz müqayisə lazımdır.`, '`a IS DISTINCT FROM b`'],
      explanation: `\`IS DISTINCT FROM\` NULL-a adi dəyər kimi yanaşır:

| ship | customer | \`<>\` | \`IS DISTINCT FROM\` |
|---|---|---|---|
| 9 | 7 | true | true |
| NULL | 7 | NULL → atılır | **true** |
| 7 | NULL | NULL → atılır | **true** |
| NULL | NULL | NULL | **false** |

Sadə \`<>\` yarı-NULL halları buraxır. Onu \`OR ship_country_id IS NULL\` ilə yamamaq yalnız bir tərəfi əhatə edir, hər iki IS NULL yoxlamasını əlavə etmək isə NULL/NULL cütlərini səhvən daxil edir. IS DISTINCT FROM dörd halın hamısını düzgün həll edir.`,
      commonMistakes: ['<> işlətmək: bu, bir tərəfin NULL olduğu sətirləri itirir.', 'Yalnız bir tərəfin NULL olmasını nəzərə almaq.', 'NULL/NULL-u fərqli saymaq.'],
    },
    't04-q12': {
      title: 'Berlin təqvim gününə düşən sifarişlər',
      prompt: `Berlin komandası **Berlin yerli vaxtı ilə 31 mart 2024**-də (saat qurşağı \`'Europe/Berlin'\`) verilmiş hər sifarişi istəyir. Həmin gecə saatlar irəli çəkildi, ona görə də bu yerli gün cəmi 23 saat çəkdi.

- **Sütunlar:** \`order_id\`, \`ordered_at\` (saxlandığı kimi, UTC)
- **Sıralama:** \`order_id\` üzrə.`,
      hints: [`Qurşaq adı olan literal orada yerli vaxt deməkdir: \`TIMESTAMPTZ '2024-03-31 00:00 Europe/Berlin'\`.`, 'Yerli gecə yarısından növbəti yerli gecə yarısına qədər yarıaçıq aralıq işlədin.'],
      explanation: `Vaxt dəyərləri UTC-də anlar kimi saxlanılır. "Berlində 31 mart" UTC vaxtının fərqli pəncərəsidir:

- 31 martda yerli gecə yarısı **30 mart, 23:00 UTC**-dir (Berlin qışda UTC+1-dir),
- 1 aprel yerli gecə yarısı **31 mart, 22:00 UTC**-dir (saatlar yerli vaxtla 02:00-da dəyişdikdən sonra UTC+2).

Sərhədləri \`TIMESTAMPTZ '… Europe/Berlin'\` kimi yazmaq PostgreSQL-ə hər biri üçün, DST dəyişikliyi daxil, düzgün sürüşməni tətbiq etməyə imkan verir. Sabit \`+01\` sürüşməsi günün sonunu səhv müəyyən edir, adi UTC tarixləri isə tamamilə başqa günü təsvir edir.`,
      commonMistakes: ['UTC təqvim gününə görə filtrləmək.', 'Yay vaxtına keçidi nəzərə almayan sabit sürüşmə (+01) işlətmək.'],
    },
    't04-q13': {
      title: 'New York-dakı müştərilər, necə yazılmasından asılı olmayaraq',
      prompt: `**New York**-da yaşayan müştəriləri tapın. \`city\` sütununu insanlar yazıb, ona görə də o, 'New York', 'new york' və ya 'New York ' (sonda boşluqla) ola bilər. Hamısına uyğunlaşdırın.

- **Sütunlar:** \`customer_id\`, \`city\`
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: [`\`trim(city)\` əvvəldəki və sondakı boşluqları silir.`, `Hərf registrini nəzərə almadan müqayisə edin: \`ILIKE\` və ya \`lower(…) = 'new york'\`.`],
      explanation: `Müqayisədən əvvəl normallaşdırın: \`trim()\` ətrafdakı boşluqları silir, \`lower()\` (və ya ILIKE) hərf registri fərqlərini aradan qaldırır. Bundan sonra müqayisə hər üç yazılışa uyğun gəlir.

Sütunun funksiyasına görə filtrləmə həmin sütundakı adi index-dən istifadə edə bilmir. Bu sorğu tez-tez icra olunsaydı, \`lower(trim(city))\` üzərində ifadə üzrə index yaradardınız (2-ci mövzu) və ya verilənləri bir dəfə təmizləyərdiniz.`,
      commonMistakes: ['Variantları buraxan dəqiq müqayisə.', 'trim olmadan ILIKE: bu, sonu boşluqlu sətirləri yenə buraxır.'],
    },
    't04-q14': {
      title: 'NULL ilə məntiq',
      prompt: `Bu sorğu nə qaytarır?`,
      hints: ['AND-in bir tərəfi false-dursa, digər tərəfin nə olmasının fərqi varmı?'],
      explanation: `Üçqiymətli məntiq NULL-u yalnız naməlum dəyər nəticəni dəyişə bildikdə qaytarır:

- \`NULL AND false\`: AND hər iki tərəfin true olmasını tələb edir. Biri false-dur, ona görə də NULL nə olursa olsun, nəticə **false**-dur.
- \`NULL OR true\`: bir tərəf true-dur, ona görə də nəticə **true**-dur.
- \`NOT NULL\`: naməlumun əksi yenə də **naməlumdur**.`,
      commonMistakes: ['NULL olan istənilən ifadənin NULL verdiyini düşünmək.'],
    },
    't04-q15': {
      title: 'Diqqət tələb edən sifarişlər',
      prompt: `Əməliyyatlar şöbəsi diqqət tələb edən sifarişlərin siyahısını istəyir. Sifariş diqqət tələb edir, əgər

- o, hələ də **'pending' və ya 'processing'** statusundadırsa və **2025-06-20-dən əvvəl** verilibsə, **və ya**
- o, **'shipped'** statusundadırsa və anbarı (\`shipped_at\`) **2025-06-01-dən əvvəl** tərk edibsə (yolda itmiş ola bilər),

**və hər iki halda** \`'marketplace'\` kanalı ilə verilməyibsə (marketplace sifarişlərini partnyor idarə edir).

- **Sütunlar:** \`order_id\`, \`status\`, \`channel\`, \`ordered_at\`, \`shipped_at\`
- **Sıralama:** \`order_id\` üzrə.`,
      hints: ['Hər "diqqət tələb edir" halını öz mötərizəsinə yazın, onları OR ilə birləşdirin və kanal qaydasını AND ilə əlavə etməzdən əvvəl bütün OR-u mötərizəyə alın.'],
      explanation: `Biznes qaydasının strukturunu birbaşa mötərizələrə çevirin:

\`(caseA OR caseB) AND not-marketplace\`

Xarici mötərizələr olmadan AND OR-dan güclü bağlanır və kanal qaydası yalnız göndərilmiş hala tətbiq olunur. Onda gözləmədə olan marketplace sifarişləri də içəri sızır.

Diqqət: heç vaxt göndərilməmiş sifarişlər üçün \`shipped_at < '2025-06-01'\` NULL-dur. Burada problem deyil, çünki şərt yalnız \`status = 'shipped'\` ilə birlikdə əhəmiyyət kəsb edir.`,
      commonMistakes: ['Xarici mötərizələri buraxmaq.', 'Marketplace istisnasını unutmaq.'],
    },
    't04-q16': {
      title: 'Beynəlxalq prefiksi olmayan telefon nömrələri',
      prompt: `SMS kampaniyası üçün **telefon nömrəsi olan**, amma **beynəlxalq formatda olmayan**, yəni nə \`+\`, nə də \`00\` ilə başlayan müştəriləri tapın.

- **Sütunlar:** \`customer_id\`, \`phone\`
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: [`"İlə başlayır" \`LIKE '+%'\`-dir.`, 'Nə A, nə də B = NOT A AND NOT B (De Morgan).'],
      explanation: `"Nə +, nə də 00" *+ deyil* **və** *00 deyil* deməkdir. OR ilə hər nömrə keçir, çünki heç bir nömrə hər ikisi ilə başlamır.

NULL telefonlar xüsusi emal tələb etmir: \`NULL NOT LIKE '+%'\` naməlumdur, ona görə də həmin sətirlər avtomatik atılır. "Telefon nömrəsi var" tələbi də məhz budur.`,
      commonMistakes: ['İki inkar edilmiş şərt arasında OR işlətmək.', '00 prefiksini unutmaq.'],
    },
  },
};

export default topic;
