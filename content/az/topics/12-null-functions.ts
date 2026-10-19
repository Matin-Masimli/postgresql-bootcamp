import type { TopicText } from '../../i18n.ts';

const explanation = `NULL **"naməlum / tətbiq olunmur"** deməkdir. O, sıfır deyil, boş sətir deyil, false deyil. NULL üzərində demək olar ki, hər əməliyyat NULL verir. Bu, riyazi cəhətdən düzgündür və daimi bug mənbəyidir. Bu mövzu onu emal etmək üçün alətləri toplayır.

## NULL necə davranır

| ifadə | nəticə |
|---|---|
| \`NULL = NULL\`, \`NULL <> 1\`, \`NULL > 0\` | NULL (naməlum) |
| \`NULL + 1\`, \`'a' || NULL\` | NULL |
| \`NULL AND false\` / \`NULL OR true\` | false / true (məlum tərəf qərar verir) |
| x = 2 olduqda \`x IN (1, NULL)\` | NULL |
| \`x NOT IN (1, NULL)\` | heç vaxt true deyil |
| \`count(col)\`, \`sum(col)\`, \`avg(col)\` | NULL-ları nəzərə almır. \`count(*)\` sətirləri sayır |
| \`ORDER BY col\` | NULL-lar artan sırada sonda, azalan sırada əvvəldə |
| \`DISTINCT\`, \`GROUP BY\`, \`UNION\` | bütün NULL-ları **bir** dəyər kimi qəbul edir |

\`WHERE\` yalnız şərtin **true** olduğu sətirləri saxlayır. Naməlum, eynilə false kimi, atılır.

## Yoxlama: IS NULL və IS DISTINCT FROM

\`\`\`sql
SELECT count(*) FILTER (WHERE email IS NULL)                     AS no_email,
       count(*) FILTER (WHERE email = NULL)                      AS always_zero,
       count(*) FILTER (WHERE city IS DISTINCT FROM 'Berlin')    AS not_berlin_incl_unknown,
       count(*) FILTER (WHERE city <> 'Berlin')                  AS not_berlin_known_only
FROM customers;
\`\`\`

\`a IS DISTINCT FROM b\` "NULL-ı adi dəyər kimi qəbul edərək bərabər deyil" deməkdir. \`IS NOT DISTINCT FROM\` isə NULL-a qarşı təhlükəsiz bərabərlikdir.

## COALESCE: ilk NULL olmayan dəyər

\`\`\`sql
SELECT customer_id,
       coalesce(phone, email, 'no contact') AS best_contact,
       coalesce(city, '(unknown)')          AS city
FROM customers
ORDER BY customer_id
LIMIT 8;
\`\`\`

\`coalesce(a, b, c)\` NULL olmayan ilk arqumenti, hamısı NULL-dursa NULL qaytarır. Bütün arqumentlərin tipləri uyğun olmalıdır: \`coalesce(weight_kg, 'n/a')\` uğursuz olur, \`coalesce(weight_kg::text, 'n/a')\` isə işləyir.

## NULLIF: dəyəri NULL-a çevirmək

\`nullif(a, b)\` a = b olduqda NULL, əks halda a qaytarır. İki klassik istifadə:

\`\`\`sql
SELECT nullif(trim('   '), '')          AS empty_becomes_null,
       100.0 / nullif(0, 0)             AS no_division_error,   -- xəta əvəzinə NULL
       coalesce(nullif('n/a', 'n/a'), 'unknown') AS cleaned;
\`\`\`

- "Saxta" dəyərləri ('', 'n/a', 0) çatışmayan kimi qəbul edin: \`nullif(trim(email), '')\`.
- Sıfıra bölmənin qarşısını alın: \`a / nullif(b, 0)\`.

## Birləşdirmə və NULL

city NULL olduqda \`first_name || ' ' || city\` NULL olur. \`concat(…)\` və \`concat_ws(sep, …)\` NULL-ları ötürür. Və ya istəyə bağlı hissəni əhatə edin: \`coalesce(' (' || city || ')', '')\`.

## Tələlər

- \`NOT (commission_pct > 0.05)\` "qalan hamı" **deyil**: komissiyası NULL olan sətirlər həm şərtlə, həm də onun inkarı ilə xaric edilir. NULL-ın nə demək olduğuna qərar verin və bunu açıq yazın (\`coalesce(commission_pct, 0) <= 0.05\`).
- \`WHERE col <> 'x'\` NULL sətirlərini səssizcə atır. Onlar nəticəyə aiddirsə, \`IS DISTINCT FROM\` işlədin.
- Join-lərdə \`IS NOT DISTINCT FROM\` NULL-ı NULL ilə uyğunlaşdırır. Adətən istədiyiniz bu **deyil** (iki naməlum telefon nömrəsi eyni telefon deyil).
- Unique məhdudiyyətləri çoxlu NULL-a icazə verir (2-ci mövzu). CHECK məhdudiyyətləri NULL-ı buraxır.`;

const topic: TopicText = {
  explanation,
  questions: {
    't12-q01': {
      title: 'NULL ilə dörd görüş',
      prompt: `İşə salmadan bu sorğunun qaytardığı tək sətri təxmin edin.`,
      hints: [
        'Hər hansı bir şeyi NULL ilə `=` vasitəsilə müqayisə etmək "naməlum", yəni NULL verir, TRUE və ya FALSE yox.',
        '`COALESCE` NULL olmayan ilk arqumentini qaytarır. `NULLIF(x, y)` x = y olduqda NULL, əks halda x qaytarır.',
      ],
      explanation: `- **a = NULL:** \`NULL = NULL\` "naməlum dəyər başqa naməlum dəyərə bərabərdirmi?" deyə soruşur. Cavab naməlumdur, ona görə də nəticə TRUE yox, NULL-dur. Məhz buna görə \`IS NULL\` lazımdır.
- **b = true:** \`IS NULL\` xüsusi yoxlamadır və həmişə TRUE və ya FALSE qaytarır.
- **c = 1:** \`COALESCE(NULL, 0)\` NULL-ı ötürüb 0 qaytarır, 0 + 1 = 1. (COALESCE olmadan \`NULL + 1\` NULL olardı.)
- **d = NULL:** \`NULLIF(5, 5)\` hər iki arqument bərabər olduğu üçün NULL qaytarır. O, tez-tez dəyəri NULL-a çevirmək üçün işlədilir, məsələn, sıfıra bölmənin qarşısını almaq üçün \`x / NULLIF(y, 0)\`.`,
      commonMistakes: [
        '`NULL = NULL`-ın TRUE olacağını gözləmək. NULL ilə bərabərlik həmişə NULL-dur ("naməlum").',
        'İlk arqumenti NULL olduqda COALESCE-in NULL qaytardığını düşünmək. O, növbəti arqumentə keçir.',
        'NULLIF ilə COALESCE-i qarışdırmaq. NULLIF NULL yaradır, COALESCE isə onları əvəz edir.',
      ],
    },
    't12-q02': {
      title: 'Telefon və ya əvəzedici',
      prompt: `**1-dən 20-yə qədər** müştərilər üçün telefon nömrəsini, yoxdursa **\`'n/a'\`** göstərin.

- **Sütunlar:** \`customer_id\`, \`phone\`
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: [`\`coalesce(phone, 'n/a')\``],
      explanation: `\`coalesce(phone, 'n/a')\` telefon varsa onu, əks halda növbəti arqumenti qaytarır. Hər müştəri siyahıda qalır. Çatışmayan telefonları filtrləmək başqa suala cavab verir.`,
      commonMistakes: ['NULL sətirlərin dəyərini əvəz etmək yerinə onları filtrləmək.'],
    },
    't12-q03': {
      title: 'Bir neçə arqumentli COALESCE',
      prompt: `\`coalesce(NULL, NULL, 3, 4)\` nə qaytarır?`,
      hints: ['O, NULL olmayan *ilk* arqumenti qaytarır.'],
      explanation: `COALESCE soldan sağa baxır və NULL olmayan **ilk** arqumenti qaytarır: 3. O, orada dayanır, sonrakı arqumentlər hətta hesablanmır.`,
      commonMistakes: ['COALESCE-in topladığını və ya son dəyəri qaytardığını düşünmək.'],
      options: ['NULL', '3', '4', '7'],
    },
    't12-q04': {
      title: 'Natamam ünvanlar',
      prompt: `**Şəhəri və ya ölkəsi naməlum** olan müştəriləri sadalayın.

- **Sütunlar:** \`customer_id\`, \`city\`, \`country_id\`
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: ['OR ilə birləşdirilmiş iki IS NULL yoxlaması.'],
      explanation: `\`IS NULL\` çatışmayan dəyərləri yoxlamağın yeganə yoludur: \`= NULL\` heç vaxt true olmur. "Şəhər **və ya** ölkə naməlumdur" OR-dur. AND hər ikisinin çatışmamasını tələb edərdi.`,
      commonMistakes: ['= NULL işlətmək.', 'OR əvəzinə AND.'],
    },
    't12-q05': {
      title: 'Müştəriyə çatmağın ən yaxşı yolu',
      prompt: `**1-dən 40-a qədər** müştərilər üçün ən yaxşı əlaqəni göstərin: varsa **e-poçt**, yoxdursa **telefon**, o da yoxdursa **\`'no contact'\`**.

- **Sütunlar:** \`customer_id\`, \`contact\`
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: ['COALESCE ikidən çox arqument qəbul edir.'],
      explanation: `COALESCE **ehtiyat zənciri** həyata keçirir: arqumentlər soldan sağa yoxlanılır, ona görə də onların sırası prioriteti ifadə edir. E-poçt ilə telefonun yerini dəyişmək hər ikisi olan hər kəs üçün nəticəni dəyişir.`,
      commonMistakes: ['Yanlış prioritet sırası.', 'Ehtiyat variantı buraxmaq.'],
    },
    't12-q06': {
      title: 'Saxta dəyərlər çatışmayan dəyərlərdir',
      prompt: `\`staging_customer_import\`-da çatışmayan e-poçtlar NULL, boş sətir və ya \`'n/a'\` kimi görünür. **Hər sətir** üçün trim edilmiş e-poçtu göstərin, **"çatışmayan"ın hər üç növü \`'unknown'\` kimi göstərilsin**.

- **Sütunlar:** \`import_row_id\`, \`email\`
- **Sıralama:** \`import_row_id\` üzrə.`,
      hints: [`\`nullif(x, '')\` '' dəyərini NULL-a çevirir, iç-içə yerləşdirmə isə 'n/a'-nı da emal edir.`, `Sonra \`coalesce(…, 'unknown')\`.`],
      explanation: `COALESCE yalnız həqiqi NULL-ları əvəz edir. NULLIF əvvəlcə əvəzedici dəyərləri NULL-a çevirir, sonra COALESCE hər üçünü eyni şəkildə əvəz edir. İç-içə NULLIF bir neçə əvəzedicini emal edir.

Bu "əvvəl nullif, sonra coalesce" pattern-i əvəzedici dəyərləri təmizləməyin standart yoludur.`,
      commonMistakes: ['Təkcə COALESCE, bu da \'\' və \'n/a\'-nı saxlayır.', 'Yalnız bir əvəzedicini emal etmək.'],
    },
    't12-q07': {
      title: 'Ölkənin standartından fərqli saat qurşağı',
      prompt: `\`timezone\`-u **ölkələrinin \`default_timezone\`-undan fərqli** olan müştəriləri tapın, burada **çatışmayan saat qurşağı fərqli sayılır**. Ölkəsi olmayan müştərilər nəzərə alınmır.

- **Sütunlar:** \`customer_id\`, \`timezone\`, \`default_timezone\`
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: ['customers-i countries ilə join edin.', '`<>` timezone NULL olan sətirləri atır. NULL-a qarşı təhlükəsiz müqayisə işlədin.'],
      explanation: `NULL timezone üçün \`timezone <> default_timezone\` naməlumdur, ona görə də həmin müştərilər yox olur. \`IS DISTINCT FROM\` NULL ilə 'Europe/Berlin'-i fərqli sayır. Çatışmayan saat qurşağını standartla əvəz etmək (\`coalesce(timezone, default)\`) istənilənin əksini edir: "çatışmayan"ı "eyni" sayır. Inner join, istənildiyi kimi, ölkəsi olmayan müştəriləri xaric edir.

ABŞ və Kanada müştəriləri tez-tez öz ölkələrinin başqa qurşağını işlədirlər. Bu, tamamilə düzgündür, amma "fərqli"dir.`,
      commonMistakes: ['NULL saat qurşaqlarını itirən <>.', 'Çatışmayan saat qurşağını coalesce ilə standarta çevirmək, bu da çatışmayanı bərabər sayır.'],
    },
    't12-q08': {
      title: 'NULL-larla saymaq',
      prompt: `Bu sorğu nə qaytarır?`,
      hints: ['count(*) sətirləri sayır. count(x) NULL olmayan dəyərləri sayır. Aqreqatlar NULL-ları ötürür.'],
      explanation: `- \`count(*)\` **sətirləri** sayır: 4.
- \`count(x)\` **NULL olmayan dəyərləri** sayır: 3.
- \`count(DISTINCT x)\` fərqli NULL olmayan dəyərləri sayır: {1, 2} = 2.
- \`sum(x)\` NULL-ı nəzərə almır: 1 + 1 + 2 = **4**, NULL yox. (O, yalnız *bütün* dəyərlər NULL olduqda NULL olur.)`,
      commonMistakes: ['Bir dəyər NULL olduğu üçün sum-ın NULL olacağını gözləmək.', 'NULL-ı fərqli dəyər kimi saymaq.'],
    },
    't12-q09': {
      title: 'Düzəlt: yox olan adlar',
      prompt: `Bu sorğu **1-dən 30-a qədər** müştərilər üçün \`'Anna Kim (Berlin)'\` kimi etiket göstərməlidir. Şəhəri olmayan müştərilər üçün boş mötərizəsiz, sadəcə \`'Anna Kim'\` göstərməlidir. Hazırda həmin müştərilər NULL alır. Düzəldin.

- **Sütunlar:** \`customer_id\`, \`label\`
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: ['NULL ilə `||` NULL verir. city NULL olduqda istəyə bağlı hissə yox olsun.', `\`coalesce(' (' || city || ')', '')\``],
      explanation: `\`' (' || city || ')'\`-da NULL city **bütün istəyə bağlı hissəni** NULL edir, bu da məhz istədiyimizdir. Həmin hissəni \`coalesce(…, '')\` ilə əhatə etmək onu boş sətirlə əvəz edir və ad salamat qalır.

\`concat()\` NULL-ları ötürür, amma literal mötərizələri yenə də əlavə edir və 'Anna Kim ()' verir. \`coalesce(city, '')\` da eyni şeyi edir.`,
      commonMistakes: ['Boş mötərizələrlə qalmaq.'],
    },
    't12-q10': {
      title: 'Əvvəlcə naməlum maya dəyərləri',
      prompt: `**Ən aşağı maya dəyəri olan 15 məhsulu** göstərin, amma **maya dəyəri naməlum** olan məhsulları **birinci** sadalayın (onlara diqqət lazımdır). Bərabərlikdə \`product_id\` üzrə.

- **Sütunlar:** \`product_id\`, \`cost\`
- **Sıralama:** əvvəlcə naməlum maya dəyərləri, sonra cost artan, sonra \`product_id\`. 15 sətir.`,
      hints: ['Artan sırada NULL-lar standart olaraq sonda gəlir. Bunu `NULLS FIRST` ilə dəyişin.'],
      explanation: `\`NULLS FIRST\` naməlum maya dəyərlərini hər məlum dəyərdən əvvəl qoyur. Alternativ əvvəlcə \`cost IS NOT NULL\` boolean-ı üzrə sıralayır (false < true).

Boolean hiyləsinin istiqamətinə diqqət edin: \`cost IS NULL\` naməlum maya dəyərləri üçün *true*-dur, true isə false-dan **sonra** sıralanır və onları sona göndərir. NULL-ı 0 ilə əvəz etmək (\`coalesce(cost, 0)\`) bu verilənlərdə təsadüfən işləyir, amma naməlum maya dəyərlərini istənilən həqiqi sıfır maya dəyəri ilə qarışdırardı.`,
      commonMistakes: ['Standarta güvənmək (artan sırada NULL-lar sonda).', '`cost IS NULL` üzrə sıralamaq (true sonda gəlir).', 'coalesce(cost, 0)-ı saxta dəyər kimi işlətmək.'],
    },
    't12-q11': {
      title: 'Təchizatçı və ölkə ilə məhsullar, standart dəyərlər daxil',
      prompt: `Hər məhsulu təchizatçısının adı və təchizatçının ölkə adı ilə sadalayın. **Təchizatçı yoxdursa**, **\`'(no supplier)'\`** və **\`'(unknown)'\`** göstərin.

- **Sütunlar:** \`product_id\`, \`supplier\`, \`supplier_country\`
- **Sıralama:** \`product_id\` üzrə.`,
      hints: ['İki LEFT JOIN: products → suppliers → countries.', 'COALESCE-i istəyə bağlı tərəfdən gələn sütunlara tətbiq edin.'],
      explanation: `Outer join-lər NULL yaradır, COALESCE isə onları oxunaqlı standart dəyərlərə çevirir. Hər iki join LEFT olmalıdır: inner join təchizatçısız məhsulları COALESCE onları görməmişdən əvvəl silir.`,
      commonMistakes: ['Inner join-lər.', 'NULL-ları saxlamaq.'],
    },
    't12-q12': {
      title: 'İmportları telefon üzrə müştərilərlə uyğunlaşdırmaq',
      prompt: `\`staging_customer_import\` sətirlərini \`customers\` ilə **eyni telefon nömrəsi** üzrə (dəqiq mətn) uyğunlaşdırın. Telefonu **olmayan** sətirlər heç nə ilə uyğunlaşmamalıdır.

- **Sütunlar:** \`import_row_id\`, \`customer_id\`
- **Sıralama:** \`import_row_id\` üzrə, sonra \`customer_id\`.`,
      hints: ['Adi `=` join heç vaxt NULL-ı NULL ilə uyğunlaşdırmır və burada məhz istədiyiniz budur.', 'Çoxlu NULL telefonlarla `IS NOT DISTINCT FROM` nə edərdi?'],
      explanation: `İki naməlum telefon nömrəsi "eyni telefon" deyil. Adi bərabərlik join-i bunu avtomatik düzgün edir, çünki \`NULL = NULL\` true deyil.

\`IS NOT DISTINCT FROM\` (və \`coalesce(x, '') = coalesce(y, '')\`) NULL-ı NULL-a bərabər edir və telefonsuz **hər** import sətrini telefonsuz **hər** müştəri ilə cütləşdirir: böyük, mənasız cross product. NULL-a qarşı təhlükəsiz bərabərliyi yalnız NULL həqiqətən "eyni naməlum dəyər" demək olduqda işlədin.`,
      commonMistakes: ['İstəyə bağlı verilənlər üzrə join-də NULL-a qarşı təhlükəsiz bərabərlik.'],
    },
    't12-q13': {
      title: 'Ən çox 5% komissiya',
      prompt: `Komissiyası **5%-dən yuxarı olmayan** **aktiv Sales işçilərini** (\`department_id = 2\`, \`termination_date IS NULL\`) sadalayın. Komissiyası **olmayan** işçilər 0% sayılır, ona görə də onlar siyahıya daxildir.

- **Sütunlar:** \`employee_id\`, \`commission_pct\`
- **Sıralama:** \`employee_id\` üzrə.`,
      hints: ['commission_pct NULL olduqda `NOT (commission_pct > 0.05)` naməlumdur.', 'Qaydanı açıq yazın: `coalesce(commission_pct, 0) <= 0.05`.'],
      explanation: `\`NOT (x > 0.05)\` "qalan hamı" kimi görünür, amma NULL üçün NOT(naməlum) = naməlumdur, ona görə də həmin sətirlər atılır. NULL-ın nə demək olduğuna qərar verin (burada: 0%) və bunu deyin: \`coalesce(commission_pct, 0) <= 0.05\` və ya \`OR commission_pct IS NULL\` əlavə edin.

"5%-dən yuxarı olmayan" düz 5%-i daxil edir: \`<=\`.`,
      commonMistakes: ['NOT-un NULL sətirləri daxil edəcəyini gözləmək.', 'Düz 5%-i xaric etmək.'],
    },
    't12-q14': {
      title: 'IN, NOT IN və NULL',
      prompt: `Bu sorğu nə qaytarır?`,
      hints: ['`x IN (a, b)` = `x = a OR x = b`. `x NOT IN (a, b)` = `x <> a AND x <> b`.'],
      explanation: `- **a:** \`1 = 1 OR 1 = NULL\` → true OR naməlum → **true**.
- **b:** \`2 = 1 OR 2 = NULL\` → false OR naməlum → **NULL**.
- **c:** \`2 <> 1 AND 2 <> NULL\` → true AND naməlum → **NULL**. Siyahıda NULL olan NOT IN heç vaxt true ola bilməz.
- **d:** iki NULL *fərqli deyil* → **false**.`,
      commonMistakes: ['Dəyər siyahıda olmadıqda NOT IN-in true olacağını gözləmək.'],
    },
    't12-q15': {
      title: 'Hər müştəri üçün normallaşdırılmış əlaqə',
      prompt: `**Hər müştəri** üçün tək əlaqə dəyəri qurun: e-poçt varsa və boş deyilsə, **kiçik hərflərlə və trim edilmiş** e-poçt; əks halda, boş deyilsə, **yalnız rəqəmlərə endirilmiş** telefon nömrəsi (\`regexp_replace(phone, '\\D', '', 'g')\`); əks halda NULL.

- **Sütunlar:** \`customer_id\`, \`contact\`
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: [`Hər namizəd: onu normallaşdırın, sonra boş nəticə çatışmayan sayılsın deyə \`nullif(…, '')\`.`, 'Namizədləri prioritet sırası ilə COALESCE vasitəsilə birləşdirin.'],
      explanation: `Etibarlı ehtiyat zənciri **əvvəlcə hər namizədi** normallaşdırır, sonra "təmizlənəndən sonra boş"u \`nullif(…, '')\` ilə NULL-a çevirir və yalnız bundan sonra COALESCE-ə seçim etməyə icazə verir. NULLIF-lər olmadan təmizlənəndən sonra boş qalan dəyər həqiqi telefon nömrəsini üstələyərdi.

Sıra vacibdir: göstərildiyi kimi, əvvəlcə e-poçt.`,
      commonMistakes: ['Telefonu normallaşdırmamaq.', 'Yanlış prioritet.'],
    },
    't12-q16': {
      title: 'Eskalasiya əlaqəsi',
      prompt: `Hər işçiyə **eskalasiya e-poçtu** lazımdır: **menecerinin** e-poçtu; meneceri yoxdursa və ya menecer **işdən çıxıbsa** (\`termination_date\` NULL deyil), **öz departamentinin VP-si** (eyni departamentdə \`job_title\`-ı \`'VP of'\` ilə başlayan işçi); o da yoxdursa, **CEO-nun** e-poçtu (meneceri olmayan işçi).

- **Sütunlar:** \`employee_id\`, \`escalation_email\`
- **Sıralama:** \`employee_id\` üzrə.`,
      hints: ['Meneceri LEFT JOIN edin, amma yalnız hələ aktivdirsə: bu şərti ON-a qoyun.', `Departamentin VP-sini LEFT JOIN edin: \`vp.department_id = e.department_id AND vp.job_title LIKE 'VP of%'\`.`, 'CEO-nu `ceo.manager_id IS NULL` ilə join edin, sonra üç e-poçtu COALESCE edin.'],
      explanation: `Hər ehtiyat variant LEFT JOIN ilə birləşdirilmiş istəyə bağlı sətirdir, COALESCE isə mövcud olan birincisini seçir:

1. **Menecer, hələ aktivdirsə:** aktivlik şərti **ON** bəndinə gedir. Əks halda işdən çıxmış menecer yenə də "tapılardı" və onun e-poçtu işlədilərdi.
2. **Departamentin VP-si:** departament və vəzifə üzrə ikinci self-join. Departamenti olmayan işçilər və VP-lərin öz departamentləri (özləri ilə uyğunlaşan) təbii şəkildə emal olunur.
3. **CEO:** son çarə kimi hər işçi ilə cross join edilmiş bir sətirlik subquery.

Meneceri 2024-də işdən çıxmış komanda burada düzgünü səhvdən ayıran haldır.`,
      commonMistakes: ['Menecerin işdən çıxa biləcəyini nəzərə almamaq.', 'VP səviyyəsini buraxmaq.'],
    },
  },
};

export default topic;
