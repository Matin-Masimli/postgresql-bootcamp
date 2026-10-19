import type { TopicText } from '../../i18n.ts';

const explanation = `İnsanların yazdığı mətn səliqəsizdir: artıq boşluqlar, təsadüfi böyük-kiçik hərflər, uyğunsuz formatlar. Mətn funksiyaları mətni təmizləyir, bölür, axtarır və qurur. \`customers\`, \`reviews\` və \`staging_customer_import\` cədvəllərimiz məşq üçün bol material verir.

## Təmizləmə: hərf registri və boşluqlar

| funksiya | nümunə | nəticə |
|---|---|---|
| \`lower(s)\`, \`upper(s)\` | \`upper('zoë')\` | \`'ZOË'\` |
| \`initcap(s)\` | \`initcap('anna DE vries')\` | \`'Anna De Vries'\` |
| \`trim(s)\` / \`ltrim\` / \`rtrim\` | \`trim('  Berlin ')\` | \`'Berlin'\` |
| \`trim(both 'x' from s)\` | \`trim(both '-' from '--a--')\` | \`'a'\` |

\`\`\`sql
SELECT customer_id,
       first_name,
       initcap(trim(first_name)) AS cleaned
FROM customers
WHERE first_name <> initcap(trim(first_name))
ORDER BY customer_id
LIMIT 8;
\`\`\`

## Ölçmək və kəsmək

- \`length(s)\` / \`char_length(s)\` **simvolları** sayır. \`octet_length(s)\` **baytları** sayır: 'Zoë' 3 simvoldur, amma UTF-8-də 4 baytdır.
- \`left(s, n)\`, \`right(s, n)\`, \`substring(s FROM start FOR len)\` (mövqelər **1**-dən başlayır). \`left\`/\`right\`-da mənfi n "son/ilk n-dən başqa hamısı" deməkdir.
- \`position('@' IN email)\` və ya \`strpos(email, '@')\` alt-mətnin mövqeyini qaytarır, yoxdursa 0.
- \`split_part(s, delimiter, n)\` *n*-ci sahəni qaytarır. Mənfi *n* sondan sayır (PostgreSQL 14+).

\`\`\`sql
SELECT email,
       split_part(email, '@', 1)        AS local_part,
       lower(split_part(email, '@', 2)) AS domain,
       position('@' IN email)           AS at_position
FROM customers
WHERE email IS NOT NULL
ORDER BY customer_id
LIMIT 5;
\`\`\`

## Qurmaq və əvəz etmək

- \`||\` (hər hansı hissə NULL-dursa NULL), \`concat(a, b, …)\` (NULL-ları nəzərə almır) və ya \`concat_ws(', ', a, b)\` (ayırıcı ilə, NULL-ları ötürür) ilə birləşdirin.
- \`replace(s, from, to)\` alt-mətnin hər təkrarlanmasını əvəz edir. \`translate(s, 'abc', 'xyz')\` tək simvolları qarşılıqlı uyğunlaşdırır və qarşılığı olmayan simvolları silir.
- \`lpad(s, n, '0')\` / \`rpad\` sabit enə qədər doldurur: \`lpad('42', 6, '0')\` \`'000042'\` verir.
- \`repeat(s, n)\`, \`reverse(s)\`, \`format('%s-%s', a, b)\`.

## Regular expression-lar

PostgreSQL-də tam POSIX regular expression-lar var:

| operator / funksiya | mənası |
|---|---|
| \`s ~ 'pattern'\`, \`s ~* 'pattern'\` | uyğun gəlir (hərf registrinə həssas / həssas olmayan) |
| \`s !~ 'pattern'\` | uyğun gəlmir |
| \`regexp_replace(s, pattern, repl, 'g')\` | uyğunluqları əvəz edir. **\`'g'\` = hər uyğunluq**, təkcə birincisi yox |
| \`regexp_match(s, pattern)\` | birinci uyğunluğun capture group-ları, massiv kimi (birincisi üçün \`[1]\`) |
| \`regexp_split_to_table(s, pattern)\` | hər hissə üçün bir sətir |

\`\`\`sql
SELECT phone,
       regexp_replace(phone, '[^0-9]', '', 'g') AS digits_only
FROM customers
WHERE phone IS NOT NULL
ORDER BY customer_id
LIMIT 5;
\`\`\`

Faydalı siniflər: \`\\d\` rəqəm, \`\\D\` rəqəm olmayan, \`\\s\` boşluq simvolu, \`\\m\` / \`\\M\` sözün başlanğıcı / sonu, \`^\` / \`$\` mətnin başlanğıcı / sonu.

## Tələlər

- \`substring(s, 0, 3)\` yalnız **2** simvol qaytarır: mövqelər 1-dən başlayır, 0 başlanğıcı isə uzunluğun bir simvolunu "istifadə edir".
- \`LIKE\` hərf registrinə həssasdır. \`ILIKE\`, \`lower()\` və ya \`~*\` işlədin.
- \`'g'\` olmadan \`regexp_replace\` yalnız **birinci** uyğunluğu əvəz edir.
- \`initcap\` hər hərf olmayan simvoldan sonra böyük hərf qoyur: "o'brien" "O'Brien" olur, amma "mcdonald" "Mcdonald" olur.
- Mətn müqayisəsi dəqiqdir. Müqayisə və ya qruplaşdırmadan əvvəl hər iki tərəfi normallaşdırın (\`lower(trim(…))\`).`;

const topic: TopicText = {
  explanation,
  questions: {
    't09-q01': {
      title: 'Səliqəli müştəri adları',
      prompt: `**1-dən 20-yə qədər** müştərilər üçün səliqəli tam ad hazırlayın: ad və soyadın hər biri **trim olunmuş** və **initcap**-də (hər sözün ilk hərfi böyük), bir boşluqla birləşdirilmiş.

- **Sütunlar:** \`customer_id\`, \`full_name\`
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: [`\`initcap(trim(first_name)) || ' ' || initcap(trim(last_name))\``],
      explanation: `\`trim\` bəzi adlarda olan artıq boşluqları silir, \`initcap\` isə 'HARUTO' və 'patel'-i düzəldir. Burada iki çağırışın sırası əhəmiyyət kəsb etmir. \`initcap\`-ı birləşdirilmiş mətnə tətbiq etmək (alternativdə olduğu kimi) eyni nəticəni verir, çünki initcap hər sözü böyük hərflə başladır.`,
      commonMistakes: ['trim-i unutmaq: bu, qoşa boşluqlar qoyur.', 'Böyük-kiçik hərfləri düzəltməyi unutmaq.'],
    },
    't09-q02': {
      title: 'E-poçt domenləri',
      prompt: `**E-poçt ünvanı olan** hər müştəri üçün **domeni** (\`@\`-dən sonrakı hissə) **kiçik hərflərlə**, ətrafdakı boşluqlar olmadan göstərin.

- **Sütunlar:** \`customer_id\`, \`domain\`
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: [`\`split_part(email, '@', 2)\` birinci @-dən sonrakı mətni qaytarır.`, 'Bölməzdən əvvəl trim edin ki, sondakı boşluq domenə düşməsin.'],
      explanation: `\`split_part(s, '@', 2)\` @ üzrə bölərkən ikinci sahəni qaytarır. Bir neçə ünvan böyük hərflərlə və ya sonda boşluqla saxlanılıb, ona görə də \`lower(trim(…))\` ilə normallaşdırın. 1-ci sahə istifadəçi adı olardı.`,
      commonMistakes: ['lower/trim-i unutmaq.', '2-ci əvəzinə 1-ci sahəni götürmək.'],
    },
    't09-q03': {
      title: 'Simvollar, yoxsa baytlar?',
      prompt: `UTF-8 verilənlər bazasında \`length('Zoë')\` və \`octet_length('Zoë')\` nə qaytarır?`,
      hints: ['ë tək simvoldur, amma UTF-8-də birdən çox bayt tələb edir.'],
      explanation: `\`length\` (= \`char_length\`) **simvolları** sayır: Z, o, ë = 3. \`octet_length\` **baytları** sayır. ë UTF-8-də 2 bayt tutur, ona görə də cəmi 4-dür. Biznes qaydaları üçün ("ən çox 30 simvol") simvol uzunluğunu, bayt uzunluğunu isə yalnız saxlama ilə bağlı suallar üçün işlədin.`,
      commonMistakes: ['Hər simvola bir bayt düşdüyünü düşünmək.'],
      options: ['3 və 3', '3 və 4', '4 və 4', '4 və 3'],
    },
    't09-q04': {
      title: 'Trim, uzunluq və mövqe',
      prompt: `Bu sorğu nə qaytarır?`,
      hints: ['trim yalnız əvvəldəki və sondakı boşluqları silir.', 'length boşluqlar daxil hər simvolu sayır.', 'position *birinci* təkrarlanmanı tapır.'],
      explanation: `- \`trim\` yalnız xarici boşluqları silir, ona görə də 'a b' = 'a b' **true**-dur (daxili boşluq qalır).
- \`length('  a b  ')\` boşluqlar daxil bütün **7** simvolu sayır.
- \`upper\` diakritik hərfləri də emal edir: **ZOË**.
- \`position\` birinci uyğunluğu qaytarır: **2**.`,
      commonMistakes: ['trim-in daxili boşluqları sildiyini düşünmək.', 'length-in boşluqları nəzərə almadığını düşünmək.'],
    },
    't09-q05': {
      title: 'SKU-nu bölün',
      prompt: `SKU-lar \`'LAP-1014'\` kimidir: hərf kodu, defis, ədəd. Hər məhsulun SKU-sunu iki hissəyə bölün.

- **Sütunlar:** \`product_id\`, \`sku\`, \`code\` (defisdən əvvəlki mətn), \`seq\` (ondan sonrakı ədəd, **integer** kimi)
- **Sıralama:** \`product_id\` üzrə.`,
      hints: [`\`split_part(sku, '-', 1)\` və \`split_part(sku, '-', 2)\`.`, `İkinci hissəni integer-ə cast edin: \`::int\`.`],
      explanation: `\`split_part\` uzunluğu dəyişən hissələrlə işləyir. \`left(sku, 3)\` / \`right(sku, 3)\` sabit en fərz edir: ədədin 4 rəqəmi var, ona görə də \`right(…, 3)\` birini kəsir.

Ədəd hissəsini integer-ə cast edin: mətn kimi o, əlifba sırası ilə sıralanar və müqayisə olunardı ('9' > '10') və onunla hesablama apara bilməzdiniz.`,
      commonMistakes: ['Sabit enli kəsmələr.', 'Sahə nömrələrini qarışdırmaq.', 'Ədədi mətn kimi saxlamaq.'],
    },
    't09-q06': {
      title: 'Yalnız rəqəmlərdən ibarət telefon nömrələri',
      prompt: `Telefon nömrələri çoxlu formatda saxlanılıb (\`'+1 956 303 8604'\`, \`'(631) 987-1445'\`, \`'760.552.9971'\`, …). Telefonu olan hər müştəri üçün nömrəni **bütün rəqəm olmayan simvollar silinmiş** halda qaytarın.

- **Sütunlar:** \`customer_id\`, \`digits\`
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: [`\`regexp_replace(phone, '\\D', '', …)\`: \`\\D\` rəqəm olmayan simvola uyğun gəlir.`, 'Defolt olaraq yalnız birinci uyğunluq əvəz olunur. Hansı bayraq hamısını əvəz edir?'],
      explanation: `\`regexp_replace(s, pattern, replacement, 'g')\`: \`\\D\` (və ya \`[^0-9]\`) istənilən rəqəm olmayan simvola uyğun gəlir, boş əvəzetmə isə onu silir. **\`g\`** (global) bayrağı olmadan yalnız *birinci* rəqəm olmayan simvol silinir.

\`translate(phone, '+()-. ', '')\` də burada işləyir, çünki sadalanan hər simvolu silir. Amma yeni növ ayırıcı peyda olan kimi pozulur.`,
      commonMistakes: ['g bayrağını unutmaq.', 'Yalnız boşluqları silmək.'],
    },
    't09-q07': {
      title: 'Batareyadan bəhs edən rəylər',
      prompt: `**Mətnində** istənilən böyük-kiçik hərflə ("Battery", "BATTERY", …) **"battery"** sözü keçən rəyləri tapın.

- **Sütunlar:** \`review_id\`, \`rating\`
- **Sıralama:** \`review_id\` üzrə.`,
      hints: [`Hərf registrinə həssas olmayan uyğunlaşdırma: \`ILIKE '%battery%'\` və ya \`~* 'battery'\`.`],
      explanation: `Rəylərin çoxu "Battery life …" yazır, böyük B ilə, ona görə də hərf registrinə həssas LIKE onların çoxunu buraxır. ILIKE, \`~*\` və ya \`lower()\` axtarışı hərf registrinə həssas olmayan edir. Mətni olmayan (NULL) rəylər heç vaxt uyğun gəlmir, burada bu, problem deyil.`,
      commonMistakes: ['Hərf registrinə həssas LIKE.', 'Şablonu başlanğıca bağlamaq.'],
    },
    't09-q08': {
      title: 'Faktura nömrələri',
      prompt: `**2025-ci ilin iyununda** verilmiş sifarişlər üçün faktura nömrələri yaradın: \`'INV-'\`, ardınca **6 rəqəmə qədər sıfırlarla doldurulmuş** sifariş id-si, məsələn 7461 nömrəli sifariş \`INV-007461\` olur.

- **Sütunlar:** \`order_id\`, \`invoice_no\`
- **Sıralama:** \`order_id\` üzrə.`,
      hints: [`\`lpad(order_id::text, 6, '0')\``],
      explanation: `\`lpad(text, 6, '0')\` mətn 6 simvol uzunluğunda olana qədər **solda** sıfırlar əlavə edir. \`rpad\` sağda doldurur və ədədi dəyişir. \`to_char(order_id, 'FM000000')\` (8-ci mövzu) alternativdir: hər \`0\` məcburi rəqəmdir.

Diqqət: lpad hədəf enindən artıq uzun olan mətnləri *kəsir*.`,
      commonMistakes: ['Sağda doldurmaq.', 'Yanlış en.'],
    },
    't09-q09': {
      title: 'Düzəlt: üç hərfli kateqoriya kodları',
      prompt: `Bu sorğu hər kateqoriya üçün **slug-ın ilk üç hərfini böyük hərflə** göstərməlidir (\`'electronics'\` \`'ELE'\` olur), amma kodlar cəmi iki hərflə çıxır. Düzəldin.

- **Sütunlar:** \`category_id\`, \`slug\`, \`code\`
- **Sıralama:** \`category_id\` üzrə.`,
      hints: ['SQL-də mətnin birinci simvolu hansı mövqedə olur?'],
      explanation: `SQL mətnləri **1-dən başlayır**: birinci simvol 1-ci mövqedədir. \`substring(s, 0, 3)\` 0, 1 və 2 mövqelərini əhatə edir, 0-cı mövqe isə mövcud deyil, ona görə də yalnız iki simvol qayıdır.

1-dən başlayın və ya məhz nəzərdə tutduğunuzu deyən \`left(slug, 3)\` işlədin. (\`substring(slug, 0, 4)\` də düzgün kodlar verərdi, amma yalnız bir "bir vahid fərq" səhvini başqası ilə kompensasiya etdiyi üçün işləyir.)`,
      commonMistakes: ['Əksər proqramlaşdırma dillərində olduğu kimi mövqelərin 0-dan başladığını düşünmək.'],
    },
    't09-q10': {
      title: '"Soyad, Ad"-dan "Ad Soyad"-a',
      prompt: `\`staging_customer_import\`-də \`full_name\`-dəki bəzi adlar **\`'Last, First'\`** formasında (vergüllə) yazılıb. **\`full_name\`-ində vergül olan hər sətir üçün** onu **\`'First Last'\`** kimi yenidən yazın: hissələr trim olunmuş, aralarında bir boşluq.

- **Sütunlar:** \`import_row_id\`, \`full_name\`, \`fixed_name\`
- **Sıralama:** \`import_row_id\` üzrə.`,
      hints: [`\`split_part(full_name, ',', 1)\` soyaddır, 2-ci hissə isə ad.`, 'Hər hissəni trim edin. Bəzilərində artıq boşluqlar var.'],
      explanation: `Vergül üzrə \`split_part\` "Last" (1-ci sahə) və " First" (2-ci sahə, adətən əvvəldə boşluqla) verir. Onların yerini dəyişin, hər hissəni trim edin və bir boşluqla birləşdirin. trim olmadan əvvəldə boşluq və qoşa boşluqlar alardınız. Sadəcə vergülü silmək yanlış sıranı saxlayır.`,
      commonMistakes: ['Hissələri trim etməmək.', 'Yerini dəyişmədən vergülü silmək.'],
    },
    't09-q11': {
      title: 'Eyni e-poçt, fərqli yazılış',
      prompt: `Bəzi müştərilər **eyni e-poçt ünvanı ilə, amma fərqli yazılışla** (hərf registri və ya ətrafdakı boşluqlar) iki dəfə qeydiyyatdan keçib. \`lower(trim(email))\` dəyərləri bərabər olan, **amma xam \`email\` dəyərləri fərqli olan** **fərqli müştərilərin** cütlərini tapın.

- **Sütunlar:** \`customer_a\`, \`customer_b\` (\`customer_a < customer_b\` olmaqla), \`email_a\`, \`email_b\`
- **Sıralama:** \`customer_a\` üzrə, sonra \`customer_b\`.`,
      hints: ['customers-i normallaşdırılmış e-poçt üzrə self-join edin.', `Xam dəyərləri fərqli olan cütləri saxlayın və hər cütü bir dəfə göstərmək üçün \`<\` işlədin.`],
      explanation: `Join şərtində normallaşdırın: hər iki tərəfdə \`lower(trim(email))\` 'Anna@x.com ' və 'anna@x.com'-u bərabər edir. \`a.customer_id < b.customer_id\` hər cütü bir dəfə saxlayır. Sondakı \`a.email <> b.email\` yalnız *fərqli* yazılmış cütləri saxlayır. Onsuz eyni ünvanı paylaşan müştəriləri də alırsınız.

trim olmadan sonu boşluqlu variantlar buraxılır. NULL e-poçtlar heç vaxt cütləşmir, çünki NULL = NULL true deyil.`,
      commonMistakes: ['Hərf registrini normallaşdırıb boşluqları normallaşdırmamaq.', '< əvəzinə <> işlətmək: bu, hər cütü iki dəfə göstərir.', 'Eyni yazılışları daxil etmək.'],
    },
    't09-q12': {
      title: 'Məhsul adlarından ekran ölçüləri',
      prompt: `Bir çox məhsul adında düymlə ölçü var, məsələn \`Laptop 15.6"\` və ya \`Monitor 27"\` (ədəd, birbaşa ardınca \`"\`). Adında belə ölçü olan məhsullar üçün onu **numeric** dəyər kimi çıxarın.

- **Sütunlar:** \`product_id\`, \`name\`, \`inches\`
- **Sıralama:** \`product_id\` üzrə.`,
      hints: [`\`regexp_match(name, '(\\d+(\\.\\d+)?)"')\` capture group-ları massiv kimi qaytarır, uyğunluq yoxdursa NULL.`, `Birinci elementi \`[1]\` ilə götürüb numeric-ə cast edin. \`name ~ '\\d"'\` ilə filtrləyin.`],
      explanation: `\`(\\d+(?:\\.\\d+)?)"\` şablonu belə deməkdir: rəqəmlər, istəyə görə nöqtə və daha çox rəqəm, 1-ci qrupda tutulmuş, ardınca hərfi dırnaq. \`regexp_match\` qrupları text massivi kimi qaytarır, ona görə də \`[1]\` ədəddir.

- \`(\\d+)"\` onluq hissəni buraxır (15.6 6 olur).
- \`"\` lövbəri olmadan addakı birinci ədəd qalib gəlir, bu da "500" kimi model nömrəsi ola bilər.

\`substring(s FROM pattern)\` birinci capture group-u birbaşa qaytarır.`,
      commonMistakes: ['Onluq ölçüləri nəzərə almamaq.', 'Düym işarəsindən əvvəlki ədəd əvəzinə istənilən ədədə uyğunlaşdırmaq.'],
    },
    't09-q13': {
      title: 'Normallaşdırılmış kupon kodları',
      prompt: `Müştərilər kupon kodlarını uyğunsuz yazıb: \`'welcome10'\`, \`' WELCOME10'\`, \`'free-ship'\`, \`'BlackFriday'\`, …

**Unikal normallaşdırılmış kodları** göstərin; normallaşdırma belədir: trim, böyük hərfə çevirmə və defislərin silinməsi.

- **Sütunlar:** \`code\`
- **Sıralama:** \`code\` üzrə.`,
      hints: [`\`upper(replace(trim(coupon_code), '-', ''))\``, 'Kuponsuz sifarişləri xaric edin.'],
      explanation: `Hər normallaşdırma addımı bir növ fərqi aradan qaldırır: \`trim\` (boşluqlar), \`upper\` (hərf registri), \`replace(…, '-', '')\` (defislər). Sonra DISTINCT variantları birləşdirir: 11 xam yazılış 6 real koda çevrilir.

İstənilən bir addımı buraxmaq 'FREE-SHIP' / 'FREESHIP' və ya ' WELCOME10' / 'WELCOME10' kimi təkrarlar qoyur.`,
      commonMistakes: ['Defisi unutmaq.', 'Trim etməyi unutmaq.'],
    },
    't09-q14': {
      title: 'Mətnləri kəsmək',
      prompt: `Bu sorğu nə qaytarır?`,
      hints: ['split_part-da mənfi sahə nömrəsi sondan sayır.', `\`left(s, -n)\` "son n simvoldan başqa hamısı" deməkdir.`],
      explanation: `- \`split_part(…, -1)\` **sonuncu** sahədir: 'c' (PostgreSQL 14+).
- \`left('abcdef', -2)\` son 2 simvolu atır: 'abcd'.
- \`right('abcdef', 2)\` son 2-sidir: 'ef'.
- \`substring(… FROM 2 FOR 3)\` 2-ci mövqedən başlayan 3 simvoldur: 'bcd'.`,
      commonMistakes: ['Mənfi arqumentləri bilməmək.', 'Mövqeləri 0-dan saymaq.'],
    },
    't09-q15': {
      title: 'Maskalanmış e-poçt ünvanları',
      prompt: `Dəstək ekranı üçün müştərilərin e-poçtlarını maskalayın: **istifadəçi adının ilk simvolunu**, sonra \`***\`, sonra \`@\` və tam **domeni** saxlayın, hamısı **kiçik hərflə və trim olunmuş**. Məsələn, \`' Anna.Kim@Gmail.com'\` \`a***@gmail.com\` olur.

E-poçt ünvanı olan **1-dən 30-a qədər** müştərilər üçün.

- **Sütunlar:** \`customer_id\`, \`masked_email\`
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: [`Əvvəlcə normallaşdırın: \`lower(trim(email))\`.`, `İlk simvol: \`left(…, 1)\`. Domen: \`split_part(…, '@', 2)\`.`],
      explanation: `Nəticəni normallaşdırılmış hissələrdən qurun: ilk simvol, sabit maska, @ və domen. Regex alternativi ilk simvolu tutur (\`^(.)\`), istifadəçi adının qalanına uyğun gəlir (\`[^@]*\`) və hər ikisini tutulmuş simvol üstəgəl \`***\` ilə əvəz edir. \`\\1\` 1-ci qrupa istinad edir.

Əvvəlcə normallaşdırmaq vacibdir: \`trim\` olmadan əvvəlində boşluq olan ünvan boşluğu "ilk simvolu" kimi göstərərdi.`,
      commonMistakes: ['Normallaşdırmamaq.', '@ işarəsini atmaq.'],
    },
    't09-q16': {
      title: 'Rəy başlıqlarında ən çox işlənən sözlər',
      prompt: `Rəy **başlıqlarında** hansı sözlər ən çox görünür? Başlıqları hərf olmayan hər şey üzrə sözlərə bölün, kiçik hərfə çevirin və yalnız **ən azı 4 hərfli** sözləri sayın. **Ən tez-tez rast gəlinən 10** sözü qaytarın.

- **Sütunlar:** \`word\`, \`uses\`
- **Sıralama:** \`uses\` üzrə (ən yüksək birinci), sonra \`word\`. 10 sətir.`,
      hints: [`\`regexp_split_to_table(lower(title), '[^a-z]+')\` hər başlığı hər söz üçün bir sətrə çevirir.`, `\`length(word) >= 4\` ilə filtrləyin, sonra word üzrə GROUP BY edib sayın (14-cü mövzu).`],
      explanation: `Klassik mətn analitikası sualı:

1. **Tokenləşdirin:** \`regexp_split_to_table(lower(title), '[^a-z]+')\` hərf olmayan simvolların hər ardıcıllığı üzrə bölür və hər söz üçün bir sətir qaytarır. FROM-da vergüllə işlədildikdə hər rəy üçün bir dəfə icra olunur (gizli LATERAL join).
2. Qısa sözləri **filtrləyin**, bu, kənarlarda yaranan boş mətnləri də atır.
3. Hər söz üzrə **sayın** və tie-breaker kimi sözlə top 10-u götürün.

Yalnız boşluqlar üzrə bölmək durğu işarələrini sözlərə yapışıq saxlayır ("excellent!" ≠ "excellent"). Kiçik hərfə çevirməmək "AMAZING" və "amazing"-i ayrı sayır. "Ən azı 4 hərf" isə \`>= 4\`-dür: "good" və "love" kimi sözlər sayılır.`,
      commonMistakes: ['Kiçik hərfə çevirməmək.', 'Yalnız boşluqlar üzrə bölmək.', '>= 4 əvəzinə > 4 işlətmək.'],
    },
  },
};

export default topic;
