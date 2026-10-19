import type { TopicText } from '../../i18n.ts';

const explanation = `Bir obyekt haqqında verilənlər bir neçə cədvələ paylanıb: sifariş sətri müştərinin adını yox, \`customer_id\`-ni saxlayır. **Join** iki cədvəlin sətirlərini şərt, adətən "bu id o id-yə bərabərdir" şərti true olduqda birləşdirir.

\`\`\`sql
SELECT o.order_id, o.ordered_at, c.first_name, c.last_name
FROM orders AS o
JOIN customers AS c ON c.customer_id = o.customer_id
ORDER BY o.order_id
LIMIT 5;
\`\`\`

Hər cədvələ qısa alias verin (\`o\`, \`c\`) və sütunları onunla tam göstərin. İki cədvəlin eyni adlı sütunu olduqda (\`customer_id\`), prefikssiz istinad xətadır: *column reference is ambiguous*.

## INNER JOIN

\`JOIN\` (\`INNER JOIN\`-in qısa forması) yalnız uyğun gələn sətir cütlərini saxlayır. Cütü olmayan sətir yox olur. *Bir neçə* cütü olan sətir *bir neçə dəfə*, hər uyğunluq üçün bir dəfə görünür.

## LEFT, RIGHT və FULL OUTER JOIN

| join | saxlayır |
|---|---|
| \`A JOIN B\` | yalnız uyğun gələn cütləri |
| \`A LEFT JOIN B\` | A-nın hər sətrini. Heç nə uyğun gəlmədikdə B-nin sütunları NULL olur |
| \`A RIGHT JOIN B\` | B-nin hər sətrini (\`B LEFT JOIN A\` ilə eyni) |
| \`A FULL JOIN B\` | hər ikisinin hər sətrini, uyğunluğu olmayan tərəfdə NULL-larla |

\`\`\`sql
-- Hər müştəri, sifarişləri varsa, onlarla birlikdə
SELECT c.customer_id, o.order_id
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id
ORDER BY c.customer_id, o.order_id
LIMIT 12;
\`\`\`

**Cütü olmayan sətirləri tapmaq** (*anti-join*): LEFT JOIN edin, sonra sağ tərəfi NULL olan sətirləri saxlayın. Real uyğunluqda NULL ola bilməyən sütunu, məsələn primary key-i yoxlayın.

\`\`\`sql
SELECT c.customer_id, c.first_name, c.last_name
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id
WHERE o.order_id IS NULL
ORDER BY c.customer_id
LIMIT 10;
\`\`\`

## Outer join-lərdə ON və WHERE

Outer join üçün bu iki yer bir-birini əvəz **etmir**:

- **ON**-dakı şərt sağ tərəfdəki hansı sətirlərin *uyğun gəldiyinə* qərar verir. Uyğunluğu olmayan sol sətirlər NULL-larla yenə saxlanılır;
- **WHERE**-dəki şərt isə *join nəticəsini* filtrləyir. O, NULL ilə genişləndirilmiş sətirləri silir və LEFT JOIN-inizi yenidən inner join-ə çevirir.

\`\`\`sql
-- Hər şöbə AKTİV işçiləri ilə (Legal-da heç kim yoxdur, amma yenə görünür)
SELECT d.name, e.employee_id
FROM departments d
LEFT JOIN employees e
       ON e.department_id = d.department_id
      AND e.termination_date IS NULL
ORDER BY d.name, e.employee_id;
\`\`\`

## USING və çoxcədvəlli join-lər

\`JOIN orders USING (customer_id)\` hər iki cədvəldə eyni adlı sütun üzrə bərabərliyin qısa yazılışıdır və həmin sütun nəticədə yalnız bir dəfə görünür. \`NATURAL JOIN\` *bütün* eyni adlı sütunlar üzrə join edir. Ondan qaçın, çünki sütun əlavə etmək onun mənasını səssizcə dəyişə bilər.

Join-lər soldan sağa zəncirlənir:

\`\`\`sql
SELECT o.order_id, oi.line_no, p.name AS product, oi.quantity
FROM orders o
JOIN order_items oi ON oi.order_id = o.order_id
JOIN products p     ON p.product_id = oi.product_id
WHERE o.order_id = 1000
ORDER BY oi.line_no;
\`\`\`

## Sətirlərin çoxalması: ən geniş yayılmış join səhvi

Sifarişi 3 sətri **və** 2 ödənişi ilə join etmək 3 × 2 = 6 sətir verir. Bu sətirlər üzərində ödəniş məbləğlərini cəmləmək hər ödənişi üç dəfə sayır. Hər dəfə yalnız bir "çox" tərəfi join edin və ya join-dən əvvəl hər tərəfi aqreqasiya edin (14-cü və 19-cu mövzular).

## Tələlər

- Sağ tərəfdəki cədvələ INNER JOIN-lə davam edən LEFT JOIN uyğunluğu olmayan sətirləri yenə atır. Başladıqdan sonra bütün zənciri LEFT saxlayın.
- LEFT JOIN-dən sonra \`count(*)\` NULL ilə genişləndirilmiş sətri 1 kimi sayır. Əvəzində sağ tərəfdəki sütunu sayın (14-cü mövzu).
- Yanlış sütunlar üzrə join (məsələn, \`p.product_id = oi.order_id\`) adətən yenə "işləyir", sadəcə zibil qaytarır. Sətir saylarını yoxlayın.`;

const topic: TopicText = {
  explanation,
  questions: {
    't05-q01': {
      title: 'İyun sifarişlərini kim verib?',
      prompt: `**2025-ci ilin iyununda** verilmiş hər sifarişi onu verən müştərinin adı ilə birlikdə göstərin.

- **Sütunlar:** \`order_id\`, \`ordered_at\`, \`first_name\`, \`last_name\`
- **Sıralama:** \`order_id\` üzrə.`,
      hints: [`\`orders\`-i \`customers\` ilə \`customer_id\` üzrə join edin.`, `2025-ci ilin iyunu: \`ordered_at >= '2025-06-01' AND ordered_at < '2025-07-01'\`.`],
      explanation: `\`JOIN customers c ON c.customer_id = o.customer_id\` hər sifarişə müştəri sətrini bağlayır. Hər sifarişin düz bir müştərisi var (bu, mütləq foreign key-dir), ona görə də join nə sifarişləri itirir, nə də təkrarlayır.

Tarix filtri yarıaçıq aralıqdır. \`< '2025-06-30'\` ayın son gününü atardı.`,
      commonMistakes: ['Yanlış sütun cütü üzrə join (order_id = customer_id) yenə icra olunur, amma yanlış adamları qaytarır.', '30 iyunu kəsmək.'],
    },
    't05-q02': {
      title: 'Məhsullar kateqoriyaları ilə',
      prompt: `Hər məhsulu **kateqoriyasının adı** ilə göstərin.

- **Sütunlar:** \`product_id\`, \`product\` (məhsulun adı), \`category\` (kateqoriyanın adı)
- **Sıralama:** \`product_id\` üzrə.`,
      hints: [`Hər iki cədvəldə \`name\` sütunu var. SELECT siyahısında onlara alias verin.`],
      explanation: `Hər iki cədvəldə \`name\` sütunu var. Nəticədə fərqli sütun adları lazımdır, ona görə də onlara alias verin: \`p.name AS product, c.name AS category\`. Cədvəl prefiksi olmadan \`name\` ikimənalı olardı.`,
      commonMistakes: [`\`name\`-i cədvəl prefiksi olmadan seçmək: ikimənalılıq xətası.`, 'Ad əvəzinə slug qaytarmaq.'],
    },
    't05-q03': {
      title: 'LEFT JOIN nəyi saxlayır?',
      prompt: `\`customers LEFT JOIN orders ON orders.customer_id = customers.customer_id\`. Nəticədə hansı sətirlər var?`,
      hints: ['LEFT JOIN sol tərəfdəki sətri heç vaxt itirmir, amma onu təkrarlaya bilər.'],
      explanation: `LEFT JOIN sol cədvəlin **hər** sətrini saxlayır. 5 sifarişi olan müştəri 5 sətir verir (hər uyğunluq üçün bir). Sifarişi olmayan müştəri bütün sifariş sütunlarında NULL olan bir sətir verir. "Düz bir dəfə" yanlışdır, çünki uyğunluqlar sətirləri çoxaldır.`,
      commonMistakes: ['One-to-many əlaqəni join etdikdən sonra hər müştəri üçün bir sətir gözləmək.'],
      options: [
        'Yalnız ən azı bir sifarişi olan müştərilər.',
        'Hər müştəri ən azı bir dəfə. Sifarişi olan müştərilər hər sifariş üçün bir dəfə, sifarişi olmayanlar isə sifariş sütunları NULL olmaqla bir dəfə görünür.',
        'Hər müştəri düz bir dəfə.',
        'Hər sifariş, üstəgəl sifarişi olmayan müştərilər.',
      ],
    },
    't05-q04': {
      title: 'Inner və left join',
      prompt: `İki kiçik cədvəl, iki üsulla join edilib. Sorğu nə qaytarır?`,
      hints: ['a.id = 1 b-dəki **iki** sətrə uyğun gəlir.', 'LEFT JOIN-də a.id = 2 və 3-ün uyğunluğu yoxdur. Onlar görünürmü?'],
      explanation: `- **Inner:** a=1 iki b=1 sətrinə uyğun gəlir və **2** sətir verir. a=2 və a=3 heç nəyə uyğun gəlmir, b=4 də heç nəyə uyğun gəlmir.
- **Left:** eyni 2 uyğun sətir, üstəgəl NULL-larla hərəsi bir dəfə a=2 və a=3, cəmi **4** sətir. b=4 saxlanılmır, çünki yalnız sol tərəf qorunur.`,
      commonMistakes: ['Sağ tərəfdəki təkrarların sətirləri çoxaltdığını unutmaq.', 'LEFT JOIN-in sağdakı uyğunluğu olmayan sətirləri də saxladığını düşünmək (bu, FULL JOIN-dir).'],
    },
    't05-q05': {
      title: 'Heç vaxt sifariş verməmiş müştərilər',
      prompt: `**Heç vaxt sifariş verməmiş** müştəriləri tapın.

- **Sütunlar:** \`customer_id\`, \`first_name\`, \`last_name\`
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: ['orders-i LEFT JOIN edin, sonra heç nəyin uyğun gəlmədiyi sətirləri saxlayın.', `Sağ tərəfin primary key-ini yoxlayın: \`WHERE o.order_id IS NULL\`.`],
      explanation: `Bu, **anti-join** üsuludur:

1. \`LEFT JOIN orders\` hər müştərini saxlayır. Sifarişi olmayanlar sifariş sütunları NULL olan bir sətir alır.
2. \`WHERE o.order_id IS NULL\` məhz həmin sətirləri saxlayır. \`order_id\` primary key-dir, ona görə də real uyğunluqda heç vaxt NULL olmur.

\`coupon_code\` kimi NULL ola bilən sütunu yoxlamaq tələdir: kuponsuz real sifarişlərdə də orada NULL var. Inner JOIN isə NULL sətirlərini ümumiyyətlə yarada bilmir. \`NOT EXISTS\` (19-cu mövzu) anti-join yazmağın digər standart üsuludur.`,
      commonMistakes: ['Inner join işlətmək (heç nə qaytarmır).', 'Real uyğunluqlarda NULL ola bilən sütunu yoxlamaq.'],
    },
    't05-q06': {
      title: 'Məhsullar və onların təchizatçısı (varsa)',
      prompt: `**Bütün məhsulları** təchizatçısının adı ilə göstərin. Bir neçə məhsulun təchizatçısı yoxdur: onlar da təchizatçı adı NULL olmaqla görünməlidir.

- **Sütunlar:** \`product_id\`, \`product\`, \`supplier\`
- **Sıralama:** \`product_id\` üzrə.`,
      hints: ['Hansı join uyğun təchizatçısı olmayan məhsulları saxlayır?'],
      explanation: `\`products LEFT JOIN suppliers\` hər məhsulu saxlayır. \`supplier_id\` NULL olduqda (və ya heç nəyə uyğun gəlmədikdə) təchizatçı sütunları NULL olur. Inner join həmin məhsulları atardı.

FULL JOIN məhsulu olmayan təchizatçıları da məhsulu NULL olan sətirlər kimi *əlavə* edərdi. Bu, istəniləndən çoxdur.`,
      commonMistakes: ['Inner join təchizatçısı olmayan məhsulları itirir.', 'FULL JOIN arzuolunmaz yalnız-təchizatçı sətirləri əlavə edir.'],
    },
    't05-q07': {
      title: 'Uzun ilin 29 fevralında nə alınıb?',
      prompt: `**29 fevral 2024**-də (UTC) verilmiş sifarişlərin **hər sətrini** məhsul adı ilə göstərin.

- **Sütunlar:** \`order_id\`, \`line_no\`, \`product\` (məhsulun adı), \`quantity\`, \`unit_price\`
- **Sıralama:** \`order_id\` üzrə, sonra \`line_no\`.`,
      hints: ['Üç cədvəl: orders → order_items → products.', `Bütöv gün: \`>= '2024-02-29' AND < '2024-03-01'\`.`],
      explanation: `Join-ləri foreign key-lər boyunca zəncirləyin: sifarişin sətirləri var və hər sətir bir məhsula istinad edir. Tarix filtri sifarişə qoyulur.

\`order_items.unit_price\` (alınan məbləğ) ilə \`products.price\` (bugünkü siyahı qiyməti) arasındakı fərqə diqqət edin. Bəzi sətirlər köhnə qiymətlə satılıb.`,
      commonMistakes: ['Sifariş sətrindəki qiymət əvəzinə bugünkü siyahı qiymətini göstərmək.', 'Məhsulları yanlış açar üzrə join etmək.'],
    },
    't05-q08': {
      title: 'Düzəlt: ikimənalı sütun',
      prompt: `Bu sorğu hər **telefon sifarişini** müştərinin id-si və adı ilə göstərməlidir, amma uğursuz olur. Düzəldin.

- **Sütunlar:** \`order_id\`, \`customer_id\`, \`first_name\`
- **Sıralama:** \`order_id\` üzrə.`,
      hints: ['Hansı sütun hər iki cədvəldə var?'],
      explanation: `Xəta: *column reference "customer_id" is ambiguous*. Hər iki cədvəldə \`customer_id\` sütunu var və burada bərabər olsalar da, PostgreSQL hansını nəzərdə tutduğunuzu təxmin etmir.

Onu tam göstərin (\`o.customer_id\`) və ya iki sütunu bir prefikssiz \`customer_id\`-də birləşdirən \`USING (customer_id)\` ilə join edin.`,
      commonMistakes: ['Xətanı düzəldərkən WHERE hissəsini silmək.'],
    },
    't05-q09': {
      title: 'Şöbələr və onların son işə qəbulları',
      prompt: `**Hər şöbəni** onun **1 yanvar 2024 və ya ondan sonra işə qəbul etdiyi** işçilərlə (\`hire_date >= '2024-01-01'\`, hələ işləyib-işləməməsindən asılı olmayaraq) göstərin. Belə işə qəbulu olmayan şöbə də işçi id-si NULL olmaqla bir dəfə görünməlidir.

- **Sütunlar:** \`department\` (şöbənin adı), \`employee_id\`, \`hire_date\`
- **Sıralama:** \`department\` üzrə, sonra \`employee_id\`.`,
      hints: ['departments-dən LEFT JOIN edin.', 'İşə qəbul tarixi şərti uyğunluğu olmayan şöbələri silməməsi üçün hara getməlidir: ON, yoxsa WHERE?'],
      explanation: `İşə qəbul tarixi şərtini **ON-a** qoyun. Onda o, yalnız hansı işçilərin uyğunluq sayıldığına qərar verir. Uyğun işçisi olmayan şöbə NULL işçi sütunları olan bir sətir kimi yenə qalır.

WHERE-də şərt join-dən *sonra* icra olunur. Son işə qəbulu olmayan şöbə üçün qalan sətirlər ya köhnə işçilərdir (yoxlamadan keçmir), ya da NULL ilə genişləndirilmiş sətirdir, burada \`NULL >= '2024-01-01'\` naməlumdur. Hər ikisi silinir, ona görə də şöbə yox olur: LEFT JOIN səssizcə inner join-ə çevrilib.

Praktik qayda: **LEFT JOIN-in məcburi olmayan (sağ) tərəfinə aid şərtlər ON-a aiddir**. Qorunan tərəfə aid şərtlər WHERE-ə gedə bilər.`,
      commonMistakes: ['Şərti WHERE-ə qoymaq: bu, son işə qəbulu olmayan şöbələri (və Legal-ı) atır.', 'İşə qəbul tarixi filtrini tamamilə unutmaq.'],
    },
    't05-q10': {
      title: 'Hər təchizatçı və hər məhsul',
      prompt: `**Hər təchizatçını və hər məhsulu** ehtiva edən bir siyahı hazırlayın: məhsullar öz təchizatçıları ilə cütləşdirilir, məhsulu olmayan təchizatçılar məhsul sütunları NULL olmaqla bir dəfə, təchizatçısı olmayan məhsullar isə təchizatçı sütunları NULL olmaqla bir dəfə görünür.

- **Sütunlar:** \`supplier_id\`, \`supplier\`, \`product_id\`, \`product\`
- **Sıralama:** \`supplier_id\` üzrə (NULL-lar sonda), sonra \`product_id\` (NULL-lar sonda).`,
      hints: ['Hər iki tərəf qorunmalıdır: bu, FULL OUTER JOIN-dir.'],
      explanation: `FULL JOIN eyni anda həm LEFT, həm də RIGHT join-dir. Uyğun cütlər adi qaydada görünür, uyğunluğu olmayan təchizatçılar NULL məhsul sütunları, uyğunluğu olmayan məhsullar isə NULL təchizatçı sütunları alır.

Adətən **iki siyahını müqayisə etmək** üçün istifadə olunur: nə yalnız bir tərəfdədir, nə yalnız digər tərəfdədir, nə hər ikisindədir.`,
      commonMistakes: ['LEFT JOIN təchizatçısı olmayan məhsulları itirir.', 'RIGHT JOIN məhsulu olmayan təchizatçıları itirir.'],
    },
    't05-q11': {
      title: 'Geri göndərilmiş məhsullar',
      prompt: `Statusu \`'returned'\` olan **ən azı bir sifarişin tərkibində olmuş hər məhsulu** bir dəfə göstərin.

- **Sütunlar:** \`product_id\`, \`name\`
- **Sıralama:** \`product_id\` üzrə.`,
      hints: ['orders → order_items → products, sifariş statusuna görə filtrlənmiş.', 'Məhsul bir neçə geri qaytarılmış sifarişdə ola bilər. Onu necə yalnız bir dəfə göstərmək olar?'],
      explanation: `Join hər (geri qaytarılmış sifariş, sətir) üçün bir sətir yaradır. Bir neçə geri qaytarılmış sifarişdə olan məhsul bir neçə dəfə görünür və \`DISTINCT\` onları birləşdirir.

İkinci yanlış cavab əvəzində \`returns\` cədvəlini oxuyur. Bu, başqa sualdır: o, rədd edilmiş geri qaytarma *sorğularını* və ümumilikdə hələ 'delivered' olan sifarişlərdən geri qaytarılmış sətirləri də daxil edir.`,
      commonMistakes: ['DISTINCT-i unutmaq (sətirlərin çoxalması).', 'returns cədvəli vasitəsilə başqa suala cavab vermək.'],
    },
    't05-q12': {
      title: 'Yeni Zelandiya müştəriləri, sifarişləri və bağlamaları',
      prompt: `**Yeni Zelandiyada** (\`country_id = 31\`) yaşayan hər müştəri üçün onun sifarişlərini və hər sifarişin göndərişlərini göstərin. Sifarişi olmayan müştərilər də (NULL sifariş və göndəriş sütunları ilə), göndərişi olmayan sifarişlər də (NULL göndəriş sütunları ilə) görünməlidir.

- **Sütunlar:** \`customer_id\`, \`order_id\`, \`shipment_id\`, \`carrier\`
- **Sıralama:** \`customer_id\`, \`order_id\`, \`shipment_id\` üzrə (hər birində NULL-lar sonda).`,
      hints: ['Ardıcıl iki LEFT JOIN: customers → orders → shipments.', 'İkinci join inner join olsa, sifarişi olmayan müştərilərə nə olur?'],
      explanation: `LEFT JOIN zəncirinə başladıqdan sonra **solda qalın**. Birinci yanlış cavabda ikinci join inner join-dir, ona görə də sifarişi NULL olan sətirlər (sifarişi olmayan müştərilər) və ya sifarişinin göndərişi olmayan sətirlər (pending, cancelled…) yenə atılır.

WHERE şərti *qorunan* cədvələ (customers) aiddir, ona görə də WHERE-də təhlükəsizdir.`,
      commonMistakes: ['Zəncirdə LEFT və INNER join-ləri qarışdırmaq.', 'orders-ə inner join ilə başlamaq: bu, sifarişi olmayan müştəriləri itirir.'],
    },
    't05-q13': {
      title: 'Düzəlt: şişirdilmiş ödəniş cəmləri',
      prompt: `Bu sorğu **1-dən 50-yə qədər** sifarişlər üçün sifariş id-sini və **capture olunmuş ödənişlərin ümumi məbləğini** göstərməlidir. Bəzi sifarişlər üçün cəmlər çox yüksək çıxır. Düzəldin.

- **Sütunlar:** \`order_id\`, \`captured\`
- **Sıralama:** \`order_id\` üzrə. Yalnız ən azı bir capture olunmuş ödənişi olan sifarişlər görünür.`,
      hints: ['3 sətri və 1 ödənişi olan sifariş üçün join neçə sətir yaradır?', 'Ödənişləri cəmləmək üçün sizə ümumiyyətlə order_items lazımdırmı?'],
      explanation: `\`order_items\`-i join etmək hər ödənişi sifariş sətirlərinin sayına vurur: 3 sətri və 50-lik bir ödənişi olan sifariş 150 cəm verir. Bu sual üçün \`order_items\` ümumiyyətlə lazım deyil, onu silin.

\`SUM(DISTINCT amount)\` cazibədar yamaqdır, amma bir sifarişin eyni məbləğli iki *fərqli* ödənişi olduqda yanlışdır. Təkrarları gizlətmək əvəzinə join-i düzəldin. (GROUP BY və SUM 14-cü mövzuda öyrənilir.)`,
      commonMistakes: ['Sətirlərin çoxalmasını DISTINCT ilə yamamaq.', 'Join-i silərkən status filtrini də silmək: bu, uğursuz və geri qaytarılmış ödənişləri sayır.', 'Sualın tələb etmədiyi join-ləri saxlamaq.'],
    },
    't05-q14': {
      title: 'Filtr ON-da, yoxsa WHERE-də?',
      prompt: `Hər sorğu neçə sətir qaytarır?`,
      hints: ['ON-da tag şərti nəyin uyğunluq sayıldığına qərar verir. a=2 yenə saxlanılırmı?', 'WHERE join-dən sonra icra olunur və NULL ilə genişləndirilmiş sətri görür.'],
      explanation: `- **ON-da:** a=1 (1,'x')-ə uyğun gəlir. a=2 üçün yeganə namizəd (2,'y') tag şərtindən keçmir, ona görə də a=2 NULL-larla saxlanılır. Bu, **2** sətirdir.
- **WHERE-də:** join əvvəlcə (1,'x') və (2,'y') yaradır. Sonra WHERE yalnız 'x' tag-ını saxlayır və **1** sətir verir. Outer join-in "hər şeyi saxla" davranışı ləğv olundu.`,
      commonMistakes: ['Outer join-lər üçün ON və WHERE-i ekvivalent saymaq.'],
    },
    't05-q15': {
      title: 'Ev ölkəsi və göndərmə ölkəsi',
      prompt: `**2025-ci ilin iyununda** verilmiş hər sifariş üçün **müştərinin ev ölkəsinin adını** və **göndərmə ölkəsinin adını** göstərin. Hər ikisi naməlum (NULL) ola bilər; belə sifarişlər də həmin sütunda NULL ilə görünməlidir.

- **Sütunlar:** \`order_id\`, \`home_country\`, \`ship_country\`
- **Sıralama:** \`order_id\` üzrə.`,
      hints: [`\`countries\` sizə iki dəfə, iki fərqli alias altında lazımdır.`, 'Hər iki ölkə join-i LEFT join olmalıdır.'],
      explanation: `Eyni cədvəl bir sorğuda iki rol oynaya bilər. \`countries\`-i iki alias altında **iki dəfə** join edin: biri müştərinin ev ölkəsi, digəri göndərmə məntəqəsi üçün.

Hər ikisi LEFT join-dir, çünki hər iki açar NULL ola bilər və inner join həmin sifarişləri səssizcə atardı. Müştəri join-i inner qala bilər: \`orders.customer_id\` foreign key ilə NOT NULL-dur, ona görə də hər sifarişin müştərisi var.`,
      commonMistakes: ['countries-ə inner join-lər: bu, ölkəsi naməlum olan sifarişləri itirir.', 'Hər iki rol üçün bir alias işlətmək.'],
    },
    't05-q16': {
      title: 'Heç vaxt real olaraq alınmamış məhsullar',
      prompt: `**Heç vaxt ləğv edilməmiş sifarişdə görünməyən** məhsulları tapın. Bura heç vaxt sifariş edilməmiş məhsullar *və* yalnız ləğv edilmiş sifarişlərdə görünmüş məhsullar daxildir. Join-lərdən istifadə edin (subquery olmadan).

- **Sütunlar:** \`product_id\`, \`name\`
- **Sıralama:** \`product_id\` üzrə.`,
      hints: ['Anti-join: "real" sifariş sətirlərini LEFT JOIN edin və heç nəyin uyğun gəlmədiyi məhsulları saxlayın.', 'Sağ tərəfin özü order_items və ləğv edilməmiş sifarişlərin join-idir. Onu mötərizəyə alın və ya status şərtini ikinci LEFT JOIN-in ON hissəsinə köçürüb həmin cədvəlin açarını yoxlayın.'],
      explanation: `Məhsulun sətirlərindən **hər hansı biri** real sifarişə aiddirsə, o, xaric edilməlidir. Mötərizəli \`(order_items JOIN orders … AND status <> 'cancelled')\` join-i real sifariş sətirlərinin toplusudur, LEFT JOIN + \`IS NULL\` isə onlardan heç biri olmayan məhsulları saxlayır.

Cazibədar ikinci yanlış cavab sətirləri bir-bir yoxlayır: bir ləğv edilmiş və bir real sətri olan məhsul ləğv edilmiş sətrində filtrdən keçir, ona görə də alınmasına baxmayaraq siyahıya düşür.

\`order_items\` üzərində sadə anti-join yalnız ləğv edilmiş sifarişlərdə görünən məhsulları buraxır. Məşq verilənlərində belə bir məhsul var. Bunu yazmağın adətən ən aydın yolu \`NOT EXISTS\`-dir (19-cu mövzu).`,
      commonMistakes: ['Ləğv edilmiş sifarişləri tamamilə nəzərə almamaq.', 'Sətir-sətir filtrləmək: bu, real sifarişlərdə də alınmış məhsulları saxlayır.'],
    },
  },
};

export default topic;
