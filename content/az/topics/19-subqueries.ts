import type { TopicText } from '../../i18n.ts';

const explanation = `**Subquery** başqa bir əmrin içində, mötərizədə olan SELECT-dir. O, bir sorğuya başqasının cavabını işlətməyə imkan verir: "*orta* haqdan yuxarı sifarişlər", "2025 sifarişlərində *mövcud olan* müştərilər".

## Subquery-lər hara gedir

| növ | qaytarır | necə işlədilir |
|---|---|---|
| **scalar** | bir sətir, bir sütun | dəyər kimi: \`WHERE price > (SELECT avg(price) FROM products)\` |
| **row** | bir sətir, bir neçə sütun | \`WHERE (a, b) = (SELECT x, y …)\` |
| **table / derived table** | istənilən sətirlər | \`FROM (SELECT …) AS t\` (alias tələb olunur), \`IN (SELECT …)\` |
| **EXISTS** | true/false | \`WHERE EXISTS (SELECT 1 FROM … WHERE …)\` |

**Heç bir sətir** qaytarmayan scalar subquery NULL verir. **Birdən çox sətir** qaytaran isə xətadır (*more than one row returned by a subquery used as an expression*).

\`\`\`sql
SELECT product_id, name, price
FROM products
WHERE price > (SELECT avg(price) FROM products)
ORDER BY price DESC
LIMIT 5;
\`\`\`

## Korrelyasiyalı (correlated) subquery-lər

Subquery **xarici sətrə** istinad edə bilər. Onda o, (məntiqi olaraq) hər xarici sətir üçün bir dəfə hesablanır:

\`\`\`sql
-- Qiyməti öz kateqoriyasının ortasından yuxarı olan məhsullar
SELECT p.product_id, p.category_id, p.price
FROM products p
WHERE p.price > (SELECT avg(p2.price)
                 FROM products p2
                 WHERE p2.category_id = p.category_id)
ORDER BY p.category_id, p.product_id
LIMIT 8;
\`\`\`

Planlayıcı onları tez-tez join-lərə çevirir, amma onları "hər sətir üçün bu sualı ver" kimi düşünün.

## IN, EXISTS və NOT IN tələsi

- \`x IN (SELECT …)\`: x qaytarılan hər hansı dəyərə bərabərdirsə, true.
- \`EXISTS (SELECT …)\`: subquery ən azı bir sətir qaytarırsa, true. Seçim siyahısının əhəmiyyəti yoxdur (\`SELECT 1\` adətdir).
- Siyahıda NULL olan \`NOT IN\` **heç vaxt true deyil**: \`3 NOT IN (1, NULL)\` \`3 <> 1 AND 3 <> NULL\` deməkdir, bu da naməlumdur. Ona görə də tək bir NULL NOT IN-in heç bir sətir qaytarmamasına səbəb olur. \`NOT EXISTS\`-də bu problem yoxdur, ona görə də ona üstünlük verin.

\`\`\`sql
SELECT 3 NOT IN (1, 2)    AS without_null,
       3 NOT IN (1, NULL) AS with_null;
\`\`\`

## ANY / SOME və ALL

\`x > ANY (subquery)\`: ən azı bir dəyərdən böyük. \`x > ALL (subquery)\`: hər dəyərdən böyük. \`= ANY\` IN ilə, \`<> ALL\` isə NOT IN ilə eynidir (NULL tələsi daxil olmaqla). **Boş** subquery üzərində ALL true, ANY isə false-dur.

## Subquery-lər, join-lər və window-lar

- Digər cədvəldən sütunlar lazım olduqda **join** düzgündür. Yalnız mövcudluğu *yoxlamaq* lazım olduqda join sətirləri çoxalda bilər (hər uyğunluq üçün bir), EXISTS/IN isə yox.
- Qrup üzrə müqayisələr ("kateqoriyamın ortasından yuxarı") korrelyasiyalı subquery, qruplaşdırılmış derived table ilə join və ya window function (15-ci mövzu) kimi yazıla bilər. Böyük verilənlərdə derived table və window formaları adətən daha sürətlidir.
- **Window function və ya aqreqatın aqreqatı** üzrə filtrləmək üçün sorğunu derived table-a bükün və xaricdə filtrləyin, bunu 15-ci mövzudan bəri edirsiniz.`;

const topic: TopicText = {
  explanation,
  questions: {
    't19-q01': {
      title: 'Ortadan yuxarı çatdırılma haqqı',
      prompt: `**2025-ci ilin iyununda** verilmiş, çatdırılma haqqı **bütün sifarişlərin** (bütün dövrlər) **orta çatdırılma haqqından yüksək** olan sifarişləri sadalayın.

- **Sütunlar:** \`order_id\`, \`shipping_fee\`
- **Sıralama:** \`order_id\` üzrə.`,
      hints: ['Scalar subquery: `(SELECT avg(shipping_fee) FROM orders)`.'],
      explanation: `\`WHERE shipping_fee > avg(shipping_fee)\` yaza bilməzsiniz, çünki WHERE-də aqreqatlara icazə verilmir. Scalar subquery əvvəlcə ortanı hesablayır, xarici sorğu isə hər sətri onunla müqayisə edir.

Subquery-nin öz FROM və WHERE-i var: burada o, xarici iyun filtrindən asılı olmayaraq **bütün** sifarişlərin ortasını alır. Yalnız sıfırdan fərqli haqqı olan sifarişlərin ortasını almaq həddi qaldırır və başqa suala cavab verir.`,
      commonMistakes: ['Subquery-yə tapşırığın istəmədiyi filtrlər əlavə etmək.', 'avg()-ı birbaşa WHERE-də işlətməyə çalışmaq.'],
    },
    't19-q02': {
      title: 'Çoxlu sətirli scalar subquery',
      prompt: `Bunu işə saldıqda nə baş verir?

\`\`\`sql
SELECT name, (SELECT price FROM products p WHERE p.category_id = c.category_id) AS price
FROM categories c;
\`\`\``,
      hints: ['Dəyər kimi işlədilən subquery tək dəyər yaratmalıdır.'],
      explanation: `SELECT siyahısındakı subquery **scalar** subquery-dir: ən çox bir sətir, bir sütun. Sıfır sətir NULL verir, iki və ya daha çox isə *more than one row returned by a subquery used as an expression* xətasına səbəb olur. Onun içində aqreqasiya edin (\`SELECT max(price) …\`) və ya həqiqətən hər məhsul üçün bir sətir istəyirsinizsə, join işlədin.`,
      commonMistakes: ['PostgreSQL-in səssizcə bir sətir seçəcəyini gözləmək.'],
      options: [
        'Hər məhsul üçün bir sətir qaytarır',
        'Hər kateqoriya üçün ilk məhsulun qiymətini qaytarır',
        'Kateqoriyada birdən çox məhsul olan kimi uğursuz olur: scalar subquery ən çox bir sətir qaytara bilər',
        'Bir neçə məhsulu olan kateqoriyalar üçün NULL qaytarır',
      ],
    },
    't19-q03': {
      title: 'Noutbuk almış müştərilər',
      prompt: `**Nə vaxtsa \`laptops\` kateqoriyasından məhsul sifariş etmiş** müştəriləri sadalayın (kateqoriya slug-u \`'laptops'\`, istənilən sifariş statusu). Hər müştəri bir dəfə.

- **Sütunlar:** \`customer_id\`, \`first_name\`, \`last_name\`
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: [`\`WHERE customer_id IN (SELECT o.customer_id FROM orders o JOIN order_items … JOIN products … JOIN categories … WHERE slug = 'laptops')\``],
      explanation: `\`IN (subquery)\` yalnız **üzvlüyü yoxlayır**: müştəri neçə noutbuk alsa da, bir dəfə görünür. Adi join hər uyğun sifariş sətri üçün bir sətir qaytarır, ona görə də təkrar alıcılar bir neçə dəfə görünür. \`DISTINCT\` bunu düzəldir, amma IN/EXISTS nə demək istədiyinizi deyir.`,
      commonMistakes: ['Təkrar alıcıları dublikat edən DISTINCT-siz join.'],
    },
    't19-q04': {
      title: 'Uyğunluğu olmayan korrelyasiyalı axtarış',
      prompt: `Bu sorğu nə qaytarır?`,
      hints: ['Heç bir sətir qaytarmayan scalar subquery-nin dəyəri nədir?'],
      explanation: `Subquery korrelyasiyalıdır (\`v.k = t.x\`), ona görə də hər xarici sətir üçün bir dəfə işləyir. x = 3 üçün heç bir sətir tapmır, sətirsiz scalar subquery isə **NULL**-dur. Xarici sətir silinmir: inner join-dən fərq budur.`,
      commonMistakes: ['Xarici sətrin inner join-də olduğu kimi yox olacağını gözləmək.'],
    },
    't19-q05': {
      title: 'Öz kateqoriyalarının ortasından yuxarı',
      prompt: `Qiyməti **öz kateqoriyasındakı satışda olan məhsulların orta qiymətindən yüksək** olan **satışda olan** məhsulları sadalayın.

- **Sütunlar:** \`product_id\`, \`category_id\`, \`price\`
- **Sıralama:** \`category_id\` üzrə, sonra \`price\` (ən yüksək birinci), sonra \`product_id\`.`,
      hints: ['Korrelyasiyalı subquery: `price > (SELECT avg(p2.price) FROM products p2 WHERE p2.category_id = p.category_id AND …)`.', 'Həm xarici sorğu, həm də subquery satışda olma filtrini tələb edir.'],
      explanation: `\`p2.category_id = p.category_id\` subquery-ni xarici sətrə bağlayır: "**bu məhsulun** kateqoriyasının ortası". Onsuz ümumi orta ilə müqayisə edirsiniz.

Subquery ayrı sorğudur, ona görə də xarici \`discontinued_at IS NULL\` onun içində tətbiq olunmur. Onu subquery-dən buraxsanız, satışdan çıxarılmış məhsullar hər kateqoriyanın ortasını təhrif edir. Join və window alternativləri hər kateqoriya ortasını hər sətir üçün yox, bir dəfə hesablayır.`,
      commonMistakes: ['Korrelyasiyasız subquery (ümumi orta).', 'Subquery daxilində satışda olma filtrini unutmaq.'],
    },
    't19-q06': {
      title: '2024-də və 2025-də sifariş verib',
      prompt: `**Çili**dən (\`country_id = 6\`) olan hansı müştərilər **2024-də və** **2025-də** ən azı bir sifariş (istənilən status) verib?

- **Sütunlar:** \`customer_id\`, \`first_name\`, \`last_name\`
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: ['AND ilə birləşdirilmiş iki EXISTS şərti, hər il üçün bir.'],
      explanation: `"2024-də sifariş **və** 2025-də sifariş" iki *fərqli* sifariş haqqındadır, ona görə də iki müstəqil yoxlama tələb edir. Hər iki tarix şərti olan tək EXISTS hər iki ildə olan bir sifariş istəyir (mümkün deyil, ona görə də heç bir sətir yoxdur), 2024–2025 üzərində tək EXISTS isə istənilən ili qəbul edir.

İki ilin müştəri siyahılarının INTERSECT-i (7-ci mövzu) eyni fikri ifadə edir.`,
      commonMistakes: ['Hər iki şərt eyni sifariş sətrində.', 'Hər iki ili əhatə edən bir aralıq (OR semantikası).'],
    },
    't19-q07': {
      title: 'Düzəlt: NOT IN heç nə qaytarmır',
      prompt: `Bu sorğu **Çili**dən (\`country_id = 6\`) olan, **heç kimi tövsiyə etməmiş** (heç bir müştərinin \`referred_by\`-ı onlar deyil) müştəriləri sadalamalıdır. O, ümumiyyətlə heç bir sətir qaytarmır. Düzəldin.

- **Sütunlar:** \`customer_id\`
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: ['Müştərilərin çoxu tövsiyə ilə gəlməyib: onlar üçün `referred_by` NULL-dur.', '`5 NOT IN (1, 2, NULL)` nədir?'],
      explanation: `\`x NOT IN (list)\` x-in **hər** elementdən fərqli olması deməkdir. Siyahıda NULL varsa, "x <> NULL" naməlumdur, ona görə də bütün şərt heç vaxt true ola bilməz və hər sətir filtrlənir.

- \`NOT EXISTS\` yalnız uyğun sətrin mövcud olub-olmadığını soruşur, ona görə də NULL-ların əhəmiyyəti yoxdur. Bu, etibarlı seçimdir.
- NULL-ları subquery-dən silmək (\`WHERE referred_by IS NOT NULL\`) də NOT IN-i düzəldir.

Korrelyasiyanın istiqamətinə diqqət edin: \`r.customer_id = c.referred_by\` "*c* kimsə tərəfindən tövsiyə edilibmi?" soruşur, "*c* kimisə tövsiyə edibmi?" yox.`,
      commonMistakes: ['NULL-lar ehtiva edən sütun üzərində NOT IN.', 'Korrelyasiyanı tərsinə çevirmək.'],
    },
    't19-q08': {
      title: 'Hər planşetdən bahalı',
      prompt: `\`tablets\` kateqoriyasındakı (slug \`'tablets'\`) **hər məhsuldan** (satışda olan və ya olmayan) bahalı olan **satışda olan** məhsulları sadalayın.

- **Sütunlar:** \`product_id\`, \`name\`, \`price\`
- **Sıralama:** \`price\` üzrə (ən yüksək birinci), sonra \`product_id\`.`,
      hints: [`\`price > ALL (SELECT price FROM products WHERE category_id = (SELECT category_id FROM categories WHERE slug = 'tablets'))\``],
      explanation: `\`> ALL (…)\` hər dəyəri üstələməlidir, bu da maksimumu üstələməyə ekvivalentdir. \`> ANY (…)\` isə yalnız onlardan birini (yəni minimumu) üstələməlidir.

Subquery tapşırıqda deyildiyi kimi, satışdan çıxarılanlar daxil olmaqla bütün planşetləri qaytarır. ALL ilə yadda saxlayın: siyahıdakı NULL müqayisəni naməlum edir, boş siyahı isə onu hər kəs üçün true edir.`,
      commonMistakes: ['ALL əvəzinə ANY.', 'Siyahıdakı NULL-ın > ALL-u naməlum etdiyini unutmaq.'],
    },
    't19-q09': {
      title: 'Scalar subquery-lərlə departament göstəriciləri',
      prompt: `**Hər** departament üçün onun **aktiv** işçilərinin sayını və orta maaşını (2 onluq rəqəm) göstərin. Aktiv işçisi olmayan departamentlər 0 və NULL göstərir.

- **Sütunlar:** \`department_id\`, \`name\`, \`active_staff\`, \`avg_salary\`
- **Sıralama:** \`department_id\` üzrə.`,
      hints: ['SELECT siyahısında iki korrelyasiyalı scalar subquery, hər biri `e.department_id = d.department_id` ilə filtrlənmiş.', 'Və ya aktivlik filtrinin hara getdiyinə diqqət etməklə GROUP BY ilə LEFT JOIN.'],
      explanation: `SELECT siyahısındakı scalar subquery-lər **hər** xarici sətri saxlayır: heç bir sətir üzərində \`count(*)\` 0, \`avg\` isə NULL-dur. Bu, boş departamentə 0-ı pulsuz verir.

Join versiyası aktivlik filtri ON bəndində olan LEFT JOIN (WHERE-də o, boş departamenti yenidən silərdi) və NULL ilə genişləndirilmiş sətri 1 kimi sayacaq \`count(*)\` əvəzinə \`count(e.employee_id)\` tələb edir.`,
      commonMistakes: ['Boş departamenti atan inner join.', 'LEFT JOIN-dən sonra 0 əvəzinə 1 verən count(*).'],
    },
    't19-q10': {
      title: 'NULL ilə IN və NOT IN',
      prompt: `Bu sorğu nə qaytarır?`,
      hints: ['`2 IN (1, NULL)` = `2 = 1 OR 2 = NULL`.'],
      explanation: `x = 1 üçün uyğunluq tapılır, ona görə də siyahıda başqa nə olursa olsun, IN true, NOT IN isə false-dur. x = 2 üçün: \`2 = 1 OR 2 = NULL\` \`false OR unknown\` = **naməlum** (NULL)-dur, NOT IN isə naməlumun inkarıdır, yenə NULL. WHERE bəndində NULL "true deyil" sayılır, ona görə də \`NOT IN\` heç bir sətri saxlamazdı.`,
      commonMistakes: ['NOT IN-in 2 üçün true olacağını gözləmək.'],
    },
    't19-q11': {
      title: 'Keçən ildən çox xərcləyənlər',
      prompt: `**2025-in birinci yarısındakı** xərci (ləğv edilməmiş sifarişlər, sətir dəyərləri, çatdırılmasız) **2024-ün birinci yarısındakından** yüksək olan müştəriləri tapın. 2024-ün birinci yarısında xərci olmayan müştərilər daxil **edilmir**.

- **Sütunlar:** \`customer_id\`, \`h1_2024\`, \`h1_2025\` (2 onluq rəqəm)
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: ['Hər müştəri üçün bir sətir və iki şərti cəmi (`sum(…) FILTER (WHERE …)`) olan derived table.', 'Heç bir sətir üzərində cəm NULL-dur, `x > NULL` isə naməlumdur, bu da həmin müştəriləri avtomatik xaric edir.'],
      explanation: `Aqreqatlar WHERE-də müqayisə edilə bilməz və burada onlardan ikisini təkrarlamadan HAVING ilə müqayisə edə bilməzsiniz. **Derived table** hər müştəri üzrə hər iki göstəricini hesablayır, xarici WHERE isə onları müqayisə edir.

NULL burada həqiqi iş görür: 2024-ün birinci yarısında sifarişi olmayan müştərinin \`h1_2024\`-ü NULL-dur, müqayisə naməlumdur və tapşırıqda deyildiyi kimi sətir xaric edilir. 0-a coalesce etmək hər yeni müştərini əlavə edərdi. Korrelyasiyalı subquery alternativi eyni nəticəni verir, amma hər müştəri üçün iki subquery işə salır.`,
      commonMistakes: ['Yeni müştəriləri artım kimi sayan coalesce(…, 0).', '2025-in birinci yarısını bütün 2024 ilə müqayisə etmək.'],
    },
    't19-q12': {
      title: 'Row subquery ilə ən çox qazananlar',
      prompt: `**Öz departamentlərindəki ən yüksək aktiv maaşı** alan **aktiv** işçiləri sadalayın (bərabərdirsə, hamısını). Row müqayisəsi işlədin: \`(department_id, salary) IN (SELECT …)\`.

- **Sütunlar:** \`department_id\`, \`employee_id\`, \`salary\`
- **Sıralama:** \`department_id\` üzrə, sonra \`employee_id\`.`,
      hints: ['Subquery hər departament üçün bir sətir qaytarır: `SELECT department_id, max(salary) … GROUP BY department_id`.'],
      explanation: `\`(department_id, salary) IN (…)\` **cütləri** müqayisə edir: işçi **öz departamentinin** maksimumuna uyğun gəlməlidir. Yalnız maaşı müqayisə etmək təsadüfən başqa departamentin maksimumunu alan hər kəsi qəbul edir, bütün şirkət üzrə tək maksimumla müqayisə isə yalnız bir departamentin ən çox qazananını tapır.

Subquery-nin öz aktivlik filtri lazımdır. Departamentin rekord maaşı keçmiş işçiyə məxsus olsaydı, heç bir aktiv işçi uyğun gəlməzdi.

Diqqət edin ki, departamenti olmayan işçilər heç vaxt qaytarılmır: \`(NULL, salary) IN (…)\` naməlumdur.`,
      commonMistakes: ['Yalnız maaşı müqayisə etmək.', 'Hər departamentinki əvəzinə bütün şirkət üzrə maksimum.', 'Subquery daxilində aktivlik filtrini unutmaq.'],
    },
    't19-q13': {
      title: 'Heç nə üzərində ALL və ANY',
      prompt: `Bu sorğu nə qaytarır?`,
      hints: ['ALL AND-lər zənciri, ANY isə OR-lar zənciridir. Boş AND və boş OR nədir?'],
      explanation: `\`ALL\` = "heç bir dəyər onu pozmur". Dəyər olmadıqda heç nə onu pozmur, ona görə də nəticə **true**-dur (boş AND). \`ANY\` = "hansısa dəyər onu ödəyir", dəyər olmadıqda isə **false**-dur (boş OR).

Siyahıda NULL olduqda: \`5 > 1 AND 5 > NULL\` = \`true AND unknown\` = naməlum (NULL), \`5 > 1 OR 5 > NULL\` = \`true OR unknown\` = true.`,
      commonMistakes: ['Boş subquery üçün NULL gözləmək.', 'NULL-ın həmişə nəticəni NULL etdiyini düşünmək.'],
    },
    't19-q14': {
      title: 'Hər şey çatdırılıb',
      prompt: `**Çili**dən (\`country_id = 6\`) olan hansı müştərilərin **ən azı bir sifarişi** var və sifarişlərinin **hər biri** \`'delivered'\` statusundadır?

- **Sütunlar:** \`customer_id\`
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: [`"Hər sifariş çatdırılıb" = "heç bir sifariş çatdırılmamış deyil": \`NOT EXISTS (… status <> 'delivered')\`.`, 'Bu, təkbaşına sifarişi olmayan müştərilər üçün də true-dur. EXISTS əlavə edin.'],
      explanation: `"Hamısı üçün" sualları "əks nümunə yoxdur" kimi yazılır: çatdırılmamış sifarişin NOT EXISTS-i. Amma **sifarişi olmayan** müştərinin də əks nümunəsi yoxdur. Bu, *boş həqiqətdir* (vacuous truth), boş çoxluq üzərində \`= ALL\`-un true olmasının da səbəbi budur. Əlavə EXISTS ən azı bir sifariş tələb edir.

Çatdırılmış sifarişlərə qədər filtrləyib DISTINCT müştəriləri götürmək "*hansısa* çatdırılmış sifarişi var" sualına cavab verir, bu isə xeyli zəif şərtdir.`,
      commonMistakes: ['Sifarişi olmayan müştəriləri unutmaq (boş həqiqət).', '"Hamısı" əvəzinə "hansısa".'],
    },
    't19-q15': {
      title: 'Hər departamentdə üçüncü ən yüksək maaş',
      prompt: `Window function-lar olmadan: hər departament üçün onun **aktiv** işçiləri arasında **üçüncü ən yüksək fərqli maaşı** qaytarın. Bir neçə nəfər eyni maaşı alırsa, həmin maaş bir dəfə sayılır. Üçdən az fərqli aktiv maaşı olan departamentlər nəzərə alınmır.

- **Sütunlar:** \`department_id\`, \`third_salary\`
- **Sıralama:** \`department_id\` üzrə.`,
      hints: ['Eyni departamentdə düz **2 fərqli** maaş ondan yüksək olduqda maaş 3-cü ən yüksək fərqli maaşdır.', '`(SELECT count(DISTINCT m.salary) FROM employees m WHERE m.department_id = e.department_id AND … AND m.salary > e.salary) = 2`'],
      explanation: `Klassik "N-ci ən yüksək maaş" müsahibə sualı. Korrelyasiyalı say bunu birbaşa deyir: düz N − 1 **fərqli** maaş ondan yuxarı olduqda maaş N-ci ən yüksək fərqli maaşdır. Xarici sorğudakı DISTINCT həmin maaşı paylaşan həmkarları yığır.

Bərabərliklər tələdir. Sales-də ən yuxarıdan dərhal aşağıda eyni maaşda iki nəfər var:

- DISTINCT olmadan \`ORDER BY salary DESC OFFSET 2\` üçüncü **sətri** qaytarır, bu da yenə bərabər maaşdır.
- \`count(DISTINCT …)\` əvəzinə \`count(*)\` hər iki bərabər adamı sayır, ona görə də heç bir maaşın üstündə düz 2 olmur və departament yox olur.`,
      commonMistakes: ['DISTINCT-siz OFFSET (bərabərliklər).', 'count(DISTINCT salary) əvəzinə count(*).'],
    },
    't19-q16': {
      title: 'Hər kanalı işlətmiş müştərilər',
      prompt: `**\`orders\` cədvəlində görünən hər kanal** vasitəsilə sifariş vermiş müştəriləri tapın. Kanalların sayını və ya adlarını sabit yazmayın.

- **Sütunlar:** \`customer_id\`
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: ['Relational division: "bu müştərinin işlətmədiyi kanal yoxdur".', `\`NOT EXISTS (SELECT … channels … WHERE NOT EXISTS (SELECT … this customer's orders on that channel))\``],
      explanation: `"Hər Y üçün X" **relational division**-dır. İkiqat NOT EXISTS ilə belə oxunur: bu müştərinin sifarişi olmayan kanal yoxdur. Sayma alternativi müştərinin *fərqli* kanallarının sayını kanalların ümumi sayı ilə müqayisə edir. Fərqli kanallar əvəzinə sifarişləri saymaq dörd web sifarişi olan müştərinin uyğun gəlməsinə imkan verir.

Hər iki NOT EXISTS-i EXISTS ilə əvəz etmək "hər kanal"ı "hansısa kanal"a çevirir.`,
      commonMistakes: ['Fərqli kanallar əvəzinə sifarişləri saymaq.', 'NOT EXISTS … NOT EXISTS (hamısı) əvəzinə EXISTS (hansısa).'],
    },
  },
};

export default topic;
