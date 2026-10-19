import type { TopicText } from '../../i18n.ts';

const explanation = `DML (Data Manipulation Language) **verilənləri** dəyişir: \`INSERT\` sətir əlavə edir, \`UPDATE\` onları dəyişir, \`DELETE\` isə silir. 2-ci mövzudakı DDL isə strukturu dəyişir.

> Bu tətbiqdə hər İcra et və Yoxla **geri qaytarılan** transaction-a bükülür, ona görə də sərbəst sınaqlar edin. Real verilənlər bazasında UPDATE və ya DELETE icra etməzdən əvvəl WHERE hissəsini SELECT ilə yoxlayın.

UPDATE və DELETE toxunacaqları sətirləri seçmək üçün \`WHERE\` tələb edir. WHERE tam olaraq 4-cü mövzuda öyrənilir. Burada yalnız \`WHERE department_id = 7\` kimi sadə şərtlərdən istifadə edirik.

## INSERT

\`\`\`sql
INSERT INTO departments (department_id, name, location, budget)
VALUES (11, 'Data Science', 'Berlin', 500000),
       (12, 'Partnerships', NULL, NULL)
RETURNING *;
\`\`\`

- **Sütunları həmişə sadalayın.** Bu, niyyəti sənədləşdirir və yeni sütunlar əlavə olunanda da işləyir. Buraxdığınız sütunlar öz DEFAULT dəyərini (və ya NULL) alır, identity sütunları isə dəyərlərini özləri yaradır.
- Bir statement bir neçə sətir və ya sorğunun sətirlərini daxil edə bilər: \`INSERT INTO t (cols) SELECT …\`.
- \`RETURNING\` daxil edilmiş sətirləri, yaradılmış id-lər daxil, geri qaytarır, ona görə də ikinci sorğuya ehtiyac qalmır.

\`\`\`sql
INSERT INTO suppliers (name, country_id, created_at)
VALUES ('Nordwind Imports', 9, DATE '2025-06-30')
RETURNING supplier_id, name;
\`\`\`

## UPDATE

\`\`\`sql
UPDATE departments
SET budget = budget * 1.10,
    location = 'Amsterdam'
WHERE name = 'Marketing'
RETURNING department_id, budget, location;
\`\`\`

- \`SET\` bir neçə sütuna dəyər verə bilər. Hər ifadə sətrin **köhnə** dəyərlərini görür.
- **WHERE olmadan bütün sətirlər yenilənir.** PostgreSQL \`UPDATE n\` bildirir, bu ədədi yoxlayın.
- PostgreSQL-in \`UPDATE … FROM other_table WHERE join-condition\` yazılışı sətirləri başqa cədvəlin dəyərləri ilə yeniləyir. Join şərtini həmişə yazın, yoxsa hər sətir digər cədvəlin *bütün* sətirləri ilə uyğunlaşdırılır.

\`\`\`sql
-- Göndərmə ölkəsi olmayan sifarişlərə müştərinin öz ölkəsini verin
UPDATE orders o
SET ship_country_id = c.country_id
FROM customers c
WHERE c.customer_id = o.customer_id
  AND o.ship_country_id IS NULL;
\`\`\`

## DELETE

\`\`\`sql
DELETE FROM payments
WHERE status = 'failed'
RETURNING payment_id;
\`\`\`

WHERE olmadan \`DELETE FROM t\` cədvəli boşaldır. \`DELETE … USING other\` UPDATE … FROM-un güzgüsü olan join formasıdır. Foreign key-lər \`ON DELETE CASCADE\` ilə elan olunmayıbsa, silməyə mane ola bilər (23503 xətası).

## Upsert: INSERT … ON CONFLICT

\`\`\`sql
INSERT INTO departments (department_id, name, location, budget)
VALUES (2, 'Sales', 'Paris', 4500000)
ON CONFLICT (department_id) DO UPDATE
  SET location = EXCLUDED.location,
      budget   = EXCLUDED.budget;
\`\`\`

Yeni sətir unikal açarı pozacaqsa, \`DO NOTHING\` onu ötürür, \`DO UPDATE\` isə əvəzində mövcud sətri dəyişir. \`EXCLUDED\` daxil etməyə çalışdığınız sətrə istinad edir.

## MERGE

PostgreSQL 15+ standart \`MERGE\`-i dəstəkləyir. O, mənbəni hədəfə tətbiq edir və hər sətir üçün nə ediləcəyinə qərar verir:

\`\`\`sql
MERGE INTO departments AS d
USING (VALUES (3, 3300000.00), (14, 100000.00)) AS v(department_id, budget)
ON d.department_id = v.department_id
WHEN MATCHED THEN UPDATE SET budget = v.budget
WHEN NOT MATCHED THEN INSERT (department_id, name, budget) VALUES (v.department_id, 'Dept ' || v.department_id, v.budget);
SELECT * FROM departments ORDER BY department_id;
\`\`\`

## Yaxşı vərdişlər və tələlər

- Əvvəlcə WHERE hissəsini \`SELECT\` kimi icra edin. Sonra onu UPDATE/DELETE-ə çevirin.
- NULL ilə hesab əməliyyatı NULL olaraq qalır: \`SET budget = budget + 1\` NULL büdcələri NULL saxlayır.
- \`numeric(10,2)\` sütununa yazmaq avtomatik olaraq 2 onluq rəqəmə yuvarlaqlaşdırır.
- Cədvəli boşaltmaq üçün \`TRUNCATE\` (2-ci mövzu) \`DELETE\`-dən sürətlidir, amma sətirləri filtrləyə bilmir.
- Real işdə əlaqəli dəyişiklikləri \`BEGIN … COMMIT\`-ə bükün ki, ya hamısı uğurlu olsun, ya da heç biri. Tətbiq bunu sizin üçün edir.`;

const topic: TopicText = {
  explanation,
  questions: {
    't03-q02': {
      title: 'Şöbə əlavə edin',
      prompt: `Yeni şöbə daxil edin: id **11**, ad **'Data Science'**, yer **'Berlin'**, büdcə **500000**.`,
      hints: ['`INSERT INTO departments (department_id, name, location, budget) VALUES (…)`'],
      explanation: `Sütunları adlandırın, sonra dəyərləri eyni sırada verin. Mətnə tək dırnaq lazımdır, ədədlərə yox.

Sütun siyahısını buraxmaq da işləyir, amma bu, səssizcə cədvəlin sütun sırasından asılı olur. Nə vaxtsa sütun əlavə olunarsa, statement ya pozulur, ya da dəyərləri yanlış yerə qoyur.`,
      commonMistakes: ['Mətn dəyərlərinin ətrafında qoşa dırnaq. Onlar identifikator deməkdir.', "Dəyərlərdə hərf səhvləri: müqayisələr dəqiqdir və 'berlin' ≠ 'Berlin'."],
    },
    't03-q03': {
      title: 'İki yeni təchizatçı',
      prompt: `İki təchizatçını **bu sırada** əlavə edin və onların \`supplier_id\`-sini verilənlər bazasının yaratmasına imkan verin:

| name | country_id | contact_email | rating | created_at |
|---|---|---|---|---|
| Nordwind Imports | 9 | orders@nordwind.example | *(yoxdur)* | 2025-06-30 |
| Pampas Supply | 5 | *(yoxdur)* | 4.5 | 2025-06-30 |`,
      hints: [`\`supplier_id\`-ni sadalamayın: identity sütunu onu özü doldurur.`, `Bir INSERT bir neçə sətir daşıya bilər: \`VALUES (…), (…)\`. "Yoxdur" üçün NULL işlədin.`],
      explanation: `- \`supplier_id\` \`GENERATED BY DEFAULT AS IDENTITY\`-dir. Onu sütun siyahısından çıxarın, növbəti nömrələr daxil etmə sırasına görə veriləcək.
- "Yoxdur" NULL-dur, \`0\` deyil və \`''\` deyil. Boş mətn dəyərdir. NULL isə "naməlum / verilməyib" deməkdir.
- Bir neçə sətir əlavə etməyin adi yolu tək çoxsətirli INSERT-dir və o, atomikdir: ya bütün sətirlər, ya heç biri.`,
      commonMistakes: ["Çatışmayan dəyərlər üçün NULL əvəzinə 0 və ya '' işlətmək.", 'Fərqli sırada daxil etmək: bu, yaradılan id-ləri dəyişdirir.'],
    },
    't03-q04': {
      title: 'RETURNING nə edir?',
      prompt: `\`UPDATE orders …\` statement-inə \`RETURNING order_id, status\` əlavə etmək nə edir?`,
      hints: ['RETURNING INSERT, UPDATE, DELETE və MERGE ilə işləyir.'],
      explanation: `\`RETURNING\` verilənləri dəyişən statement-in sətir də qaytarmasını təmin edir: təsirlənmiş sətirləri, dəyişiklikdən **sonrakı** dəyərləri ilə (DELETE üçün silinmiş sətirləri). İkinci SELECT-ə qənaət edir və INSERT-dən yaradılmış id-ləri geri almağın standart yoludur.`,
      commonMistakes: ['Köhnə dəyərləri gözləmək. Onlar üçün CTE və ya əvvəlcədən SELECT işlədin.'],
      options: [
        'UPDATE-in dəyişdiyi hər sətrin göstərilən sütunlarını yeni dəyərləri ilə qaytarır.',
        'Sətirlərin dəyişdirilməzdən *əvvəlki* göstərilən sütunlarını qaytarır.',
        'Heç bir sətir uyğun gəlməzsə, yeniləməni geri qaytarır.',
        'Yalnız INSERT ilə işləyir, ona görə də sintaksis xətası yaradır.',
      ],
    },
    't03-q05': {
      title: 'Şöbə büdcəsini artırın',
      prompt: `**Marketing** şöbəsinin büdcəsini **100 000** artırın. Başqa heç bir şöbə dəyişməməlidir.`,
      hints: ['`UPDATE departments SET budget = budget + 100000 WHERE …`'],
      explanation: `\`SET budget = budget + 100000\` köhnə dəyəri oxuyur və ona əlavə edir. WHERE dəyişikliyi bir sətirlə məhdudlaşdırır. WHERE olmadan artımı *bütün* şöbələr alardı (NULL büdcələr isə NULL qalardı).`,
      commonMistakes: ['WHERE-i unutmaq.', 'Əlavə etmək əvəzinə büdcəni 100000-ə *bərabər* etmək.'],
    },
    't03-q01': {
      title: 'Köhnə gözləmədə olan sifarişləri ləğv edin',
      prompt: `Müştəri dəstəyi tərk edilmiş checkout-ları bağlayır.

**Bir \`UPDATE\` statement-i** yazın ki, aşağıdakı hər sifariş üçün \`status\`-u \`'cancelled'\` etsin:

- hələ də \`status = 'pending'\` olan, **və**
- **1 iyun 2025-dən əvvəl** verilən, yəni \`ordered_at < '2025-06-01'\` (vaxt dəyərləri UTC-dədir).

Bütün digər sifarişlər, o cümlədən 1 iyun 2025-də və ya ondan sonra verilmiş gözləmədə olan sifarişlər dəyişməz qalmalıdır.

*Yoxlayıcı statement-inizi icra edir, sonra \`orders\` cədvəlini yoxlayır. Hər icra sonda geri qaytarılır, ona görə də istədiyiniz qədər cəhd edə bilərsiniz.*`,
      hints: [
        `Statement-in forması \`UPDATE orders SET … WHERE …\`-dir.`,
        `WHERE hissəsi AND ilə birləşdirilmiş iki şərt tələb edir: biri \`status\`, digəri \`ordered_at\` üzərində.`,
        `Hansı sətirləri dəyişəcəyinizi görmək üçün əvvəlcə \`SELECT order_id, status, ordered_at FROM orders WHERE status = 'pending'\` icra edin.`,
      ],
      explanation: `1. **Cədvəli və yeni dəyəri seçin:** \`UPDATE orders SET status = 'cancelled'\`.
2. **Sətirləri məhdudlaşdırın:** WHERE olmadan UPDATE cədvəldəki *hər* sətri dəyişir. Burada sətir hər iki şərti ödəməlidir, ona görə də onları AND ilə birləşdirin.
3. **Vaxt dəyərlərini diqqətlə müqayisə edin:** \`ordered_at\` \`timestamptz\`-dir. \`'2025-06-01'\` literalı sessiyanın saat qurşağında (burada UTC) 1 iyunun başlanğıcı, gecə yarısı kimi oxunur, ona görə də \`<\` məhz həmin gündən əvvəl verilmiş sifarişləri saxlayır.
4. **Nəticəni yoxlayın:** PostgreSQL \`UPDATE n\`, yəni dəyişən sətirlərin sayını bildirir. Əvvəl və sonra (eyni icrada) qısa \`SELECT status, count(*) FROM orders GROUP BY status\` bunu təsdiqləyir.`,
      commonMistakes: [
        'Tarix şərtini unutmaq: bu, cəmi bir neçə günlük gözləmədə olan sifarişləri də ləğv edir.',
        'Status şərtini unutmaq: bu, çatdırılmış sifarişləri də ləğv edir. UPDATE-in neçə sətrə təsir etdiyini həmişə yoxlayın.',
        `Dəyəri səhv yazmaq (\`'canceled'\`). \`orders.status\` üzərindəki CHECK constraint onu xəta ilə rədd edir.`,
      ],
    },
    't03-q06': {
      title: 'Satışdan çıxarılmış məhsulları arxivləşdirin',
      prompt: `Cədvəl yaradın və onu bir dəfəyə doldurun:

1. \`product_id integer PRIMARY KEY\`, \`sku text NOT NULL\`, \`discontinued_at date NOT NULL\` sütunları ilə **\`discontinued_products\`** yaradın.
2. Ona **\`discontinued_at\` tarixi olan hər məhsulu** köçürün.`,
      hints: [`\`INSERT INTO target (cols) SELECT cols FROM source WHERE …\` sorğunun sətirlərini daxil edir.`, `Yalnız \`discontinued_at IS NOT NULL\` olan məhsullar.`],
      explanation: `\`INSERT … SELECT\` sorğunun qaytardığı hər şeyi daxil edir. Bu, set-based-dir və sətirləri bir-bir daxil etməkdən xeyli sürətlidir.

SELECT-in sütunları INSERT sütun siyahısına adla yox, **mövqeyə görə** uyğunlaşdırılır. \`launched_at\`-i \`discontinued_at\` sütununa seçmək yanlış tarixləri rahatlıqla saxlayardı.`,
      commonMistakes: ['Yanlış tarix sütununu seçmək. Uyğunlaşdırma mövqeyə görədir.', 'Filtri unutmaq. Onda NOT NULL constraint tarixi olmayan məhsulları rədd edir.'],
    },
    't03-q07': {
      title: 'Çatışmayan göndərmə ölkələrini doldurun',
      prompt: `Bəzi sifarişlərin \`ship_country_id\` dəyəri yoxdur (NULL). Yalnız həmin sifarişlər üçün \`ship_country_id\`-ni **sifarişi verən müştərinin** \`country_id\` dəyərinə bərabər edin. Artıq göndərmə ölkəsi olan sifarişlər dəyişməməlidir.

*(Müştərinin ölkəsi də naməlumdursa, sifariş sadəcə NULL olaraq qalır.)*`,
      hints: [`PostgreSQL-in \`UPDATE … FROM customers c WHERE c.customer_id = orders.customer_id …\` yazılışı başqa cədvəldən dəyər oxuyur.`, 'Yeniləməni göndərmə ölkəsi olmayan sifarişlərlə məhdudlaşdıran şərti unutmayın.'],
      explanation: `1. \`UPDATE orders AS o … FROM customers AS c\` müştəri sətrini əlçatan edir.
2. \`WHERE c.customer_id = o.customer_id\` **join şərtidir**. Onsuz hər sifariş *bütün* müştərilərlə uyğunlaşdırılır və təsadüfi bir müştərinin ölkəsi yazılır.
3. \`AND o.ship_country_id IS NULL\` artıq ölkəsi olan sifarişləri qoruyur.

Alternativ correlated subquery işlədir (19-cu mövzu). Burada ekvivalentdir.`,
      commonMistakes: ['Join şərtini buraxmaq: bu, təsadüfi müştərinin ölkəsini yazır.', 'IS NULL filtrini buraxmaq: bu, real göndərmə ölkələrinin üzərinə yazır.'],
    },
    't03-q08': {
      title: 'Köhnə uğursuz ödənişləri təmizləyin',
      prompt: `**1 yanvar 2025-dən əvvəl** (\`paid_at < '2025-01-01'\`) edilmiş, \`status = 'failed'\` olan hər ödənişi silin. Bütün digər ödənişlər qalır.`,
      hints: ['`DELETE FROM payments WHERE … AND …`'],
      explanation: `Hər iki şərt ödənməlidir, ona görə də onları AND ilə birləşdirin. "1 yanvar 2025-dən əvvəl" \`paid_at < '2025-01-01'\`-dir və 31 dekabrın tamamını əhatə edir. \`<= '2024-12-31'\` ilə ehtiyatlı olun: vaxt dəyərində o, "31 dekabr **00:00**-a qədər" deməkdir və həmin günün ödənişlərini buraxır.`,
      commonMistakes: ['Bütün uğursuz ödənişləri silmək.', 'Yanlış hüdud ili işlətmək.', `Vaxt dəyərində \`<= '2024-12-31'\` işlətmək: bu, son günü buraxır.`],
    },
    't03-q09': {
      title: 'Şöbələri upsert edin',
      prompt: `Bu şöbə verilənlərini **tək INSERT … ON CONFLICT** statement-i ilə tətbiq edin:

| department_id | name | location | budget |
|---|---|---|---|
| 2 | Sales | Paris | 4500000 |
| 12 | Partnerships | Dublin | 800000 |

Həmin id ilə şöbə artıq mövcuddursa, **onun yerini və büdcəsini yeniləyin** (adını saxlayın). Əks halda onu daxil edin.`,
      hints: ['`INSERT … VALUES (…), (…) ON CONFLICT (department_id) DO UPDATE SET …`', `DO UPDATE daxilində \`EXCLUDED.col\` daxil etməyə çalışdığınız dəyərdir.`],
      explanation: `\`ON CONFLICT (department_id)\` toqquşa biləcək unikal açarı göstərir:

- 12 nömrəli şöbə hələ mövcud deyil, ona görə də adi qaydada daxil edilir;
- 2 nömrəli şöbə mövcuddur, ona görə də \`DO UPDATE\` əvəzində həmin sətri dəyişir. \`EXCLUDED.location\` və \`EXCLUDED.budget\` VALUES siyahısından toqquşmanı "uduzan" dəyərlərdir.

\`DO NOTHING\` 2 nömrəli şöbəni səssizcə ötürərdi. ON CONFLICT olmadan bütün statement təkrar açar xətası (23505) ilə uğursuz olur və sətirlərdən *heç biri* daxil edilmir.`,
      commonMistakes: ['Tapşırıq yeniləmə tələb etdiyi halda DO NOTHING.', 'Tələb olunan sütunların yalnız bir hissəsini yeniləmək.'],
    },
    't03-q10': {
      title: 'NULL büdcəyə əlavə etmək',
      prompt: `7 nömrəli şöbənin (Human Resources) büdcəsi 900000.00-dır. 9 nömrəli şöbənin (Procurement) büdcəsi **yoxdur** (NULL). Bu statement nə qaytarır?`,
      hints: ['NULL + 1 nədir?', 'Dəyəri dəyişməsə də, 9 nömrəli şöbə yenə yenilənirmi?'],
      explanation: `Hər iki sətir WHERE hissəsinə uyğun gəlir, ona görə də hər ikisi yenilənir və qaytarılır. 9 nömrəli şöbə üçün \`NULL + 1\` NULL-dur, ona görə də "yeni" dəyər yenə NULL-dur.

RETURNING yeniləmədən **sonrakı** dəyərləri göstərir: 900001.00 və NULL. Çatışmayan büdcəni 0 kimi qəbul etmək üçün \`SET budget = coalesce(budget, 0) + 1\` yazın (12-ci mövzu).`,
      commonMistakes: ['Hesab əməliyyatlarında NULL-un 0 kimi davrandığını düşünmək.', 'Dəyəri dəyişməyən sətirlərin qaytarılmadığını düşünmək.'],
    },
    't03-q11': {
      title: 'Düzəlt: bədii kitablara endirim',
      prompt: `Kitab mağazası **Fiction kateqoriyasındakı hər məhsula 10% endirim** istəyir (kateqoriya slug-ı \`'fiction'\`). Aşağıdakı statement xətasız işləyir, amma həddindən çox qiyməti dəyişir. Onu elə düzəldin ki, yalnız fiction məhsulları dəyişsin.

*(Qiymətlər \`numeric(10,2)\`-dir, ona görə də nəticə avtomatik olaraq qəpiyə yuvarlaqlaşdırılır.)*`,
      hints: ['Statement-i icra edin və bildirdiyi sətir sayına baxın. Neçə məhsul dəyişdi?', 'UPDATE … FROM hər məhsulu *öz* kateqoriyası ilə bağlayan şərt tələb edir.'],
      explanation: `\`UPDATE products … FROM categories WHERE categories.slug = 'fiction'\` yazılışında heç nə məhsulu kateqoriya ilə bağlamır. \`categories\`-dəki fiction sətri **hər** məhsula "uyğun gəlir", ona görə də bütün qiymətlər 10% düşür.

\`c.category_id = p.category_id\` join şərtini əlavə edin. İndi yalnız öz kateqoriyası Fiction olan məhsullar yenilənir. Alternativ kateqoriya id-sini tapan subquery ilə join-dən yayınır.`,
      commonMistakes: ['Yanlış sütun üzrə join etmək (məsələn, supplier_id).', 'UPDATE-dən sonra bildirilən sətir sayını yoxlamamaq.'],
    },
    't03-q12': {
      title: 'Alıcı olmayanların rəylərini silin',
      prompt: `**Heç vaxt heç bir sifariş verməmiş** (istənilən statusda) müştərinin yazdığı hər rəyi silin. Anonimləşdirilmiş hesabların rəyləri (\`customer_id\` NULL) **saxlanılmalıdır**.`,
      hints: [`"Heç vaxt sifariş verməyib" \`NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = reviews.customer_id)\` deməkdir.`, `\`reviews.customer_id\` NULL olduqda şərtinizin nə etdiyini düşünün.`],
      explanation: `\`NOT EXISTS (…)\` subquery həmin müştəri üçün heç bir sifariş tapmadıqda true olur.

NULL tələsi: anonimləşdirilmiş rəy üçün \`o.customer_id = NULL\` heç vaxt uyğun gəlmir, ona görə də \`NOT EXISTS\` **true** olur və rəy silinərdi. Əlavə \`r.customer_id IS NOT NULL\` onları saxlayır.

Maraqlıdır ki, \`NOT IN\` alternativi onları avtomatik saxlayır: \`NULL NOT IN (…)\` true deyil, NULL-dur, ona görə də sətir silinmir. (\`NOT IN\`-in *subquery* NULL qaytara bildikdə öz NULL tələsi var. \`orders.customer_id\` NOT NULL-dur, ona görə də burada təhlükəsizdir.)

Rəy yazanın *həmin məhsulu* almadığı rəyləri silmək fərqli, daha sərt qaydadır. Tapşırığı diqqətlə oxuyun.`,
      commonMistakes: ['Anonimləşdirilmiş rəyləri də silmək.', 'İstənilən sifariş əvəzinə konkret məhsulu yoxlamaq.'],
    },
    't03-q13': {
      title: 'Büdcə dəyişikliklərini MERGE ilə tətbiq edin',
      prompt: `Maliyyə şöbəsi bu büdcələri \`(department_id, budget)\` cütləri kimi göndərir:

\`(3, 3300000)\`, \`(9, 1200000)\`, \`(13, 250000)\`

Tək **MERGE** statement-i işlədin. Mövcud şöbələr **yeni büdcəni** alır (adı və yeri dəyişmir). Naməlum id-lər \`'New department <id>'\` adı (məsələn, \`'New department 13'\`) ilə və yer olmadan **daxil edilir**.`,
      hints: ['`MERGE INTO departments d USING (VALUES …) AS v(department_id, budget) ON d.department_id = v.department_id`', `İki budaq: \`WHEN MATCHED THEN UPDATE …\` və \`WHEN NOT MATCHED THEN INSERT …\`.`, `Adı \`'New department ' || v.department_id\` ilə qurun.`],
      explanation: `MERGE **mənbəni** (burada daxili VALUES cədvəli) \`ON\` şərti üzrə **hədəflə** müqayisə edir və hər mənbə sətrini emal edir:

- **WHEN MATCHED:** şöbə mövcuddur, ona görə də yalnız büdcəni yeniləyin.
- **WHEN NOT MATCHED:** həmin id ilə şöbə yoxdur, ona görə də onu daxil edin. \`||\` mətni və ədədi birləşdirir (ədəd avtomatik çevrilir).

\`INSERT … ON CONFLICT DO UPDATE\` burada eyni yekun vəziyyətə gətirir. MERGE daha ümumidir: uyğun gələn sətirləri DELETE də edə bilər və təkcə unikal açar üzrə yox, istənilən şərt üzrə uyğunlaşdıra bilər.`,
      commonMistakes: ['NOT MATCHED budağını unutmaq: onda 13 nömrəli şöbə heç vaxt yaradılmır.', 'Mövcud şöbələrin adının üzərinə yazmaq.'],
    },
    't03-q14': {
      title: 'Tarixçə ilə illik maaş artımı',
      prompt: `**Sales** şöbəsinin (\`department_id = 2\`, \`termination_date IS NULL\`) hər **aktiv** işçisi **3% artım** alır, **ən yaxın 500-ə** yuvarlaqlaşdırılmış: yeni maaş = \`round(salary * 1.03 / 500) * 500\`.

\`salary_history\`-ni də uyğun saxlayın:

1. Hər təsirlənmiş işçinin hazırkı dövrünü (\`effective_to IS NULL\` olanı) \`effective_to = '2025-06-30'\` təyin edərək bağlayın.
2. \`effective_from = '2025-07-01'\`, NULL \`effective_to\`, yeni maaş və \`change_reason = 'annual review'\` ilə yeni dövr daxil edin.
3. \`employees.salary\`-ni yeni maaşa yeniləyin.

Nə qədər statement lazımdırsa, işlədin.`,
      hints: ['Sıra vacibdir. Əvvəlcə işçiləri yeniləsəniz, sonra yeni maaşı tarixçəyə köçürə bilərsiniz.', `Tarixçəyə daxil etmə \`INSERT … SELECT … FROM employees WHERE …\` ola bilər.`, 'Yeni açıq dövrləri daxil etməzdən **əvvəl** köhnələri bağlayın, yoxsa WHERE effective_to IS NULL yeni sətirlərə də uyğun gələcək.'],
      explanation: `Real dəyişikliklər çox vaxt bir neçə cədvələ toxunur və statement-lər onları uyğun saxlamalıdır:

1. **Artım:** \`round(salary * 1.03 / 500) * 500\` ən yaxın 500-ün qatına yuvarlaqlaşdırır (böl, yuvarlaqlaşdır, geri vur).
2. **Açıq dövrü bağlayın:** UPDATE … FROM tarixçə dəyişikliyini aktiv Sales işçiləri ilə məhdudlaşdırır. \`effective_to IS NULL\` hər birinin hazırkı dövrünü seçir.
3. **Yeni dövrü açın:** INSERT … SELECT (artıq artırılmış) maaşı köçürür.

Statement-lərin sırası vacibdir. Dövrləri yeniləri daxil etdikdən *sonra* bağlamaq yeniləri də bağlayardı. İşdən çıxmış Sales işçilərinə toxunmaq olmaz, buna görə də hər statement eyni filtri təkrarlayır.

Real mühitdə hər üçü bir transaction daxilində icra olunardı ki, ya hamısı baş versin, ya heç biri.`,
      commonMistakes: ['Köhnə dövrü bağlamağı unutmaq: bu, iki açıq dövr qoyur.', 'Yuvarlaqlaşdırma qaydasını buraxmaq.', 'İşdən çıxmış işçilərə də artım vermək.'],
    },
    't03-q15': {
      title: 'Tam təkrarlanan import sətirlərini silin',
      prompt: `\`staging_customer_import\` **tam təkrarlanan** sətirlər ehtiva edir: \`import_row_id\`-dən başqa bütün sütunlar eynidir (\`source_file\`, \`imported_at\`, \`full_name\`, \`email\`, \`phone\`, \`signup_date_raw\`, \`country_raw\`, \`lifetime_value_raw\`). Eyni sütundakı iki NULL eyni sayılır.

Təkrarları silin, hər eyni qrupdan **yalnız \`import_row_id\`-si ən kiçik olan sətri saxlayın**.`,
      hints: [`Self-join: \`DELETE FROM staging_customer_import a USING staging_customer_import b WHERE …\`.`, `Id-si *daha kiçik* olan eyni \`b\` sətri mövcud olduqda \`a\`-nı silin.`, `İki NULL üçün \`=\` heç vaxt true deyil. NULL-ları bərabər sayan \`IS NOT DISTINCT FROM\` işlədin.`],
      explanation: `"Təkrarları sil, amma birini saxla" çox geniş yayılmış müsahibə tapşırığıdır. Üç yaxşı həll:

1. **DELETE … USING ilə self-join** (nümunə həll): id-si daha kiçik olan eyni \`b\` sətri mövcud olduqda \`a\` sətrini silin. Yalnız hər qrupun ən kiçik id-sinin daha kiçik "əkizi" olmur, ona görə də o qalır.
2. **Hər qrup üzrə minimumu saxlamaq** (1-ci alternativ): bütün biznes sütunlarına görə GROUP BY edib \`min(import_row_id)\`-ni saxlayın. GROUP BY NULL-ları bərabər sayır, ona görə də NULL-ları düzgün emal edir.
3. **ROW_NUMBER** (2-ci alternativ, 17-ci mövzu): hər qrup daxilində sətirləri nömrələyin və nömrəsi > 1 olanları silin.

Tələlər: hər iki tərəf NULL olduqda \`=\` NULL qaytarır, ona görə də telefonu və ya e-poçtu çatışmayan təkrarlar salamat qalardı. \`IS NOT DISTINCT FROM\` işlədin. Bundan başqa \`<\` əvəzinə \`<>\` ilə müqayisə **bütün** nüsxələri silir, çünki hər sətrin id-si fərqli olan əkizi var.`,
      commonMistakes: ['Sütunları = ilə müqayisə etmək (NULL-lar heç vaxt uyğun gəlmir).', '< əvəzinə <> işlətmək: bu, saxlanılmalı olan da daxil, bütün nüsxələri silir.'],
    },
    't03-q16': {
      title: 'Az ödənilmiş sifarişləri uzlaşdırın',
      prompt: `Bir neçə **çatdırılmış** sifarişdə capture olunmuş ödənişlər sifariş dəyərini tutmur. Sifariş dəyəri \`ROUND(SUM(quantity * unit_price * (1 - discount)) + shipping_fee, 2)\`-dir, capture olunmuş məbləğ isə sifarişin \`status = 'captured'\` olan ödənişlərinin cəmidir.

**Capture olunmuş məbləği sifariş dəyərindən az olan hər çatdırılmış sifariş üçün** bir ödəniş daxil edin:

- \`amount\` = sifariş dəyəri − capture olunmuş məbləğ
- \`method\` = \`'bank_transfer'\`, \`status\` = \`'captured'\`, \`paid_at\` = \`'2025-06-30 12:00:00+00'\`

\`payment_id\`-ni verilənlər bazasının yaratmasına imkan verin.`,
      hints: ['Sifariş dəyərlərini və capture olunmuş cəmləri hər sifariş üzrə iki aqreqatda (CTE və ya subquery) hesablayın, sonra onları join edin.', `\`INSERT INTO payments (order_id, paid_at, method, amount, status) SELECT …\` nəticəni daxil edir.`, `Yalnız \`status = 'delivered'\` və müsbət fərqi olan sifarişlər.`],
      explanation: `Məsələni adlandırılmış addımlara bölmək onu idarə olunan edir:

1. **order_value:** çatdırılmış sifarişlərin sətir dəyərlərini cəmləyin və göndərmə haqqını hər sifarişə *bir dəfə* əlavə edin. Haqq \`orders\`-in sütunudur, ona görə də SUM-un içinə yox, GROUP BY-a gedir.
2. **captured:** yalnız \`status = 'captured'\` olan ödənişləri cəmləyin. Uğursuz cəhdlər və geri qaytarmalar sayılmamalıdır.
3. **Join və müqayisə:** \`paid < value\` olan sifarişləri saxlayın və fərqi yeni ödəniş kimi daxil edin.

CTE (\`WITH … INSERT …\`) addımları yuxarıdan aşağıya yazmağa imkan verir. CTE-ləri 20-ci mövzu əhatə edir. Yoxlayıcı daxil edilmiş sətirləri və ödənişlərin ümumi sayını müqayisə edir, ona görə də artıq və ya təkrar sətirlər daxil etmək də aşkarlanır.`,
      commonMistakes: ['Sifariş dəyərində göndərmə haqqını unutmaq.', 'Uğursuz və ya geri qaytarılmış ödənişləri ödənilmiş saymaq.', 'Tərsinə çıxmaq: bu, mənfi məbləğlər verir (payments.amount üzərindəki CHECK onları rədd edir).', 'Haqqı SUM-un içinə əlavə etmək: bu, onu sətirlərin sayına vurur.'],
    },
  },
};

export default topic;
