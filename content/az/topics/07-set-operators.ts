import type { TopicText } from '../../i18n.ts';

const explanation = `Join-lər cədvəlləri **yan-yana** qoyur: daha çox sütun. Set operator-lar isə sorğu nəticələrini **bir-birinin üstünə** yığır və ya müqayisə edir: daha çox və ya daha az sətir.

| operator | nəticə |
|---|---|
| \`A UNION B\` | A-da və ya B-də olan sətirlər, təkrarlar silinir |
| \`A UNION ALL B\` | A-nın bütün sətirləri, ardınca B-nin bütün sətirləri, təkrarlar saxlanılır |
| \`A INTERSECT B\` | həm A-da, həm də B-də olan sətirlər |
| \`A EXCEPT B\` | A-da olub B-də olmayan sətirlər |

\`INTERSECT ALL\` və \`EXCEPT ALL\` təkrarları sayaraq saxlayır: sətir A-da 3 dəfə, B-də bir dəfə görünürsə, \`A EXCEPT ALL B\` onu iki dəfə qaytarır.

\`\`\`sql
-- Müştərilərimiz və ya təchizatçılarımız (və ya hər ikisi) olan ölkələr
SELECT country_id FROM customers WHERE country_id IS NOT NULL
UNION
SELECT country_id FROM suppliers
ORDER BY country_id;
\`\`\`

## Qaydalar

1. Hər sorğu **eyni sayda sütun** qaytarmalıdır və sütun tipləri uyğun olmalıdır; uyğunlaşdırma adla yox, **mövqeyə görə** aparılır.
2. Nəticə sütunlarının **adları birinci sorğudan gəlir**.
3. Sətirlər bütöv şəkildə müqayisə olunur və burada **NULL-lar bərabər sayılır** (\`=\`-dən fərqli olaraq): iki \`(1, NULL)\` sətri təkrardır.
4. Sondakı \`ORDER BY\` və \`LIMIT\` **bütün** nəticəyə tətbiq olunur. Bir budağı sıralamaq və ya məhdudlaşdırmaq üçün onu mötərizəyə alın.
5. \`INTERSECT\` \`UNION\` və \`EXCEPT\`-dən güclü bağlanır: \`A UNION B INTERSECT C\` \`A UNION (B INTERSECT C)\` deməkdir. Mötərizələr işlədin.

\`\`\`sql
-- Ən bahalı 2 və ən ucuz 2 məhsul, bir siyahıda
(SELECT 'most expensive' AS segment, product_id, price FROM products ORDER BY price DESC, product_id LIMIT 2)
UNION ALL
(SELECT 'cheapest', product_id, price FROM products ORDER BY price, product_id LIMIT 2)
ORDER BY segment, price;
\`\`\`

## UNION, yoxsa UNION ALL?

\`UNION\` təkrarları silmək üçün bütün sətirləri sıralamalı və ya hash etməlidir. Budaqlar üst-üstə düşə bilmirsə (məsələn, hər biri fərqli etiket daşıyır) və ya təkrarlar mənalıdırsa, **UNION ALL işlədin**. O, daha sürətlidir və sətirləri gizlətmir.

\`\`\`sql
-- Üç cədvəldən bir aktivlik lenti: tipik UNION ALL
SELECT ordered_at AS happened_at, 'order' AS kind, order_id AS id FROM orders WHERE customer_id = 7
UNION ALL
SELECT created_at, 'review', review_id FROM reviews WHERE customer_id = 7
UNION ALL
SELECT logged_in_at, 'login', login_id FROM user_logins WHERE customer_id = 7
ORDER BY happened_at
LIMIT 10;
\`\`\`

## EXCEPT və INTERSECT müqayisə alətləri kimi

Onlar bütöv sətirləri müqayisə edir, bu da onları uzlaşdırma üçün əla edir: "A sistemindən hansı (order_id, amount) cütləri B sistemində yoxdur?" və ya "hansı müştərilər 2023-də sifariş verib, 2024-də verməyib?".

\`EXCEPT\` anti-join yazmağın başqa yolu, \`INTERSECT\` isə semi-join-dir. \`NOT IN\`-dən fərqli olaraq onlar NULL-lara bərabər dəyərlər kimi yanaşır, amma yalnız müqayisə olunan sütunları qaytara bilir.

## Tələlər

- \`SELECT a, b … UNION SELECT b, a …\`: sütunlar **mövqeyə görə** uyğunlaşır. Yerləri dəyişmiş sütunlar tipləri uyğundursa, səssizcə birləşdirilir.
- Tipləri qarışdırmaq cast tələb edir: \`SELECT id::text … UNION SELECT code …\` (8-ci mövzu).
- \`EXCEPT\` nəticədən təkrarları silir. \`A EXCEPT B\` qalan hər sətri, A-da dəfələrlə görünsə belə, bir dəfə göstərir.`;

const topic: TopicText = {
  explanation,
  questions: {
    't07-q01': {
      title: 'E-poçt ünvanlarının vahid siyahısı',
      prompt: `Müştərilərdən (\`email\`) və təchizatçılardan (\`contact_email\`) bildiyimiz **bütün e-poçt ünvanlarının** vahid siyahısını qurun. NULL-ları buraxın və hər ünvanı **bir dəfə** göstərin (dəqiq yazılış, normallaşdırma olmadan).

- **Sütunlar:** \`email\`
- **Sıralama:** \`email\` üzrə.`,
      hints: ['Təkrarları silən UNION ilə birləşdirilmiş iki SELECT.', 'Nəticə sütununun adı birinci SELECT-dən gəlir.'],
      explanation: `\`UNION\` iki siyahını üst-üstə yığır və təkrarları silir. Bəzi müştərilərin ünvanı tam eynidir, ona görə də UNION ALL onları iki dəfə göstərərdi.

NULL filtri **hər iki** budaqda olmalıdır, çünki hər WHERE yalnız öz SELECT-inə tətbiq olunur. Onsuz bir NULL sətri qalır (UNION NULL-ları bir-birinin təkrarı sayır, ona görə də yalnız biri qalır).`,
      commonMistakes: ['UNION ALL təkrarları saxlayır.', 'NULL-ları yalnız bir budaqda filtrləmək və ya ümumiyyətlə filtrləməmək.'],
    },
    't07-q02': {
      title: 'UNION, yoxsa UNION ALL?',
      prompt: `Bu ayın sifarişlərini iki **ayrı mağaza verilənlər bazasından** bir hesabatda birləşdirirsiniz. Sifariş heç vaxt hər ikisində ola bilməz və hər sətir göstərilməlidir. Hansı operatoru işlətməlisiniz və niyə?`,
      hints: ['UNION ALL ilə müqayisədə UNION hansı əlavə işi görür?'],
      explanation: `UNION təkrarlanan sətirləri silir, bu da bütün nəticə üzərində sıralama və ya hash tələb edir. Təkrarlar baş verə bilmədikdə və ya *mənalı* olduqda (iki eyni sətir), UNION ALL həm daha sürətli, həm də daha düzgündür. INTERSECT yalnız **hər iki** girişdə olan sətirləri saxlayır.`,
      commonMistakes: ['Defolt olaraq UNION işlədib eyni sətirləri səssizcə itirmək.'],
      options: [
        '`UNION`, çünki bu, daha təhlükəsiz defoltdur.',
        '`UNION ALL`: təkrar mümkün deyil, ona görə də UNION-un əlavə təkrar silmə işi boşa gedir (və o, qanuni olaraq eyni olan sətirləri gizlədə bilər).',
        '`INTERSECT`, çünki o, hər ikisindən sətirləri saxlayır.',
        '`EXCEPT`, çünki toplular üst-üstə düşmür.',
      ],
    },
    't07-q03': {
      title: 'Müştərisi və ya təchizatçısı olan ölkələr',
      prompt: `**Ən azı bir müştərisi və ya ən azı bir təchizatçısı** olan bütün ölkələrin id-lərini göstərin.

- **Sütunlar:** \`country_id\`
- **Sıralama:** \`country_id\` üzrə.`,
      hints: ['Müştərilərin ölkəsi NULL ola bilər. Onu xaric edin.'],
      explanation: `İki toplu arasında "və ya" UNION-dur. Lüksemburqda təchizatçı var, amma müştəri yoxdur, ona görə də o, yalnız ikinci budaq vasitəsilə görünür.

UNION həm də hər budaq *daxilində* təkrarları silir, ona görə də DISTINCT lazım deyil.`,
      commonMistakes: ['"Və" mənasını verən INTERSECT.', 'Təchizatçıları unutmaq.'],
    },
    't07-q04': {
      title: 'Təkrarlar və NULL-larla UNION',
      prompt: `Bu sorğu nə qaytarır?`,
      hints: ['UNION təkrarları, o cümlədən bir budaq *daxilindəki* təkrarları silir. Set operator-lar üçün iki NULL təkrardırmı?'],
      explanation: `UNION budaqlar daxilində və arasında hər təkrar sətri silir. Set operator-lar üçün (DISTINCT-də olduğu kimi) NULL-lar bərabər **sayılır**, ona görə də yalnız bir NULL qalır. Artan ORDER BY ilə NULL sonda gəlir: 1, 2, NULL.`,
      commonMistakes: ['UNION-un yalnız iki budaq *arasında* təkrarlanan sətirləri sildiyini düşünmək.', 'İki NULL saxlamaq.'],
    },
    't07-q05': {
      title: 'Həm müştərisi, həm də təchizatçısı olan ölkələr',
      prompt: `**Həm** müştəriləri, **həm də** təchizatçıları olan ölkələrin id-lərini göstərin.

- **Sütunlar:** \`country_id\`
- **Sıralama:** \`country_id\` üzrə.`,
      hints: ['İki toplu arasında "hər ikisi" INTERSECT-dir.'],
      explanation: `\`INTERSECT\` hər iki nəticədə olan sətirləri, hərəsini bir dəfə saxlayır.

NULL ölkələr burada xüsusi emal tələb etmir: təchizatçıların həmişə ölkəsi var, ona görə də müştərinin NULL-unun kəsişəcəyi bir şey yoxdur. (Hər iki tərəfdə NULL olsaydı, INTERSECT NULL sətri *qaytarardı*, çünki set operator-lar NULL-ları bərabər sayır.)`,
      commonMistakes: ['INTERSECT (hər ikisi) əvəzinə UNION (hər hansı biri).'],
    },
    't07-q06': {
      title: 'Rəyi olan, amma heç vaxt satılmamış',
      prompt: `Hansı məhsulların **ən azı bir rəyi** var, amma **heç bir sifariş sətrində görünmür**?

- **Sütunlar:** \`product_id\`
- **Sıralama:** \`product_id\` üzrə.`,
      hints: ['Rəyi olan məhsullar, EXCEPT sifariş sətirlərindəki məhsullar.'],
      explanation: `\`A EXCEPT B\` A-nın B-də olmayan sətirlərini saxlayır və sıra vacibdir: \`order_items EXCEPT reviews\` əks suala cavab verir ("satılıb, amma heç vaxt rəy yazılmayıb").

EXCEPT təkrarları da silir, ona görə də çoxlu rəyi olan məhsul bir dəfə görünür. Məşq verilənlərində qəsdən rəyi olan, heç vaxt satılmamış bir məhsul var.`,
      commonMistakes: ['EXCEPT-in iki tərəfinin yerini dəyişmək.'],
    },
    't07-q07': {
      title: 'Uzun ilin 29 fevralının aktivlik lenti',
      prompt: `**29 fevral 2024**-də (UTC) baş verən hər şeyin aktivlik lentini qurun: verilən sifarişlər (\`ordered_at\`), yazılan rəylər (\`created_at\`) və tələb olunan geri qaytarmalar (\`requested_at\`).

- **Sütunlar:** \`happened_at\`, \`kind\` (\`'order'\`, \`'review'\` və ya \`'return'\`), \`id\` (sətrin primary key-i)
- **Sıralama:** \`happened_at\` üzrə, sonra \`kind\`, sonra \`id\`.`,
      hints: ['Hər cədvəl üçün eyni üç sütunu yaradan bir SELECT, UNION ALL ilə birləşdirilmiş.', 'Hər budağı yarıaçıq aralıqla həmin günə filtrləyin.'],
      explanation: `Fərqli cədvəllər, bir forma: hər budaq \`(timestamp, text, integer)\` qaytarır. Sabit \`'order'\` / \`'review'\` / \`'return'\` sütunu sətirləri bir-birindən ayırır. Belə etiketlə sətirlər toqquşa bilmir, ona görə də UNION ALL düzgün seçimdir.

Hər budağa öz WHERE-i lazımdır, çünki WHERE bir SELECT-ə aiddir. Alternativ olaraq, hər şeyi subquery daxilində birləşdirib xaricdə bir dəfə filtrləyin. Yekun ORDER BY birləşdirilmiş lenti sıralayır.`,
      commonMistakes: ['Bir budağı buraxmaq.', 'Yalnız birinci budağı filtrləmək.'],
    },
    't07-q08': {
      title: 'Düzəlt: əlaqə kataloqu',
      prompt: `Bu sorğu hər **müştərini və təchizatçını** \`(id, name)\` kimi göstərməlidir; müştərilər \`first_name || ' ' || last_name\` kimi, təchizatçılar isə \`name\` ilə adlandırılır. O, uğursuz olur. Düzəldin.

- **Sütunlar:** \`id\`, \`name\`
- **Sıralama:** \`name\` üzrə, sonra \`id\`. Təkrarları saxlayın (UNION ALL işlədin).`,
      hints: ['Xətanı oxuyun: hər budaq neçə sütun qaytarır?'],
      explanation: `Xəta: *each UNION query must have the same number of columns*. Təchizatçı budağı yalnız id qaytarırdı. Adı əlavə edin.

Sütun adları birinci budaqdan gəlir (\`id\`, \`name\`), ona görə də təchizatçı budağına alias lazım deyil.`,
      commonMistakes: ['Sütun sayını yanlış sütunla tamamlamaq.'],
    },
    't07-q09': {
      title: 'Alış-verişi dayandırmış müştərilər',
      prompt: `**2023**-də ən azı bir **ləğv edilməmiş** sifariş vermiş, amma **2024**-də (UTC illəri) **heç bir** sifariş verməmiş müştəriləri tapın.

- **Sütunlar:** \`customer_id\`
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: ['2023-də aktiv olan müştərilər, EXCEPT 2024-də aktiv olan müştərilər.', 'Hər iki toplu ləğv edilmiş sifarişləri xaric etməlidir.'],
      explanation: `EXCEPT "bu topluda var, o topluda yox" ifadəsini birbaşa ifadə edir və təkrarları silir (2023-də çoxlu sifarişi olan müştərilər bir dəfə görünür).

Ləğv edilmiş filtri hər iki tərəfdə mənanı dəyişir. 2024-dəki yeganə sifarişi ləğv edilmiş müştəri alış-verişi *həqiqətən* dayandırıb, amma filtr olmadan aktiv sayılardı.`,
      commonMistakes: ['Ləğv edilmiş sifarişləri nəzərə almamaq.', 'Tərəflərin yerini dəyişmək (bu, yeni müştəriləri tapır).'],
    },
    't07-q10': {
      title: 'Hansı operator birinci gəlir?',
      prompt: `Bu sorğu nə qaytarır?`,
      hints: ['INTERSECT UNION-dan güclü bağlanır, toplamadan əvvəl vurma kimi.'],
      explanation: `Əvvəlcə INTERSECT icra olunur: \`SELECT 2 INTERSECT SELECT 3\` boşdur. Sonra \`SELECT 1 UNION (empty)\` = {1}.

Ciddi şəkildə soldan sağa oxusaq, \`(1 UNION 2) INTERSECT 3\` boş nəticə verərdi. Operatorları qarışdırdıqda mötərizələr əlavə edin ki, heç kim prioriteti xatırlamalı olmasın.`,
      commonMistakes: ['Set operator-ları ciddi şəkildə soldan sağa icra etmək.'],
    },
    't07-q11': {
      title: 'Ən ucuz üç və ən bahalı üç',
      prompt: `**Hələ satışda olan** (\`discontinued_at IS NULL\`) **3 ən ucuz** və **3 ən bahalı** məhsulu bir siyahıda göstərin. Qiymət bərabərlikləri \`product_id\` ilə ayrılır (kiçik birinci).

- **Sütunlar:** \`segment\` (\`'cheapest'\` və ya \`'priciest'\`), \`product_id\`, \`price\`
- **Sıralama:** \`segment\` üzrə, sonra \`price\`, sonra \`product_id\`. 6 sətir.`,
      hints: ['Hər budağa öz ORDER BY … LIMIT 3-ü lazımdır. Hər budağı mötərizəyə alın.', 'Yekun ORDER BY birləşdirilmiş nəticəni sıralayır.'],
      explanation: `Sondakı ORDER BY / LIMIT **bütün** set əməliyyatına aiddir. Hər budağı ayrıca məhdudlaşdırmaq üçün budağı öz ORDER BY və LIMIT-i ilə mötərizəyə alın (və ya FROM-da subquery-lər işlədin).

Birinci yanlış cavab birləşdirilmiş siyahını məhdudlaşdırır, ona görə də 6 ən ucuz "cheapest" sətri qaytarır və ümumiyyətlə "priciest" sətri yoxdur.`,
      commonMistakes: ['Birləşdirilmiş nəticəyə tək LIMIT.', 'Satışda olma filtrini unutmaq.'],
    },
    't07-q12': {
      title: 'Yalnız bir tərəfdə olan e-poçtlar',
      prompt: `\`staging_customer_import\`-dəki e-poçt ünvanlarını \`customers\`-dəkilərlə müqayisə edin; əvvəlcə hər ikisini \`lower(trim(email))\` ilə normallaşdırın, NULL-ları və \`@\` olmayan ünvanları nəzərə almayın.

**Yalnız bir tərəfdə** mövcud olan ünvanları harada tapıldıqlarını göstərən etiketlə qaytarın.

- **Sütunlar:** \`found_in\` (\`'staging only'\` və ya \`'customers only'\`), \`email\` (normallaşdırılmış)
- **Sıralama:** \`found_in\` üzrə, sonra \`email\`.`,
      hints: ['İki EXCEPT: staging çıxılsın customers, və customers çıxılsın staging.', 'Etiketi EXCEPT-dən *sonra* əlavə edin (hər EXCEPT-i subquery-yə alın), yoxsa etiket də müqayisə olunar.'],
      explanation: `İki toplunun **simmetrik fərqi** (A − B) ∪ (B − A)-dır. İki detal vacibdir:

1. **Əvvəlcə normallaşdırın.** Xam mətnləri müqayisə etmək 'Anna@X.com' və 'anna@x.com'-u fərqli ünvanlar sayır.
2. **Müqayisədən sonra etiketləyin.** Etiket hər EXCEPT budağının hissəsi olsaydı, sətirlər heç vaxt uyğun gəlməzdi (etiketlər fərqlidir). Ona görə də hər EXCEPT subquery-yə gedir, etiket isə xaricdə əlavə olunur.

FULL JOIN alternativi iki siyahını join əsasında müqayisə etmək üsuludur.`,
      commonMistakes: ['Normallaşdırılmamış e-poçtları müqayisə etmək.', 'Yalnız bir istiqaməti qaytarmaq.'],
    },
    't07-q13': {
      title: 'Importdakı artıq nüsxələr',
      prompt: `\`staging_customer_import\`-də e-poçtunda \`@\` olan sətirlərin normallaşdırılmış \`lower(trim(email))\` ünvanlarına baxın. *n* dəfə görünən ünvanın *n − 1* **artıq nüsxəsi** var.

Hər ünvanı **hər artıq nüsxə üçün bir dəfə** qaytarın (3 dəfə görünən ünvan iki dəfə görünür; bir dəfə görünən isə görünmür).

- **Sütunlar:** \`email\`
- **Sıralama:** \`email\` üzrə.`,
      hints: [`\`EXCEPT ALL\` təkrarlanmaları çıxır: n nüsxədən 1 nüsxə çıxdıqda n − 1 qalır.`, 'Tam siyahıdan ünvanların *unikal* siyahısını çıxın.'],
      explanation: `\`ALL\` ilə set operator-lar təkrarlanmaları sayır: \`A EXCEPT ALL B\` B-dəki hər təkrarlanma üçün A-dan bir təkrarlanmanı silir. Unikal siyahını (hərəsindən bir) çıxmaq məhz artıq nüsxələri qoyur.

Adi \`EXCEPT\` *unikal* sətirlərlə işləyir. A-nın hər ünvanı B-də də var, ona görə də o, heç nə qaytarmır.`,
      commonMistakes: ['ALL-suz EXCEPT: bu, heç nə qaytarmır.'],
    },
    't07-q14': {
      title: '85 min və ya az qazanan menecerlər',
      prompt: `**Ən azı bir başqa işçini idarə edən**, amma öz **maaşı 85 000 və ya az** olan işçilərin id-lərini göstərin.

- **Sütunlar:** \`employee_id\`
- **Sıralama:** \`employee_id\` üzrə.`,
      hints: [`"Menecerdir" = \`manager_id\`-də görünür. Diqqət: \`manager_id\` NULL ehtiva edir (CEO-nunku).`, 'Menecerlər EXCEPT 85 000-dən çox qazanan işçilər.'],
      explanation: `Menecerlər toplusu unikal, NULL olmayan \`manager_id\` dəyərləridir. Sonra EXCEPT 85 000-dən çox qazananları silir. "85 000 və ya az" daxil qalır, ona görə də çıxılan toplu \`> 85000\`-dir. Menecer hissəsini unutmaq az qazanan hər kəsi qaytarır, onların çoxu isə heç kimi idarə etmir.

CEO-nun NULL \`manager_id\`-si əks halda EXCEPT-dən NULL sətri kimi sağ çıxardı: sağ tərəfdə heç nə ona bərabər deyil.`,
      commonMistakes: ['NULL-u saxlamaq: bu, NULL sətri əlavə edir.', '"Kimisə idarə edir" şərtini unutmaq: bu, az qazanan hər kəsi qaytarır.'],
    },
    't07-q15': {
      title: 'Sifarişləri ödənişlərlə uzlaşdırın',
      prompt: `**Çatdırılmış** sifarişlər üçün iki müstəqil ədədi müqayisə edin:

- **sifariş dəyəri**: \`ROUND(SUM(quantity * unit_price * (1 - discount)) + shipping_fee, 2)\`;
- **capture olunmuş məbləğ**: sifarişin \`status = 'captured'\` olan ödənişlərinin cəmi.

**EXCEPT** istifadə edərək ödəniş tərəfində **eyni \`(order_id, amount)\` cütü olmayan** \`(order_id, order_value)\` cütlərini göstərin.

- **Sütunlar:** \`order_id\`, \`order_value\`
- **Sıralama:** \`order_id\` üzrə.`,
      hints: ['Hər iki tərəfi hərəsi iki sütun qaytaran qruplaşdırılmış sorğular kimi qurun.', 'EXCEPT bütöv sətirləri müqayisə edir: (order_id, value) və (order_id, captured).'],
      explanation: `EXCEPT kompakt uzlaşdırma alətidir: bütöv sətir müqayisəsi bir addımda "eyni sifariş, eyni məbləğ" deməkdir və ödəniş tərəfində ümumiyyətlə olmayan sifarişlər də nəticəyə düşür.

Əsl iş hər tərəfi düzgün qurmaqdır:

- göndərmə haqqı hər sifarişə **bir dəfə** əlavə olunur (ona görə qruplaşdırın, hər sətir üzrə cəmləməyin);
- yalnız **capture olunmuş** ödənişlər sayılır. Uğursuz cəhdlər və geri qaytarmalar cəmi təhrif edərdi.

Nəticə məşq verilənlərindəki qəsdən az ödənilmiş sifarişlərdir. LEFT JOIN + \`IS DISTINCT FROM\` alternativi eyni müqayisəni join ilə edir.`,
      commonMistakes: ['Göndərmə haqqını unutmaq.', 'Capture olunmuşlar əvəzinə bütün ödənişləri cəmləmək.'],
    },
    't07-q16': {
      title: '2024-ün hər rübündə aktiv',
      prompt: `**2024-ün dörd rübünün hər birində** ən azı bir **ləğv edilməmiş** sifariş vermiş müştəriləri tapın (Q1 = yanvar–mart, …, UTC).

- **Sütunlar:** \`customer_id\`
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: ['Hər rüb üçün bir toplu, INTERSECT ilə birləşdirilmiş.', `Rüb sərhədləri yarıaçıq aralıqlar kimi: Q1 \`>= '2024-01-01' AND < '2024-04-01'\`-dir.`],
      explanation: `"Hər rübdə" müştərinin dörd rüb toplusunun hamısının üzvü olması, yəni onların kəsişməsi deməkdir. Hər budaq ləğv edilmiş filtrini və öz yarıaçıq tarix aralığını tətbiq edir.

GROUP BY alternativi (14-cü mövzu) hər müştəri üçün fərqli rübləri sayır və 4 olanları saxlayır. O, "hər ay"a daha yaxşı miqyaslanır (12 budaq yorucu olardı).`,
      commonMistakes: ['INTERSECT (hər rüb) əvəzinə UNION (hər hansı rüb).', 'Ləğv edilmiş sifarişləri saymaq.'],
    },
  },
};

export default topic;
