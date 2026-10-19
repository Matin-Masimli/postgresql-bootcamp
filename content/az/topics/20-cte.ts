import type { TopicText } from '../../i18n.ts';

const explanation = `**Common table expression** (CTE) subquery-ni əvvəlcədən \`WITH\` ilə adlandırır ki, əsas sorğu və sonrakı CTE-lər onu cədvəl kimi işlədə bilsin. CTE-lər dərin iç-içə sorğunu oxunaqlı addımlar ardıcıllığına çevirir.

\`\`\`sql
WITH order_value AS (
  SELECT o.order_id, o.customer_id,
         sum(oi.quantity * oi.unit_price * (1 - oi.discount)) AS value
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status <> 'cancelled'
  GROUP BY o.order_id
),
customer_value AS (            -- sonrakı CTE əvvəlkini işlədə bilər
  SELECT customer_id, count(*) AS orders, sum(value) AS spend
  FROM order_value
  GROUP BY customer_id
)
SELECT *
FROM customer_value
ORDER BY spend DESC
LIMIT 5;
\`\`\`

## Bilməyə dəyər qaydalar

- CTE yalnız aid olduğu **bir əmr** üçün mövcuddur.
- CTE-lər vergüllə ayrılır, \`WITH\` isə bir dəfə yazılır. Hər biri ondan **əvvəlkilərə** istinad edə bilər.
- CTE-yə bir neçə dəfə istinad edilə bilər. PostgreSQL bir dəfə işlədilən (və yan təsirləri olmayan) CTE-ni əsas sorğuya yerləşdirir (inline). Seçimi məcbur etmək üçün \`MATERIALIZED\` / \`NOT MATERIALIZED\` əlavə edin.
- CTE INSERT/UPDATE/DELETE … RETURNING ehtiva edə bilər (*data-modifying CTE*). Əmrin bütün hissələri **eyni snapshot**-u görür: əsas sorğu CTE-nin dəyişdirdiyi sətirləri görmür.

## Rekursiv CTE-lər

\`WITH RECURSIVE\` CTE-yə özünə istinad etməyə imkan verir. Onun \`UNION ALL\` (və ya \`UNION\`) ilə birləşdirilmiş iki hissəsi var:

\`\`\`text
WITH RECURSIVE name AS (
    <anchor>        -- başlanğıc sətirlər
  UNION ALL
    <recursive term> -- növbəti sətirləri yaratmaq üçün name-i join edir; heç nə yaratmadıqda dayanır
)
\`\`\`

PostgreSQL anchor-u işə salır, sonra recursive term-i **əvvəlki** addımda yaranan sətirlər üzərində təkrar-təkrar işə salır, ta ki addım heç nə qaytarmayana qədər.

\`\`\`sql
-- Kateqoriya ağacını köklərdən aşağıya doğru gəzin
WITH RECURSIVE tree AS (
  SELECT category_id, name, 1 AS depth, name::text AS path
  FROM categories
  WHERE parent_id IS NULL
  UNION ALL
  SELECT c.category_id, c.name, t.depth + 1, t.path || ' > ' || c.name
  FROM categories c
  JOIN tree t ON c.parent_id = t.category_id
)
SELECT * FROM tree
WHERE path LIKE 'Electronics%'
ORDER BY path;
\`\`\`

Tipik istifadələr: iyerarxiyalar (kateqoriyalar, təşkilat strukturları, tövsiyə zəncirləri), ardıcıllıqlar yaratmaq, qraf gəzintiləri.

### Tələlər

- **Dayanma.** Recursive term-ə sonda heç bir sətir yaratmayan şərt lazımdır (\`WHERE n < 10\` və ya bitən ağac). Dövri verilənlər \`UNION\` (təkrarlanan sətirləri atır), ziyarət edilmiş yol yoxlaması və ya PostgreSQL-in \`CYCLE\` bəndini tələb edir.
- **Tiplər uyğun gəlməlidir.** Anchor sütun tiplərini müəyyən edir. \`date + interval\` timestamp-dır, ona görə də date anchor-u üstəgəl interval addımı uğursuz olur. \`date + 1\` işlədin və ya cast edin.
- **İstiqamət.** \`child.parent_id = tree.id\` join-i **aşağı** gəzir. \`tree.parent_id = parent.id\` isə **yuxarı** gəzir.

\`\`\`sql
-- 2025-ci ilin iyununun ilk həftəsinin hər günü
WITH RECURSIVE days AS (
  SELECT DATE '2025-06-01' AS day
  UNION ALL
  SELECT day + 1 FROM days WHERE day < DATE '2025-06-07'
)
SELECT day FROM days;
\`\`\`

## CTE, yoxsa subquery?

Rekursiv olmayan sorğular üçün onlar bir-birini əvəz edə bilər. Addımları daha aydın etdikdə, eyni aralıq nəticə iki dəfə lazım olduqda və ya rekursiya lazım olduqda CTE işlədin. Birdəfəlik dəyər olduqda kiçik daxili subquery işlədin.`;

const topic: TopicText = {
  explanation,
  questions: {
    't20-q01': {
      title: 'Ortadan yuxarı aylar',
      prompt: `Aylıq göstəricilər üçün CTE işlədərək: **2024**-ün hansı aylarında gəlir (ləğv edilməmiş sifarişlər) **2024-ün orta aylıq gəlirindən yuxarı** olub?

- **Sütunlar:** \`month\` (date), \`revenue\` (2 onluq rəqəm)
- **Sıralama:** \`month\` üzrə.`,
      hints: [`\`WITH monthly AS (SELECT date_trunc('month', …)::date AS month, sum(…) AS revenue … GROUP BY 1)\``, 'Sonra `WHERE revenue > (SELECT avg(revenue) FROM monthly)`.'],
      explanation: `CTE bir dəfə hesablanır və **iki dəfə** işlədilir: sətir mənbəyi kimi və orta üçün scalar subquery-nin içində. CTE olmadan yazılsa, aylıq aqreqasiya təkrarlanmalı olardı.

2024 filtrinin harada durması vacibdir: CTE-də orta yalnız 2024-ün aylarını əhatə edir. Yalnız əsas sorğuda filtrləmək (ikinci yanlış cavab) 2024 aylarını bütün dövrlərin aylıq ortası ilə müqayisə edir.`,
      commonMistakes: ['Orta sətir dəyəri ilə müqayisə etmək.', 'Yalnız 2024 yox, bütün aylar üzrə orta almaq.'],
    },
    't20-q02': {
      title: 'CTE nədir',
      prompt: `(Rekursiv olmayan) CTE haqqında hansı ifadə **doğrudur**?`,
      hints: ['CTE-ni adlandırılmış subquery kimi düşünün.'],
      explanation: `CTE bir əmrlə məhdudlaşan adlandırılmış subquery-dir. CTE-lər əvvəlkilərin üzərində qurula bilər və onlara dəfələrlə istinad edilə bilər. PostgreSQL 12-dən bəri bir dəfə istinad edilən (və yan təsirləri olmayan) CTE subquery kimi yerləşdirilir, ona görə də o, avtomatik olaraq nə daha sürətli, nə də daha yavaşdır. Ayrıca hesablamanı məcbur etmək üçün \`MATERIALIZED\` işlədin. Sorğunu saxlamaq üçün **view** yaradın (21-ci mövzu).`,
      commonMistakes: ['CTE-ni view və ya müvəqqəti cədvəllə qarışdırmaq.'],
      options: [
        'O, verilənlər bazasında saxlanılır və sonrakı sorğular tərəfindən view kimi təkrar işlədilə bilər',
        'O, yalnız aid olduğu tək əmr daxilində mövcuddur və eyni WITH-dəki sonrakı CTE əvvəlkinə istinad edə bilər',
        'Hər CTE-yə əsas sorğuda yalnız bir dəfə istinad edilə bilər',
        'CTE-lər həmişə ayrıca hesablanır və buna görə də həmişə subquery-lərdən sürətlidir',
      ],
    },
    't20-q03': {
      title: 'Rekursiya ilə saymaq',
      prompt: `Bu sorğu nə qaytarır?`,
      hints: ['Şərt *əvvəlki* sətirdə yoxlanılır: i = 4-dən daha bir sətir (5) yaranır.'],
      explanation: `Anchor 1 yaradır. Hər addım \`i < 5\` olan sətirlər üçün \`i + 1\` əlavə edir: 2, 3, 4, 4-dən isə 5 yaradır. 5-dən şərt ödənmir, addım heç bir sətir qaytarmır və rekursiya dayanır. 1–5 sətirləri: say 5, cəm 15, max 5.`,
      commonMistakes: ['Bir vahid sürüşmə: WHERE-in 4-də dayanacağını və ya 6-ya icazə verəcəyini gözləmək.'],
    },
    't20-q04': {
      title: 'Müştərilər neçə sifariş verir?',
      prompt: `Müştərilərin sifariş sayına görə paylanmasını göstərin: neçə müştəri düz 1 sifariş, düz 2 və s. verib (istənilən status; yalnız ən azı bir sifarişi olan müştərilər).

- **Sütunlar:** \`orders\`, \`customers\`
- **Sıralama:** \`orders\` üzrə.`,
      hints: ['CTE 1: hər müştəri üzrə sifarişlər. Əsas sorğu: həmin CTE-ni onun sayı üzrə qruplaşdırın.'],
      explanation: `İki səviyyəli qruplaşdırma: əvvəlcə hər müştəri üzrə, sonra hər say üzrə. CTE birinci səviyyəni adlandırır, ona görə də ikinci təbii oxunur.

Saymazdan əvvəl order_items-i join etmək sifarişləri yox, **sətirləri** sayır. Tapşırıq istənilən status deyir, ona görə də ləğv edilmiş sifarişlər də sayılır.`,
      commonMistakes: ['Join-dən sonra sifariş sətirlərini saymaq.', 'Tapşırığın filtrləməyi istəmədiyi statusları filtrləmək.'],
    },
    't20-q05': {
      title: 'Electronics altındakı hər şey',
      prompt: `**Electronics** (slug \`'electronics'\`) kök kateqoriyasının altındakı **bütün** kateqoriyaları istənilən dərinlikdə, ondan aşağı dərinlikləri ilə (birbaşa uşaqlar = 1) sadalayın.

- **Sütunlar:** \`category_id\`, \`name\`, \`depth\`
- **Sıralama:** \`depth\` üzrə, sonra \`category_id\`.`,
      hints: ['Anchor: Electronics-in uşaqları (dərinlik 1).', 'Recursive term: `JOIN tree t ON c.parent_id = t.category_id`, depth + 1.'],
      explanation: `Adi join yalnız bir səviyyəyə çatır. Rekursiv CTE addım heç bir uşaq tapmayana qədər əvvəlki addımda tapılan sətirlərə uşaqları join etməyə davam edir: Electronics → Computers → Computer Accessories → Keyboards və s.

Anchor-u kökün özündən (dərinlik 0) başlatmaq olar, yetər ki, sonra kökü nəticədən çıxarasınız.`,
      commonMistakes: ['Yalnız birbaşa uşaqlar.', 'Kökün özünü daxil etmək.'],
    },
    't20-q06': {
      title: 'İdarəetmə zəncirində yuxarı',
      prompt: `**İyerarxiyanın aşağısında olanlar arasında ən böyük \`employee_id\`-li** işçi (ən dərin səviyyə) üçün həmin işçini və **onun üstündəki hər meneceri** ən yuxarıya qədər, işçidən addımların sayı ilə (işçi 0-dır) sadalayın.

Sadə olsun deyə işçi verilib: \`employee_id = (SELECT max(employee_id) FROM employees WHERE manager_id IS NOT NULL AND employee_id NOT IN (SELECT manager_id FROM employees WHERE manager_id IS NOT NULL))\` işlədin.

- **Sütunlar:** \`steps\`, \`employee_id\`, \`job_title\`
- **Sıralama:** \`steps\` üzrə.`,
      hints: ['Anchor: işçi (steps 0).', '**Yuxarı** gəzin: `JOIN chain ch ON e.employee_id = ch.manager_id`.'],
      explanation: `**Yuxarı** gəzmək üçün növbəti sətir \`employee_id\`-si cari sətrin \`manager_id\`-sinə bərabər olan sətirdir. Rekursiya \`manager_id\`-si NULL olan ən yuxarı menecerdə dayanır (join heç nə tapmır).

Join şərtini tərsinə çevirmək işçinin tabeliyindəkilərə doğru **aşağı** gəzir. Ən aşağı səviyyəli işçinin tabeliyində heç kim yoxdur, ona görə də yalnız başlanğıc sətri alardınız. Self-join yalnız bir səviyyəyə çatır.`,
      commonMistakes: ['Aşağı istiqamətdə join etmək.', 'Tək self-join (bir səviyyə).'],
    },
    't20-q07': {
      title: 'Düzəlt: qurulmayan təqvim',
      prompt: `Bu sorğu **2025-ci ilin iyununun hər gününü** həmin gün verilmiş **phone** sifarişlərinin (\`channel = 'phone'\`) sayı ilə, **0 olan günlər daxil olmaqla**, göstərməlidir. O, tip xətası ilə uğursuz olur. Düzəldin.

- **Sütunlar:** \`day\` (date), \`phone_orders\`
- **Sıralama:** \`day\` üzrə.`,
      hints: ['`date + interval` **timestamp**-dır, anchor sütunu isə **date**-dir.', '`day + 1` bir gün əlavə edir və date olaraq qalır.'],
      explanation: `Anchor CTE-nin sütun tipini **date** kimi müəyyən edir. \`day + interval '1 day'\` **timestamp** yaradır və PostgreSQL rədd edir: *recursive query "days" column 1 has type date in non-recursive term but type timestamp without time zone overall*. \`date + integer\` date olaraq qalır (və ya nəticəni geri cast edin).

Qalanı klassik "boş günləri daxil et" pattern-idir: təqvimi sifarişlərə LEFT JOIN edin, kanal filtrini **ON** bəndində saxlayın və sifarişlər tərəfindən sütun sayın. \`count(*)\` boş günlər üçün 1 sayardı, kanal üzrə WHERE isə onları yenidən atardı.`,
      commonMistakes: ['count(o.order_id) əvəzinə count(*).', 'Kanal filtrini WHERE-ə qoymaq.'],
    },
    't20-q08': {
      title: 'Böyük xərcləyənlər',
      prompt: `Ümumi xərci (ləğv edilməmiş sifarişlər, sətir dəyərləri, çatdırılmasız) **orta müştəri xərcindən üç dəfədən çox** olan müştəriləri tapın (orta nəsə xərcləmiş müştərilər üzrə).

- **Sütunlar:** \`customer_id\`, \`spend\` (2 onluq rəqəm)
- **Sıralama:** \`spend\` üzrə (ən yüksək birinci), sonra \`customer_id\`.`,
      hints: ['Hər müştəri və onun xərci üçün bir sətirli CTE.', 'Ona iki dəfə istinad edin: mənbə kimi və `(SELECT avg(spend) FROM …)`-da.'],
      explanation: `CTE iki dəfə işlədilən hər müştəri üzrə cədvəldir. Meyar sifariş sətirlərinin yox, **müştəri cəmlərinin** ortası olmalıdır.

Heç nə xərcləməmiş müştəriləri (0 ilə) daxil etmək ortanı aşağı salır və daha çox müştərini keçirir. Tapşırıq ortanı nəsə xərcləmiş müştərilər üzrə təyin edir.`,
      commonMistakes: ['Müştəri cəmləri əvəzinə sətir dəyərlərinin ortasını almaq.', 'Sıfır xərcli müştəriləri ortaya daxil etmək.'],
    },
    't20-q09': {
      title: 'UNION dövrü dayandırır',
      prompt: `Bu sorğu nə qaytarır?`,
      hints: ['`n % 3 + 1` 1 → 2 → 3 → 1 çevirir. UNION ilə artıq yaradılmış sətirlər atılır.'],
      explanation: `Ardıcıllıq dövr edir: 1, 2, 3, 1, … \`UNION\` ilə (UNION ALL yox) hər addımın yeni sətirləri indiyədək yaradılan hər şeyə qarşı dublikatlardan təmizlənir. 3-dən olan addım yenidən 1 yaratdıqda o, atılır, addım boş qalır və rekursiya bitir. \`UNION ALL\` ilə bu sorğu heç vaxt bitməzdi.`,
      commonMistakes: ['UNION ALL-dakı kimi dublikatlar gözləmək.'],
    },
    't20-q10': {
      title: 'İyerarxiya səviyyəsi üzrə işçi sayı',
      prompt: `Təşkilatın zirvəsi meneceri olmayan işçidir (1-ci səviyyə). Onun birbaşa tabeliyindəkilər 2-ci səviyyədir və s. Hər səviyyədəki işçiləri (hazırkı və keçmiş) sayın.

- **Sütunlar:** \`level\`, \`employees\`
- **Sıralama:** \`level\` üzrə.`,
      hints: ['Anchor: `WHERE manager_id IS NULL`, 1-ci səviyyə.', 'Recursive term: meneceri əvvəlki səviyyədə olan işçilər.'],
      explanation: `Anchor **yalnız kök** olmalıdır. Hər işçi anchor olsa (birinci yanlış cavab), hər biri öz gəzintisini başladır və öz menecerlərinin hər birinin altındakı hər səviyyədə yenidən sayılır.

Rekursiv gəzinti dərinliyi hesablamağın yeganə ümumi yoludur. CASE yalnız "zirvə"ni "zirvə olmayan"dan ayıra bilər.`,
      commonMistakes: ['Hər sətir anchor kimi.', 'Səviyyələri sabit yazmaq.'],
    },
    't20-q11': {
      title: 'Yarpaq kateqoriyalar üçün breadcrumb-lar',
      prompt: `Hər **yarpaq** kateqoriya (alt kateqoriyası olmayan) üçün kökdən onun tam yolunu, adları \`' > '\` ilə birləşdirərək qurun, məsələn, \`'Electronics > Computers > Laptops'\`.

- **Sütunlar:** \`category_id\`, \`path\`
- **Sıralama:** \`path\` üzrə.`,
      hints: [`Köklərdən başlayın və aşağı gedərkən uşağın adını əlavə edin: \`t.path || ' > ' || c.name\`.`, 'Yarpaqları saxlayın: `NOT EXISTS (SELECT 1 FROM categories k WHERE k.parent_id = t.category_id)`.', 'Sütun tipi daha uzun yollara uyğun gəlsin deyə anchor-un adını `text`-ə cast edin.'],
      explanation: `Yol rekursiya **aşağı** getdikcə yığılır: hər addım uşağın adını valideyninin yoluna əlavə edir. Əvəzində önə əlavə etmək yolu tərsinə qurur ("Laptops > Computers > Electronics").

Alternativ hər yarpaqdan **yuxarı** gəzir, valideyn adlarını önə əlavə edir və kökə çatmış sətri saxlayır. Hər ikisi geniş yayılıb. Yarpaq filtri olmadan hər kateqoriya üçün breadcrumb alırsınız.`,
      commonMistakes: ['Yolu tərs sıra ilə qurmaq.', 'Yarpaq olmayan kateqoriyaları daxil etmək.'],
    },
    't20-q12': {
      title: 'Ən yuxarı səviyyəli kateqoriya üzrə gəlir',
      prompt: `Məhsullar müxtəlif dərinliklərdəki kateqoriyalara bağlıdır. Hər **kök kateqoriyanın** gəlirini (ləğv edilməmiş sifarişlər, sətir dəyərləri), **onun altındakı bütün kateqoriyaların** satışlarını istənilən dərinlikdə sayaraq göstərin.

- **Sütunlar:** \`root_id\`, \`root_name\`, \`revenue\` (2 onluq rəqəm)
- **Sıralama:** \`revenue\` üzrə (ən yüksək birinci), sonra \`root_id\`.`,
      hints: ['Hər kateqoriyanı onun kökünə uyğunlaşdıran rekursiv CTE: anchor köklərdir (root_id = category_id), uşaqlar isə valideynlərinin root_id-sini miras alır.', 'Sonra products → order_items → orders join edin və kök üzrə qruplaşdırın.'],
      explanation: `Hiylə **kök id-sini** ağacda **aşağı daşımaqdır**: anchor hər kök üçün \`root_id = category_id\` təyin edir, hər uşaq isə valideyninin \`root_id\`-sini köçürür. Nəticə istənilən dərinlikdəki hər kateqoriyanı onun kökünə uyğunlaşdırır, adi join və GROUP BY isə işi bitirir.

Yalnız köklərin birbaşa altındakı uşaqları join etmək daha dərin kateqoriyalardakı məhsulları buraxır (Laptops Electronics-dən iki səviyyə aşağıdadır). Köklərin özünə bağlı məhsullar: yoxdur.`,
      commonMistakes: ['Kökdən yalnız bir səviyyə aşağı.', 'Yalnız kök kateqoriyanın özünə bağlı məhsullar.'],
    },
    't20-q13': {
      title: 'Tövsiyə zəncirləri',
      prompt: `Müştərilər başqa müştərilər tərəfindən tövsiyə oluna bilər (\`referred_by\`), onlar da öz növbəsində tövsiyə ilə gəlmiş ola bilər və s. Zəncirinin başlanğıcından **ən azı 3 addım** uzaqda olan hər müştəri üçün **ilkin tövsiyəçini** (zirvədəki, heç kim tərəfindən tövsiyə edilməmiş müştəri) və addımların sayını göstərin.

- **Sütunlar:** \`customer_id\`, \`original_referrer\`, \`steps\`
- **Sıralama:** \`steps\` üzrə (ən yüksək birinci), sonra \`customer_id\`.`,
      hints: ['Anchor: `referred_by IS NULL` olan müştərilər, `original_referrer = customer_id` və 0 addım ilə.', 'Recursive term: əvvəlki addımdakı kimsə tərəfindən tövsiyə edilmiş müştərilər `original_referrer`-i miras alır, steps + 1.'],
      explanation: `Hər dərinlikdə zəncirin zirvəsini bilmək üçün **onu özünüzlə daşıyın**: anchor-da bir dəfə təyin edin və hər addımda dəyişmədən köçürün. Əvəzində \`c.referred_by\` yazmaq *birbaşa* tövsiyəçini, yəni sadəcə əvvəlki halqanı verir.

Sayma ilkin tövsiyəçi üçün 0-dan başlayır, ona görə də "3 addım" üç tövsiyə dərinliyi deməkdir. Yuxarı alternativ hər müştəridən başlayır və \`referred_by\` NULL olana qədər qalxır.`,
      commonMistakes: ['İlkin əvəzinə birbaşa tövsiyəçini qeyd etmək.', 'Tövsiyəçini 1-ci addım kimi saymaq.'],
    },
    't20-q14': {
      title: 'Əsas sorğu nəyi görür',
      prompt: `**Son** əmr nə qaytarır?`,
      hints: ['Bir əmrin bütün hissələri verilənlərin eyni snapshot-u üzərində işləyir.'],
      explanation: `Data-modifying CTE həqiqətən iki sətri silir və onun RETURNING nəticəsində (\`removed\`) 2 sətir var. Amma əsas sorğu \`t\`-ni silinmədən əvvəl, **əmr başlayanda götürülən snapshot**-dan oxuyur, ona görə də hələ 3 sayır. Sonradan yeni əmr 1 sətir görərdi. Eyni əmr daxilində dəyişdirilmiş sətirlərlə işləmək üçün RETURNING nəticəsini işlədin.`,
      commonMistakes: ['Əsas sorğunun CTE-nin dəyişikliklərini görəcəyini gözləmək.'],
    },
    't20-q15': {
      title: 'Hər menecerin altındakı hamı',
      prompt: `Ən azı bir tabeliyində olanı olan hər işçi üçün iyerarxiyada onun altındakı **bütün** işçiləri (birbaşa və dolayı, hazırkı və keçmiş) sayın və həmin işçilərin maaşlarını toplayın.

- **Sütunlar:** \`manager_id\`, \`reports\`, \`team_salary\`
- **Sıralama:** \`reports\` üzrə (ən yüksək birinci), sonra \`manager_id\`.`,
      hints: ['Bütün (menecer, tabeli) cütlərini qurun: anchor hər birbaşa cütdür, recursive term isə cütü bir səviyyə aşağı uzadır.', 'Sonra tabelinin maaşı üçün employees ilə join edin və menecer üzrə qruplaşdırın.'],
      explanation: `Bu, iyerarxiyanın **transitiv qapanmasını** (transitive closure) qurur: hər (menecer, aşağıdakı istənilən kəs) cütü. Anchor birbaşa tabeliyində olanları saxlayır. Hər addım (M, S) cütünü götürür və (M, S-in tabeliyindəkilər) əlavə edir, ona görə də ilkin menecer daşınır, tabeli isə aşağı hərəkət edir.

Adi cədvəl üzərində GROUP BY yalnız birbaşa tabeliyində olanları sayır. Maaşı tabeli əvəzinə menecer üzrə join etmək menecerin öz maaşını hər tabeli üçün bir dəfə toplayır.`,
      commonMistakes: ['Yalnız birbaşa tabeliyində olanlar.', 'Maaşları cütün yanlış tərəfində join etmək.'],
    },
    't20-q16': {
      title: 'Hər kateqoriya nə qədər cəmlənib?',
      prompt: `**Ən azı 4 məhsulu satılmış** hər kateqoriya üçün kateqoriyanın gəlirinin (ləğv edilməmiş sifarişlər, sətir dəyərləri) hansı payı onun **ilk 3 məhsulundan** gəlir? Bunu CTE-lər zənciri kimi qurun.

- **Sütunlar:** \`category_id\`, \`top3_revenue\`, \`category_revenue\` (2 onluq rəqəm), \`top3_share_pct\` (1 onluq rəqəm)
- **Sıralama:** \`top3_share_pct\` üzrə (ən yüksək birinci), sonra \`category_id\`.`,
      hints: ['CTE 1: hər məhsul üzrə gəlir (kateqoriyası ilə).', 'CTE 2: `row_number() OVER (PARTITION BY category_id ORDER BY revenue DESC, product_id)` və `count(*) OVER (PARTITION BY category_id)`.', 'Əsas sorğu: hər kateqoriya üzrə `FILTER (WHERE rn <= 3)` ilə cəmi tam cəmlə müqayisə edin.'],
      explanation: `Hər CTE bir iş görür: məhsul cəmləri, sonra kateqoriya daxilində dərəcələr, sonra son müqayisə. Oxucular (və gələn ay siz) hər addımı ayrıca yoxlaya bilər.

Əsas hərəkət WHERE-də yox, **aqreqatın içində** filtrləməkdir (\`FILTER (WHERE rn <= 3)\`). \`rn <= 3\` üzrə WHERE məxrəci də ilk 3-ə qədər kiçildərdi və hər yerdə 100% verərdi. Artan sıra ilə dərəcələmə üç *ən zəif* məhsulu seçir.`,
      commonMistakes: ['Məxrəci kiçildən, WHERE-də rn <= 3 filtri.', 'Dərəcələmədə artan sıra.'],
    },
  },
};

export default topic;
