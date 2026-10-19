import type { TopicText } from '../../i18n.ts';

const explanation = `**View** saxlanılmış, adlandırılmış sorğudur. Ondan seçim etmək sorğunu həmin anda işə salır, ona görə də o, həmişə cari verilənləri əks etdirir və öz sətirlərini saxlamır.

\`\`\`sql
CREATE VIEW active_staff AS
SELECT employee_id, first_name, last_name, department_id, salary
FROM employees
WHERE termination_date IS NULL;

SELECT department_id, count(*) AS people
FROM active_staff
GROUP BY department_id
ORDER BY department_id;
\`\`\`

(Bu tətbiqdə hər işə salma geri qaytarılır (rollback), ona görə də view sonradan yox olur. Real verilənlər bazasında o, silinənə qədər qalır.)

## Niyə view-lar işlədilir

- **Təkrar istifadə:** biznes qaydasını ("aktiv", "gəlir", "VIP müştəri") hər sorğuya köçürmək əvəzinə bir dəfə təyin edin.
- **Sadələşdirmə:** join-ləri və hesablamaları sadə, cədvələ bənzər adın arxasında gizlədin. View-lar başqa view-ların üzərində qurula bilər.
- **Məhdudlaşdırma:** cədvələ giriş vermədən rola yalnız bəzi sütunları və ya sətirləri göstərin.

## View-ların idarə edilməsi

\`\`\`text
CREATE VIEW name [(col, …)] AS query [WITH [CASCADED | LOCAL] CHECK OPTION];
CREATE OR REPLACE VIEW name AS query;   -- eyni sütunlar, eyni sıra; yeni sütunlar yalnız sonda
ALTER VIEW name RENAME TO new_name;
DROP VIEW [IF EXISTS] name [CASCADE];
\`\`\`

- View-un sütun siyahısı yaradılanda sabitlənir. View-dakı \`SELECT *\` **yaradılma anında** açılır: cədvələ sonradan əlavə edilən sütunlar görünmür.
- Asılı view-ları olan cədvəli (və ya onun işlədilən sütununu) silmək olmaz, əgər \`CASCADE\` əlavə etməsəniz. O, view-ları da silir.

## Yenilənə bilən view-lar

**Sadə** view (FROM-da bir cədvəl, GROUP BY, DISTINCT, aqreqatlar, window function-lar, set əməliyyatları və ya LIMIT yoxdur) avtomatik yenilənə biləndir: onun üzərində INSERT, UPDATE və DELETE əsas cədvələ tətbiq olunur.

Standart olaraq sətri view-un WHERE şərtindən **kənara** yeniləyə və ya view-un heç vaxt göstərməyəcəyi sətri əlavə edə bilərsiniz. \`WITH CHECK OPTION\` bunu qadağan edir: yeni sətir view-un şərtini ödəməlidir, əks halda əmr uğursuz olur (SQLSTATE 44000).

\`\`\`sql
-- ERROR: new row violates check option
CREATE VIEW cheap AS
SELECT product_id, name, price FROM products WHERE price < 20
WITH CHECK OPTION;

UPDATE cheap SET price = 50
WHERE product_id = (SELECT min(product_id) FROM cheap);
\`\`\`

## Materialized view-lar

\`CREATE MATERIALIZED VIEW name AS query\` sorğunu **bir dəfə** işə salır və nəticəni cədvəl kimi saxlayır. Oxumaq sürətlidir və onu indeksləyə bilərsiniz, amma verilənlər snapshot-dur. O, yalnız \`REFRESH MATERIALIZED VIEW name\` ilə yenilənir.

- \`REFRESH … CONCURRENTLY\` oxuyuculara yeniləmə zamanı köhnə verilənləri işlətməyə davam etməyə imkan verir, amma materialized view üzərində **unikal indeks** tələb edir.
- Onları bir qədər köhnəlmiş ola bilən baha başa gələn hesabatlar (gündəlik dashboard-lar) üçün işlədin. Verilənlər aktual olmalıdırsa, adi view-lar işlədin.`;

const topic: TopicText = {
  explanation,
  questions: {
    't21-q01': {
      title: 'Aktiv işçilərin view-u',
      prompt: `\`employee_id\`, \`first_name\`, \`last_name\`, \`department_id\`, \`salary\` sütunları ilə (bu sırada), yalnız **hələ işləyən** işçiləri göstərən **\`active_employees\`** view-u yaradın.`,
      hints: ['`CREATE VIEW active_employees AS SELECT … FROM employees WHERE …`', 'Hələ işləyir = işdən çıxma tarixi yoxdur.'],
      explanation: `View sadəcə adlandırılmış SELECT-dir. Yoxlayıcı view-un sütun siyahısını kataloqdan, sonra isə onun qaytardığı hər sətri oxuyur. View-un sütunlarının sabit sırası və adları var, ona görə də verilənlər "hamısı yerində" olsa belə, onlardan ikisinin yerini dəyişmək başqa view-dur.`,
      commonMistakes: ['WHERE bəndini unutmaq.', 'Sütunlar fərqli sırada.'],
    },
    't21-q02': {
      title: 'View nəyi saxlayır?',
      prompt: `\`orders\` üzərində (adi) view yaradırsınız, sonra cədvələ yeni sifarişlər əlavə edirsiniz. View sonradan nə qaytarır?`,
      hints: ['Materialized view ilə müqayisə edin.'],
      explanation: `Adi view **heç bir verilən** saxlamır, yalnız öz tərifini. Ona qarşı hər sorğu tərifi cari cədvəllərə qarşı işə salır. **Materialized** view isə nəticəni saxlayır və dəyişiklikləri görmək üçün \`REFRESH MATERIALIZED VIEW\` tələb edir.`,
      commonMistakes: ['Adi və materialized view-ları qarışdırmaq.'],
      options: [
        'View yaradılanda olduğu kimi sətirləri, siz onu yeniləyənə qədər',
        'Yeni sifarişlər daxil olmaqla cari sətirləri: view yalnız öz sorğusunu saxlayır, o da hər dəfə işlədiləndə işə düşür',
        'View yenidən yaradılana qədər xəta',
        'Yalnız yeni sifarişləri',
      ],
    },
    't21-q03': {
      title: 'View-lar öz cədvəllərini izləyir',
      prompt: `**Son** əmr nə qaytarır?`,
      hints: ['View-un sorğusu yaradılanda yox, ondan seçim etdikdə işləyir.'],
      explanation: `View yaradılanda yalnız ben uyğun gəlirdi, amma bunun əhəmiyyəti yoxdur: view öz sorğusunu **indi** işə salır. İndi cleo-nun 20, ben-in isə 3 xalı var, ona görə də yalnız cleo qaytarılır.`,
      commonMistakes: ['View-un sətirləri yaradılma anında tutduğunu düşünmək.'],
    },
    't21-q04': {
      title: 'Müştəri sifariş xülasəsi',
      prompt: `Sifariş vermiş (istənilən status) hər müştəri üçün bir sətirli **\`customer_order_summary\`** view-u yaradın:

| sütun | mənası |
|---|---|
| \`customer_id\` | müştəri |
| \`orders\` | sifarişlərin sayı |
| \`first_order\` | ilk sifarişin tarixi (UTC), \`date\` tipi |
| \`last_order\` | ən son sifarişin tarixi (UTC), \`date\` tipi |`,
      hints: ['customer_id üzrə GROUP BY, `count(*)`, `min(ordered_at)::date`, `max(ordered_at)::date`.'],
      explanation: `View-lar aqreqatlar daxil olmaqla istənilən sorğunu ehtiva edə bilər. Sütun **tipləri** view-un tərifinin bir hissəsidir: \`::date\` cast-ları olmadan \`first_order\` və \`last_order\` timestamp olardı. Tapşırıq istənilən status deyir, ona görə də ləğv edilmiş sifarişlər sayılır.`,
      commonMistakes: ['Tarixləri timestamp kimi saxlamaq.', 'Ləğv edilmiş sifarişləri filtrləmək.'],
    },
    't21-q05': {
      title: 'Aylıq gəlir view-u',
      prompt: `\`month\` (\`date\` tipi, ayın ilk günü, UTC) və \`revenue\` (**ləğv edilməmiş** sifarişlərin \`quantity * unit_price * (1 - discount)\` sətir dəyərlərinin cəmi, **2 onluq rəqəmə yuvarlaqlaşdırılmış**) sütunları ilə, sifarişi olan hər ay üçün bir sətirli **\`monthly_revenue\`** view-u yaradın.`,
      hints: ['orders və order_items-i join edin, filtrləyin, `GROUP BY 1`.', 'Yuvarlaqlaşdırmanı view-un içinə qoyun.'],
      explanation: `View-ların mövcud olmasının əsas səbəbi budur: "gəlir" tərifi (hansı statuslar sayılır, endirimlər necə tətbiq olunur) **bir** yerdə yaşayır. \`monthly_revenue\`-dən seçim edən hər hesabat eyni qaydanı işlədir və qaydanı düzəltmək hamısını düzəldir.`,
      commonMistakes: ['Ləğv edilmiş sifarişləri daxil etmək.', 'Endirimi nəzərə almamaq.'],
    },
    't21-q06': {
      title: 'View vasitəsilə yeniləmə',
      prompt: `1. **Satışdan çıxarılmamış** məhsulları göstərən, \`product_id\`, \`category_id\`, \`name\`, \`price\` sütunlu **\`on_sale_products\`** view-u yaradın.
2. Sonra **view vasitəsilə** onda \`category_id = 8\` (monitorlar) olan hər məhsulun qiymətini **10%** azaldın, 2 onluq rəqəmə yuvarlaqlaşdırılmış.`,
      hints: ['Aqreqatları olmayan bir cədvəlli view avtomatik yenilənə biləndir.', '`UPDATE on_sale_products SET price = round(price * 0.9, 2) WHERE category_id = 8;`'],
      explanation: `PostgreSQL sadə view-ları **avtomatik yenilənə bilən** edir: view üzərində UPDATE \`products\` üzərində UPDATE-ə çevrilir və yalnız **view vasitəsilə görünən** sətirlər təsirlənir. Satışdan çıxarılmış monitorlar öz qiymətini saxlayır.

Cədvəli eyni filtrlə birbaşa yeniləmək eyni effekti verir, amma view-un şərtini özünüz təkrarlamalısınız. View-ların qarşısını aldığı təkrarçılıq məhz budur. "10% azaldın" 0.1-ə yox, 0.9-a vurmaq deməkdir.`,
      commonMistakes: ['Cədvəli view-un şərti olmadan yeniləmək.', '0.1-ə vurmaq.'],
    },
    't21-q07': {
      title: 'Düzəlt: view-a sütun əlavə etmək',
      prompt: `Birinci əmr view yaradır. İkinci ona müştərilərin \`email\`-ini əlavə etməlidir, amma *cannot change name of view column* ilə uğursuz olur. Skripti elə düzəldin ki, son view-un \`customer_id\`, \`first_name\`, \`last_name\`, \`email\` sütunları bu sırada olsun.`,
      hints: ['CREATE OR REPLACE VIEW mövcud sütunları (eyni adlar, tiplər və sıra) saxlamalıdır. Yeni sütunlar yalnız **sona əlavə edilə** bilər.'],
      explanation: `\`CREATE OR REPLACE VIEW\` sorğunu əvəz edir, amma view-un kimliyini saxlayır, ona görə də ondan asılı olan digər obyektlər işləməyə davam edir. Bu, yalnız mövcud sütunlar olduğu kimi qaldıqda təhlükəsizdir. Sütunları **sona əlavə edə** bilərsiniz, amma onların adını, sırasını, tipini dəyişə və ya silə bilməzsiniz.

Daha böyük dəyişikliklər üçün \`DROP VIEW\` edin və yenidən \`CREATE VIEW\` edin (digər view-lar ondan asılıdırsa, \`CASCADE\` ilə, onları da yenidən yaradaraq).`,
      commonMistakes: ['Yeni sütunu ortaya daxil etmək.', 'Silib yanlış sütun sırası ilə yenidən yaratmaq.'],
    },
    't21-q08': {
      title: 'Ucuz məhsulları ucuz saxlayın',
      prompt: `Qiyməti **20-dən aşağı** olan məhsulları göstərən, \`product_id\`, \`name\`, \`price\` sütunlu **\`cheap_products\`** view-u yaradın. View vasitəsilə yeniləmələr məhsulu view-dan kənara çıxara **bilməməlidir** (məsələn, qiymətini 20 və ya daha çoxa qaldırmaq).`,
      hints: ['`… WHERE price < 20 WITH CHECK OPTION`'],
      explanation: `Check option olmadan \`UPDATE cheap_products SET price = 25 …\` uğurlu olur və məhsul view-dan səssizcə yox olur. \`WITH CHECK OPTION\` PostgreSQL-i view vasitəsilə əlavə edilən və ya yenilənən hər sətrin hələ də onun WHERE-ini ödədiyini yoxlamağa və əks halda rədd etməyə məcbur edir (SQLSTATE 44000).

"20-dən aşağı" 20-nin özünü xaric edir, ona görə də \`price <= 20\` məhsulun düz 20-yə qaldırılmasına imkan verərdi.`,
      commonMistakes: ['WITH CHECK OPTION-ı unutmaq.', '< əvəzinə <=.'],
    },
    't21-q09': {
      title: 'View-da SELECT *',
      prompt: `**Son** əmr nə qaytarır?`,
      hints: ['View-un `*`-ı nə vaxt açılır?'],
      explanation: `View tərifindəki \`SELECT *\` **view yaradılanda** sütun siyahısına açılır. View \`SELECT pets.name FROM pets\` kimi saxlanılır, ona görə də sonradan əlavə edilən sütun onun bir hissəsi deyil. Onu daxil etmək üçün view-u yenidən yaradın (və ya sütunu sona əlavə edərək \`CREATE OR REPLACE\` edin).`,
      commonMistakes: ['View-un yeni sütunları götürəcəyini gözləmək.'],
    },
    't21-q10': {
      title: 'Materialized kateqoriya hesabatı',
      prompt: `\`category_id\` və \`revenue\` (həmin kateqoriyadakı məhsullar üçün ləğv edilməmiş sifarişlərin sətir dəyərlərinin cəmi, **2 onluq rəqəmə yuvarlaqlaşdırılmış**) sütunları ilə, satışı olan hər kateqoriya üçün bir sətirli **materialized view** \`category_revenue\` yaradın.`,
      hints: ['`CREATE MATERIALIZED VIEW category_revenue AS SELECT …`'],
      explanation: `Materialized view öz sorğusunu yaradılanda bir dəfə işə salır (\`WITH DATA\` standartdır) və nəticəni saxlayır. Onu oxumaq kiçik cədvəli oxumaq qədər ucuzdur, bu da böyük join-lər üzərindəki hesabatlara uyğundur. Bunun müqabilində verilənlər \`REFRESH MATERIALIZED VIEW category_revenue\`-ə qədər dondurulur.

Yoxlayıcı \`pg_class\`-da relation-un növünə baxır: materialized view üçün \`m\`, adi view üçün \`v\`.`,
      commonMistakes: ['Adi view yaratmaq.', 'Ləğv edilmiş sifarişləri daxil etmək.'],
    },
    't21-q11': {
      title: 'Köhnəlmiş snapshot',
      prompt: `**Son** əmr nə qaytarır?`,
      hints: ['Materialized view yalnız yeniləndikdə dəyişir. Adi view hər oxunuşda hesablanır.'],
      explanation: `Materialized view yaradılanda 2 sətir saydı və yeniləmədən əvvəl hələ də 2 deyirdi (\`snapshot\`-a köçürülüb). Yeniləmə onun sorğusunu 4 sətir olanda yenidən işə saldı. 5-ci sətir sonra gəldi, ona görə də o, hələ də **4** deyir. Adi view həmişə cari sətirləri sayır: **5**.`,
      commonMistakes: ['Materialized view-un özünü yeniləyəcəyini gözləmək.', 'Adi view-un keşləndiyini gözləmək.'],
    },
    't21-q12': {
      title: 'View üzərində view',
      prompt: `İki view yaradın:

1. **\`customer_spend\`**: \`customer_id\`, \`orders\` (ləğv edilməmiş sifarişlərin sayı), \`spend\` (onların sətir dəyərlərinin cəmi, 2 onluq rəqəmə yuvarlaqlaşdırılmış), ləğv edilməmiş sifarişi olan hər müştəri üçün bir sətir.
2. **\`vip_customers\`**: xərci **ən azı 5 000** olan müştərilər üçün \`customer_id\`, \`spend\`, **\`customer_spend\`-in üzərində** qurulmuş.`,
      hints: ['Sətirləri join etdikdən sonra sifarişləri `count(DISTINCT o.order_id)` ilə sayın.', '`CREATE VIEW vip_customers AS SELECT customer_id, spend FROM customer_spend WHERE spend >= 5000;`'],
      explanation: `View-lar birləşdirilə bilir: \`vip_customers\` \`customer_spend\`-dən xərc qaydasını təkrar işlədir, ona görə də "xərc" tərifi bir yerdə yaşayır. PostgreSQL ondan seçim etdikdə iç-içə view-ları bir sorğuya açır.

Birinci view-u təkrar işlətmək əvəzinə \`vip_customers\` daxilində xərci yenidən hesablamaq qaydaların bir-birindən uzaqlaşmasının yoludur: yuxarıdakı nüsxə ləğv filtrini unudub. Birinci view-dakı tələ dənəvərlikdir (grain): sifariş sətirlərini join etdikdən sonra \`count(*)\` **sətirləri** sayır. \`count(DISTINCT o.order_id)\` işlədin.`,
      commonMistakes: ['Sifariş sətirlərini join etdikdən sonra count(*).', 'Birincini təkrar işlətmək əvəzinə ikinci view-da xərci yenidən hesablamaq.'],
    },
    't21-q13': {
      title: 'View-un işlətdiyi cədvəli silmək',
      prompt: `\`monthly_revenue\` view-u \`orders\` və \`order_items\`-dən seçim edir. \`DROP TABLE order_items;\` zamanı nə baş verir?`,
      hints: ['PostgreSQL obyektlər arasındakı asılılıqları izləyir.'],
      explanation: `PostgreSQL view-un cədvəldən asılı olduğunu qeyd edir (\`pg_depend\`-də) və view mövcud olduğu müddətdə cədvəli silməkdən imtina edir: *cannot drop table order_items because other objects depend on it*. \`CASCADE\` asılı view-ları da silir, bu, rahatdır, amma peşman olmaq asandır. Eyni qoruma view-un işlətdiyi sütunun \`ALTER TABLE … DROP COLUMN\`-una da aiddir.`,
      commonMistakes: ['Bəzi digər verilənlər bazalarında olduğu kimi, view-ların səssizcə pozulduğunu düşünmək.'],
      options: [
        'Cədvəl silinir və view növbəti dəfə işlədiləndə xəta qaytarır',
        'Cədvəl silinir və view heç bir sətir qaytarmır',
        'DROP uğursuz olur, çünki view cədvəldən asılıdır. `DROP TABLE order_items CASCADE` view-u da silərdi.',
        'View verilənlərin nüsxəsini saxlayır, ona görə də işləməyə davam edir',
      ],
    },
    't21-q14': {
      title: 'Hər müştərinin ən son sifarişi',
      prompt: `Hər müştəri üçün bir sətirli **\`latest_orders\`** view-u yaradın: onun **ən son** sifarişi (\`ordered_at\` üzrə; iki sifariş vaxt dəyərini paylaşırsa, daha böyük \`order_id\`), \`customer_id\`, \`order_id\`, \`ordered_at\`, \`status\` sütunları ilə.`,
      hints: ['`DISTINCT ON (customer_id) … ORDER BY customer_id, ordered_at DESC, order_id DESC`', 'Və ya subquery-də `row_number()`, rn = 1-i saxlayaraq.'],
      explanation: `"Hər qrupda ən son sətir" view-un arxasında gizlətməyə dəyər pattern-dir. DISTINCT ON verilmiş sırada hər müştərinin ilk sətrini saxlayır, ona görə də sıra vaxta görə **azalan** olmalıdır.

Hər sütunun \`max()\`-ını ayrıca götürmək fərqli sifarişlərin dəyərlərini qarışdırır: ən böyük \`order_id\`, ən gec vaxt və əlifba sırası ilə sonuncu status eyni sifarişə aid olmaya bilər.`,
      commonMistakes: ['İlk sifarişi saxlayan artan sıra.', 'Sətirləri qarışdıran sütun üzrə max().'],
    },
    't21-q15': {
      title: 'Yenilənə bilən gündəlik satış snapshot-u',
      prompt: `\`day\` (\`date\` tipi, UTC), \`orders\` (həmin gün ləğv edilməmiş sifarişlərin sayı) və \`revenue\` (onların sətir dəyərləri, 2 onluq rəqəmə yuvarlaqlaşdırılmış) sütunları ilə **materialized view** \`daily_sales\` yaradın. Onu \`REFRESH MATERIALIZED VIEW CONCURRENTLY daily_sales\` ilə yeniləməyi mümkün edin, bu da materialized view üzərində, burada \`day\` üzrə, **unikal indeks** tələb edir.`,
      hints: ['Sifarişləri `count(DISTINCT o.order_id)` ilə sayın.', '`CREATE UNIQUE INDEX ON daily_sales (day);`'],
      explanation: `Adi \`REFRESH MATERIALIZED VIEW\` yenidən qurularkən view-u oxunuşlara qarşı kilidləyir. \`CONCURRENTLY\` yeni nəticəni kənarda qurur və fərqləri tətbiq edir, ona görə də oxuyucular heç vaxt bloklanmır. Köhnə və yeni sətirləri uyğunlaşdırmaq üçün ona hər sətri əhatə edən **unikal indeks** lazımdır (adi indeks kifayət deyil).

Materialized view-lar üzərindəki indekslər \`WHERE day = …\` kimi axtarışları da sürətləndirir. Sifariş sətirlərində həmişə olduğu kimi: fərqli sifarişləri sayın.`,
      commonMistakes: ['Unikal olmayan indeks, ona görə də CONCURRENTLY işləməkdən imtina edir.', 'Sifariş sətirlərini saymaq.'],
    },
    't21-q16': {
      title: 'RFM view-u',
      prompt: `Marketinq **ləğv edilməmiş** sifarişi olan hər müştəri üçün bir sətirli **\`customer_rfm\`** view-u istəyir:

| sütun | mənası |
|---|---|
| \`customer_id\` | müştəri |
| \`recency_days\` | onların ən son ləğv edilməmiş sifarişindən (UTC tarixi) istinad tarixi **2025-06-30**-a qədər günlər (integer) |
| \`frequency\` | ləğv edilməmiş sifarişlərin sayı |
| \`monetary\` | həmin sifarişlərin ümumi sətir dəyəri, 2 onluq rəqəmə yuvarlaqlaşdırılmış |`,
      hints: ['Əvvəlcə hər sifariş üzrə aqreqasiya edin (və ya fərqli sifarişləri sayın), sonra hər müştəri üzrə.', `\`DATE '2025-06-30' - max(ordered_at)::date\` integer-dir.`],
      explanation: `RFM (recency, frequency, monetary) standart müştəri seqmentləşdirmə girişidir və view üçün yaxşı namizəddir: analitiklər onu daim sorğulayır və o, hər yerdə eyni olmalı olan bir neçə qərarı (hansı sifarişlər sayılır, istinad tarixi, pul düsturu) ifadə edir.

View CTE ehtiva edə bilər. Recency **ən son** sifarişi (\`max\`) işlədir. Frequency sətirləri yox, sifarişləri sayır, sifariş dəyərlərinin əvvəlcə qurulmasının səbəbi budur.`,
      commonMistakes: ['Sətirləri frequency kimi saymaq.', 'Recency üçün ilk sifarişi işlətmək.'],
    },
  },
};

export default topic;
