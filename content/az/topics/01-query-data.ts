import type { TopicText } from '../../i18n.ts';

const explanation = `\`SELECT\` cədvəllərdən sətirləri oxuyur və nəticəyə forma verir: hansı sütunlar, necə hesablanır, hansı sırada və neçə dənə. Bu mövzu sorğunun sətirləri filtrləməyən hissələrini əhatə edir. \`WHERE\` ilə filtrləmə 4-cü mövzudadır.

\`\`\`text
SELECT [DISTINCT | DISTINCT ON (…)] expression [AS alias], …
FROM table [AS t]
ORDER BY expression [ASC | DESC] [NULLS FIRST | NULLS LAST], …
LIMIT n OFFSET m        -- və ya: OFFSET m ROWS FETCH FIRST n ROWS ONLY | WITH TIES
\`\`\`

## Sütunlar, ifadələr və alias-lar

- \`SELECT *\` bütün sütunları qaytarır. Araşdırma üçün rahatdır, amma real sorğularda sütunları adbaad yazın ki, cədvəl dəyişəndə nəticə dəyişməsin.
- İstənilən ifadə sütun ola bilər: hesab əməliyyatı (\`price - cost\`), mətnlərin birləşdirilməsi (\`first_name || ' ' || last_name\`), sabitlər, funksiya çağırışları.
- \`AS\` sütuna ad verir. Dırnaqsız identifikatorlar kiçik hərfə çevrilir. Boşluqlu və ya böyük hərfli adlar üçün qoşa dırnaq işlədin: \`AS "Full name"\`. Tək dırnaq **mətn dəyərləri** üçündür, adlar üçün heç vaxt.
- Cədvəl alias-ı (\`FROM products AS p\`) tam adları qısaldır: \`p.price\`.
- \`SELECT\` \`FROM\` olmadan da işləyir: \`SELECT 2 + 3 AS five;\`

\`\`\`sql
SELECT sku,
       name AS product,
       price,
       cost,
       price - cost AS margin
FROM products
ORDER BY product_id
LIMIT 5;
\`\`\`

NULL ilə hesab əməliyyatı NULL verir: \`cost\` dəyəri naməlum olan məhsulların \`margin\` dəyəri də naməlumdur.

## DISTINCT və DISTINCT ON

\`SELECT DISTINCT\` nəticədən təkrarlanan **sətirləri** silir. O, seçilmiş bütün sütunlara birlikdə baxır. Burada iki NULL təkrar sayılır.

\`\`\`sql
SELECT DISTINCT region, currency
FROM countries
ORDER BY region, currency;
\`\`\`

PostgreSQL-də \`DISTINCT ON (expr)\` də var. O, eyni \`expr\` dəyərli hər qrupdan yalnız **birinci sətri** saxlayır; "birinci"ni isə \`ORDER BY\` müəyyən edir. ORDER BY DISTINCT ON ifadələri ilə başlamalıdır.

\`\`\`sql
-- Hər kateqoriyada ən ucuz məhsul
SELECT DISTINCT ON (category_id) category_id, product_id, name, price
FROM products
ORDER BY category_id, price, product_id;
\`\`\`

## ORDER BY

\`ORDER BY\` olmadan PostgreSQL sətirləri ona əlverişli olan istənilən sırada qaytarır və bu sıra dəyişə bilər. Sıra vacibdirsə, bunu açıq yazın.

- Bir neçə açar: \`ORDER BY price DESC, product_id\`. İkinci açar yalnız birincidəki bərabərlikləri (tie) ayırır.
- Nəticədəki alias-a (\`ORDER BY margin\`), sütunun mövqeyinə (\`ORDER BY 2\`) və ya istənilən ifadəyə görə sıralaya bilərsiniz.
- **Artan sırada NULL-lar sonda, azalan sırada isə əvvəldə olur.** Bunu \`NULLS FIRST\` / \`NULLS LAST\` ilə dəyişin.
- \`SELECT DISTINCT\` ilə ORDER BY yalnız select siyahısında olan ifadələrə istinad edə bilər.

\`\`\`sql
SELECT product_id, price - cost AS margin
FROM products
ORDER BY margin DESC NULLS LAST, product_id
LIMIT 5;
\`\`\`

## LIMIT, OFFSET və FETCH

- \`LIMIT n\` ilk *n* sətri saxlayır, \`OFFSET m\` isə əvvəlcə *m* sətri ötürür. *s* ölçülü *k*-cı səhifə: \`LIMIT s OFFSET (k - 1) * s\`.
- LIMIT-i həmişə **unikal tie-breaker**-i olan ORDER BY ilə birlikdə işlədin. Əks halda "ilk 10" dəqiq müəyyən olunmur.
- SQL standartındakı yazılışı \`OFFSET m ROWS FETCH FIRST n ROWS ONLY\`-dır. \`FETCH FIRST n ROWS WITH TIES\` sonuncu sətirlə bərabər olan bütün sətirləri də qaytarır (ORDER BY tələb edir).

\`\`\`sql
-- Ən ucuz 5 qiymət, üstəgəl 5-ci ilə bərabər olan hər şey
SELECT product_id, name, price
FROM products
ORDER BY price
FETCH FIRST 5 ROWS WITH TIES;
\`\`\`

## Sorğunun icra olunma sırası

Siz \`SELECT … FROM … ORDER BY … LIMIT\` *yazırsınız*, amma PostgreSQL məntiqi olaraq belə icra edir:

1. \`FROM\` (və join-lər), sonra \`WHERE\`, \`GROUP BY\` və \`HAVING\` (sonrakı mövzular),
2. \`SELECT\`: ifadələri və alias-ları hesablayır,
3. \`DISTINCT\`,
4. \`ORDER BY\`, ona görə də 2-ci addımdakı alias-lardan istifadə edə bilir,
5. \`LIMIT\` / \`OFFSET\`.

## Tələlər

- \`'text'\` mətndir, \`"text"\` isə identifikatordur. \`SELECT "price" FROM products\` işləyir, \`SELECT 'price' FROM products\` isə hər sətirdə *price* sözünü qaytarır.
- \`OFFSET\` ilə səhifələmə dərin səhifələrdə yavaşlayır, çünki ötürülən sətirlər yenə də oxunur. Bizim kiçik cədvəllər üçün problem deyil.
- Mətn verilənlər bazasının collation-ına görə sıralanır; böyük hərflər, boşluqlar və diakritik işarələr sıraya təsir edir. Müştəri adlarımız qəsdən səliqəsizdir.`;

const topic: TopicText = {
  explanation,
  questions: {
    't01-q01': {
      title: 'Şöbələrin siyahısı',
      prompt: `Bütün şöbələri id-si, adı və yeri ilə birlikdə, adına görə əlifba sırası ilə göstərin.

- **Sütunlar:** \`department_id\`, \`name\`, \`location\`
- **Sıralama:** \`name\` üzrə.`,
      hints: [`Hər üç sütun \`departments\` cədvəlindədir.`, `\`ORDER BY name\` ilə sıralayın.`],
      explanation: `1. \`FROM departments\` cədvəli seçir.
2. Select siyahısı üç sütunu tələb olunan sırada sadalayır.
3. \`ORDER BY name\` əlifba sırası ilə sıralayır. Artan sıra defoltdur, ona görə də \`ASC\` yazmaq məcburi deyil.

Yeri olmayan şöbələrin həmin sütununda NULL görünür. Onlar yenə də siyahıdadır, çünki burada heç nə sətirləri filtrləmir.`,
      commonMistakes: ['ORDER BY-ı unutmaq. Onsuz sətirlərin sırası zəmanətli deyil.', 'Sütunları tələb olunandan fərqli sırada yazmaq.'],
    },
    't01-q02': {
      title: 'Məhsulların qiymət siyahısı',
      prompt: `Bütün məhsulların qiymət siyahısını hazırlayın. Qiyməti **\`list_price\`** adı ilə göstərin.

- **Sütunlar:** \`sku\`, \`name\`, \`list_price\`
- **Sıralama:** ən bahalılar birinci. Qiyməti eyni olan məhsullar \`sku\` üzrə sıralanır.`,
      hints: [`Sütunun adını \`AS\` ilə dəyişin: \`price AS list_price\`.`, `İki açarla sıralayın: \`ORDER BY price DESC, sku\`.`],
      explanation: `1. \`price AS list_price\` nəticə sütununun adını dəyişir. \`AS\` məcburi deyil, amma niyyəti aydın göstərir.
2. \`ORDER BY list_price DESC\` ən bahalını birinci qoyur. ORDER BY alias-dan istifadə edə bilər, çünki SELECT-dən sonra icra olunur.
3. Bir çox məhsulun qiyməti eynidir, ona görə də bu bərabərlikləri \`sku\` ayırır.`,
      commonMistakes: ['DESC-i unutmaq: onda ən ucuzlar birinci gəlir.', `Sütuna \`list_price\` adını verməmək.`, 'Bərabərlikləri sku əvəzinə ada görə ayırmaq.'],
    },
    't01-q03': {
      title: 'Hansı clause sonuncu icra olunur?',
      prompt: `Bu sorğuda hansı clause **məntiqi olaraq sonuncu icra olunur**?

\`\`\`sql
SELECT DISTINCT price AS p FROM products ORDER BY p DESC LIMIT 3;
\`\`\``,
      hints: [`ORDER BY \`p\` alias-ından istifadə edə bilir, deməli SELECT-dən sonra gəlməlidir. Sıralamadan sonra daha nə baş verməlidir?`],
      explanation: `Məntiqi sıra belədir: FROM → SELECT (ifadələr və alias-lar) → DISTINCT → ORDER BY → LIMIT.

LIMIT ORDER BY-dan sonra gəlməlidir: "ilk 3 sətir" yalnız sətirlər sıralandıqdan sonra məna kəsb edir. Elə buna görə də ORDER BY SELECT-də təyin olunan \`p\` alias-ından istifadə edə bilir.`,
      commonMistakes: ['Clause-ların yazıldığı sırada icra olunduğunu düşünmək. SELECT birinci yazılır, amma FROM-dan sonra icra olunur.'],
      options: ['`FROM`', '`SELECT` (`p`-nin hesablanması)', '`ORDER BY`', '`LIMIT`'],
    },
    't01-q04': {
      title: 'DISTINCT və NULL',
      prompt: `Bu sorğunun nəticəsini təxmin edin.`,
      hints: ['DISTINCT üçün iki NULL təkrar sayılır.', 'Artan sırada NULL-lar defolt olaraq harada olur?'],
      explanation: `- DISTINCT hər dəyərdən bir nüsxə saxlayır. Burada iki NULL təkrar sayılır, ona görə də bir NULL qalır.
- PostgreSQL-də artan sırada NULL-lar defolt olaraq **sonda** olur.

Deməli nəticə 1, 2, NULL-dur. \`(VALUES …) AS t(x)\` adı \`x\` olan tək sütunlu kiçik daxili cədvəldir.`,
      commonMistakes: ['DISTINCT-in NULL-ları sildiyini düşünmək. O, birini saxlayır.', 'Artan sırada NULL-ların əvvəldə olacağını gözləmək (başqa verilənlər bazalarında fərqlidir).'],
    },
    't01-q05': {
      title: 'Region və valyuta kombinasiyaları',
      prompt: `\`countries\` cədvəlində **region** və **valyuta** (currency) dəyərlərinin hansı kombinasiyaları var? Hər kombinasiyanı bir dəfə göstərin.

- **Sütunlar:** \`region\`, \`currency\`
- **Sıralama:** əvvəlcə \`region\`, sonra \`currency\` üzrə.`,
      hints: ['DISTINCT bütün sətrə tətbiq olunur: hər iki sütuna birlikdə.'],
      explanation: `\`SELECT DISTINCT region, currency\` həm region-u, həm də currency-si başqa bir sətirlə eyni olan sətirləri silir. Europe EUR, GBP, SEK və başqaları ilə birlikdə görünür. Hər cüt bir dəfə çıxır.

DISTINCT olmadan hər ölkə üçün bir sətir alırsınız (34 sətir) və çoxlu təkrarlanan cütlər olur.`,
      commonMistakes: ['Yalnız region-u seçmək, bu zaman valyuta ölçüsü itir.', 'DISTINCT-i unutmaq.'],
    },
    't01-q06': {
      title: 'Ən bahalı on məhsul',
      prompt: `**Ən bahalı 10 məhsulu** göstərin. Qiymətlər bərabər olduqda daha kiçik \`product_id\` birinci gəlir.

- **Sütunlar:** \`product_id\`, \`name\`, \`price\`
- **Sıralama:** \`price\` üzrə (ən yüksək birinci), sonra \`product_id\`. Düz 10 sətir.`,
      hints: ['Sıralayın, sonra LIMIT ilə ilk sətirləri saxlayın.', '`ORDER BY price DESC, product_id LIMIT 10`'],
      explanation: `\`ORDER BY price DESC, product_id\` ən bahalını birinci qoyur və bərabər qiymətlərin sırasını deterministik edir. Sonra \`LIMIT 10\` ilk on sətri saxlayır.

\`FETCH FIRST 10 ROWS ONLY\` eyni şeyin SQL standartındakı yazılışıdır.`,
      commonMistakes: ['ORDER BY olmadan LIMIT tətbiq etmək. Onda "ilk 10" təsadüfi olur.', 'Artan sıra ilə sıralamaq: onda ən ucuz məhsullar alınır.'],
    },
    't01-q07': {
      title: 'Ən böyük marjalar (naməlum xərclər sonda)',
      prompt: `Məhsulun marjası \`price - cost\`-dur. Bəzi məhsulların \`cost\` dəyəri qeyd olunmayıb, ona görə də onların marjası naməlumdur (NULL).

**Marjası ən böyük olan 15 məhsulu** göstərin. Marjası naməlum olan məhsullar bütün məlum olanlardan **sonra** gəlməlidir. Bərabər marjalar \`product_id\` üzrə sıralanır.

- **Sütunlar:** \`product_id\`, \`price\`, \`cost\`, \`margin\`
- **Sıralama:** marja ən yüksəkdən, NULL-lar sonda, sonra \`product_id\`. 15 sətir.`,
      hints: ['cost NULL olduqda `price - cost AS margin` NULL olur.', 'Azalan sırada PostgreSQL NULL-ları **əvvələ** qoyur. `NULLS LAST` əlavə edin.'],
      explanation: `1. \`price - cost AS margin\` marjanı hesablayır. Hər hansı dəyərdən NULL çıxanda NULL alınır.
2. Sıralama zamanı PostgreSQL NULL-u bütün dəyərlərdən *böyük* sayır, ona görə də \`DESC\` sırada NULL marjalar birinci gəlir və top 15-i doldurur.
3. \`NULLS LAST\` onları sona keçirir. \`product_id\` tie-breaker-i sıranı deterministik edir.`,
      commonMistakes: ['`NULLS LAST` olmadan `DESC` sıralamaq: onda naməlum marjalar siyahının başında olur.', 'cost − price hesablamaq: bu, işarəni tərsinə çevirir.'],
    },
    't01-q08': {
      title: 'Kataloqun üçüncü səhifəsi',
      prompt: `Onlayn kataloq məhsulları \`name\` üzrə əlifba sırası ilə (bərabərlikdə \`product_id\` üzrə), hər səhifədə 20 məhsul olmaqla göstərir. **3-cü səhifəni** qaytarın.

- **Sütunlar:** \`product_id\`, \`name\`
- **Sıralama:** \`name\` üzrə, sonra \`product_id\`. Ən çox 20 sətir.`,
      hints: ['3-cü səhifə 1-ci və 2-ci səhifələri ötürür: bu, 2 × 20 sətirdir.', '`LIMIT 20 OFFSET 40`'],
      explanation: `*s* ölçülü *k*-cı səhifə \`(k − 1) × s\` sətri ötürür: \`OFFSET 40\`, sonra \`LIMIT 20\`.

Sıralama əvvəlki səhifələrdəki ilə eyni olmalı və unikal tie-breaker ehtiva etməlidir. Əks halda məhsullar iki səhifədə görünə və ya heç birində görünməyə bilər.`,
      commonMistakes: ['OFFSET 60 (bu, 4-cü səhifədir) və ya OFFSET 2 (bu, sətirləri yox, səhifələri sayır) işlətmək.', 'Deterministik ORDER BY olmadan səhifələmək.'],
    },
    't01-q09': {
      title: 'İlk müştərilərin tam adları',
      prompt: `**Ən erkən qeydiyyatdan keçmiş 25 müştərini** tam adları ilə göstərin: \`first_name\`, bir boşluq, sonra \`last_name\`. Adları saxlandığı kimi saxlayın, səliqəsiz boşluqlar və böyük-kiçik hərflər daxil.

- **Sütunlar:** \`customer_id\`, \`full_name\`, \`signup_at\`
- **Sıralama:** \`signup_at\` üzrə, sonra \`customer_id\`. 25 sətir.`,
      hints: [`\`||\` mətnləri birləşdirir: \`first_name || ' ' || last_name\`.`],
      explanation: `\`||\` mətnləri birləşdirir: \`first_name || ' ' || last_name\`. Boşluq tək dırnaq içində yazılmış mətn literalıdır.

\`concat(…)\` da eyni işi görür, üstəlik NULL-u boş mətn kimi qəbul edir. Burada hər iki ad sütunu NOT NULL-dur, ona görə də nəticələr eynidir.

Səliqəsiz adları təmizləmək (trim, böyük-kiçik hərflər) 9-cu mövzudakı mətn funksiyalarının işidir.`,
      commonMistakes: ['Adların arasındakı boşluğu unutmaq.', `Boşluq üçün qoşa dırnaq \`" "\` işlətmək. Qoşa dırnaq identifikator deməkdir.`],
    },
    't01-q10': {
      title: 'Düzəlt: valyutaların sıralanmış siyahısı',
      prompt: `Bu sorğu ölkələrimizin istifadə etdiyi hər **valyutanı** valyuta koduna görə əlifba sırası ilə **bir dəfə** göstərməlidir. O, xəta ilə dayanır. Düzəldin.

- **Sütunlar:** \`currency\`
- **Sıralama:** \`currency\` üzrə.`,
      hints: ['Xəta mesajını oxuyun. DISTINCT olduqda ORDER BY nəyə istinad edə bilər?'],
      explanation: `Xəta belədir: *for SELECT DISTINCT, ORDER BY expressions must appear in select list*. DISTINCT-dən sonra \`EUR\` kimi bir sətir adları fərqli olan bir neçə ölkəni təmsil edir, ona görə də "ada görə sırala" əmrinin tək cavabı yoxdur.

Select siyahısında olan bir şeyə görə sıralayın, burada valyutanın özünə görə.`,
      commonMistakes: ['Xətanı susdurmaq üçün DISTINCT-i silmək: bu, təkrarları geri qaytarır.'],
    },
    't01-q11': {
      title: 'Hər kateqoriyanın ən ucuz məhsulu',
      prompt: `**Hər \`category_id\` üçün** onun **ən ucuz məhsulunu** göstərin (bir neçə məhsulun qiyməti eyni və ən aşağıdırsa, \`product_id\`-si ən kiçik olanı). PostgreSQL-in \`DISTINCT ON\` imkanından istifadə edin.

- **Sütunlar:** \`category_id\`, \`product_id\`, \`name\`, \`price\`
- **Sıralama:** \`category_id\` üzrə.`,
      hints: ['`DISTINCT ON (category_id)` hər kateqoriyanın birinci sətrini saxlayır.', 'Hansı sətrin "birinci" olduğunu ORDER BY müəyyən edir və o, `category_id` ilə başlamalıdır.'],
      explanation: `\`DISTINCT ON (category_id)\` hər kateqoriyadan düz bir sətir saxlayır: ORDER BY sırasında birinci olanı.

\`ORDER BY category_id, price, product_id\` həmin sətri ən ucuz məhsul edir, bərabərlikdə isə ən kiçik id qalib gəlir. ORDER BY DISTINCT ON ifadəsi ilə *başlamalıdır*.

DISTINCT ON PostgreSQL-ə xasdır. 17-ci mövzu ROW_NUMBER() ilə portativ ekvivalentini göstərir.`,
      commonMistakes: ['price DESC üzrə sıralamaq: bu, ən bahalı məhsulu qaytarır.', 'price-ı ORDER BY-dan çıxarmaq: bu, hər kateqoriya üçün təsadüfi məhsul qaytarır.'],
    },
    't01-q12': {
      title: 'Ən ucuz məhsullar, bərabərlər daxil',
      prompt: `**Ən ucuz 5 məhsulu** göstərin, amma başqa məhsulların qiyməti **5-ci məhsulun qiyməti ilə eynidirsə**, onları da daxil edin (yəni nəticədə 5-dən çox sətir ola bilər).

- **Sütunlar:** \`product_id\`, \`name\`, \`price\`
- **Sıralama:** istənilən sıra. Yalnız sətirlər toplusu yoxlanılır.`,
      hints: ['LIMIT bərabərləri kəsir. SQL standartında onları saxlayan variant var.', '`ORDER BY price FETCH FIRST 5 ROWS WITH TIES`'],
      explanation: `\`FETCH FIRST 5 ROWS WITH TIES\` ilk 5 sətri, *üstəgəl* ORDER BY dəyərləri 5-cinin dəyərləri ilə eyni olan bütün sonrakı sətirləri qaytarır. Məşq verilənlərində bir neçə məhsul 5-ci ən aşağı qiyməti paylaşır, ona görə də 5-dən çox sətir alırsınız.

Diqqət: ORDER BY **yalnız** bərabərliyi müəyyən edən sütunu ehtiva etməlidir. \`product_id\` əlavə etsəniz, hər sətir unikal olur, bərabərlik qalmır və nəticə düz 5 sətir olur.`,
      commonMistakes: ['LIMIT 5 işlətmək: bu, 5-ci ilə bərabər olan məhsulları atır.', 'ORDER BY-a tie-breaker əlavə etmək. Onda sətirlər heç vaxt bərabər olmur.'],
    },
    't01-q13': {
      title: 'Ən yüksək komissiya faizləri',
      prompt: `**\`commission_pct\` dəyəri ən yüksək olan 10 işçini** göstərin. Komissiyası olmayan (NULL) işçilər heç vaxt komissiyası olanlardan əvvəl gəlməməlidir. Komissiya bərabər olduqda daha yüksək \`salary\` birinci, sonra daha kiçik \`employee_id\` gəlir.

- **Sütunlar:** \`employee_id\`, \`first_name\`, \`last_name\`, \`commission_pct\`, \`salary\`
- **Sıralama:** təsvir olunduğu kimi. 10 sətir.`,
      hints: ['PostgreSQL DESC sıralamada NULL-ları defolt olaraq necə yerləşdirir?', '`ORDER BY commission_pct DESC NULLS LAST, salary DESC, employee_id`'],
      explanation: `İşçilərin çoxunun ümumiyyətlə komissiyası yoxdur. \`DESC\` sıralamada PostgreSQL NULL-ları **əvvələ** qoyur, ona görə də sadə \`ORDER BY commission_pct DESC\` komissiyası *olmayan* on işçini qaytarır!

\`NULLS LAST\` bunu düzəldir. Qalan açarlar bərabərlik qaydalarını həyata keçirir: maaş yüksəkdən aşağıya, sonra id.`,
      commonMistakes: ['NULLS LAST-ı unutmaq: onda top 10 tamamilə NULL-lardan ibarət olur.', 'Bərabərliyi ayırarkən maaşı artan sıra ilə sıralamaq.'],
    },
    't01-q14': {
      title: 'NULL ilə azalan sıra',
      prompt: `Nəticəni təxmin edin.`,
      hints: ['Sıralama zamanı PostgreSQL NULL-u istənilən dəyərdən böyük sayır.'],
      explanation: `PostgreSQL NULL-u sanki bütün NULL olmayan dəyərlərdən böyükmüş kimi sıralayır. Ona görə də azalan sırada NULL **birinci** gəlir, ardınca 2. \`LIMIT 2\` bu iki sətri saxlayır.

2, 1 almaq üçün \`ORDER BY x DESC NULLS LAST\` işlədin.`,
      commonMistakes: ['NULL-ların həmişə sonda olduğunu düşünmək.', 'ORDER BY-ın NULL-ları atdığını düşünmək. O, heç vaxt atmır.'],
    },
    't01-q15': {
      title: 'Üçüncü ən yüksək unikal qiymət',
      prompt: `Kataloqdakı **üçüncü ən yüksək unikal qiymət** nədir? Bir neçə məhsul ən yüksək qiyməti paylaşırsa, həmin qiymət yenə də bir dəfə sayılır.

- **Sütunlar:** \`price\`
- Bir sətir.`,
      hints: ['Əvvəlcə qiymətləri unikal dəyərlərə endirin.', 'Sonra azalan sıra ilə sıralayıb ilk iki dəyəri ötürün: `OFFSET 2 LIMIT 1`.'],
      explanation: `Bu, window function-lardan istifadə etmədən həll olunan klassik "N-ci ən böyük dəyər" müsahibə sualıdır:

1. \`SELECT DISTINCT price\` eyni qiymətləri bir sətrə yığır.
2. \`ORDER BY price DESC\` ən yüksəyini birinci qoyur.
3. \`OFFSET 2\` iki ən yüksək unikal qiyməti ötürür, \`LIMIT 1\` isə növbətini saxlayır.

DISTINCT olmadan ikinci ən yüksək qiyməti paylaşan iki məhsul 2-ci və 3-cü mövqeləri tutar və siz ikinci ən yüksək qiyməti qaytarardınız. 17-ci mövzu eyni məsələni hər qrup üçün \`DENSE_RANK()\` ilə həll edir.`,
      commonMistakes: ['DISTINCT-i unutmaq: onda təkrarlar ayrı mövqelər kimi sayılır.', 'Üçüncü dəyər üçün OFFSET 3 işlətmək. Offset *ötürülən* sətirləri sayır.'],
    },
    't01-q16': {
      title: 'Hər ölkənin ən yeni müştərisi',
      prompt: `**Hər \`country_id\` dəyəri üçün** (ölkəsi naməlum olan müştərilər öz NULL qrupunu təşkil edir) **ən son qeydiyyatdan keçmiş** müştərini göstərin. İki müştəri eyni anda qeydiyyatdan keçibsə, daha böyük \`customer_id\`-ni götürün.

- **Sütunlar:** \`country_id\`, \`customer_id\`, \`signup_at\`
- **Sıralama:** \`country_id\` üzrə artan sıra ilə (NULL qrupu sonda).`,
      hints: ['`DISTINCT ON (country_id)` hər ölkə üçün bir sətir saxlayır.', 'Sətri `ORDER BY country_id, signup_at DESC, customer_id DESC` ilə seçin.'],
      explanation: `"Hər qrupda ən son sətir" ən çox rast gəlinən hesabat tapşırıqlarından biridir.

1. \`DISTINCT ON (country_id)\` hər unikal country_id üçün bir sətir qaytarır və NULL ayrıca qrup sayılır.
2. \`ORDER BY country_id, signup_at DESC, customer_id DESC\` hər qrupda ən yeni qeydiyyatı birinci sətir edir, saxlanılan da elə odur.
3. Yekun sıra country_id üzrədir. Artan sırada NULL sonda gəlir, bu da tələbə uyğundur.

Portativ alternativ \`ROW_NUMBER() OVER (PARTITION BY country_id ORDER BY signup_at DESC, customer_id DESC)\`-dir (17-ci mövzu).`,
      commonMistakes: ['signup_at-ı artan sıra ilə sıralamaq: bu, ən köhnə müştərini qaytarır.', 'signup_at-ı ORDER BY-dan çıxarmaq: onda saxlanılan sətir təsadüfi olur.'],
    },
  },
};

export default topic;
