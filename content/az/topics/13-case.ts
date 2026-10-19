import type { TopicText } from '../../i18n.ts';

const explanation = `\`CASE\` SQL-in if/else-idir. O, **ifadədir**, ona görə də dəyərin ola biləcəyi hər yerdə görünə bilər: SELECT, WHERE, ORDER BY, GROUP BY, funksiyaların içində, UPDATE … SET.

## İki forma

\`\`\`sql
-- Searched CASE: istənilən şərtlər, yuxarıdan aşağı yoxlanılır
SELECT product_id, price,
       CASE
         WHEN price < 50  THEN 'budget'
         WHEN price < 500 THEN 'mid-range'
         ELSE 'premium'
       END AS tier
FROM products
ORDER BY product_id
LIMIT 6;
\`\`\`

\`\`\`sql
-- Simple CASE: bir ifadəni dəyərlərlə müqayisə edir
SELECT order_id, status,
       CASE status
         WHEN 'delivered' THEN 'done'
         WHEN 'returned'  THEN 'done'
         WHEN 'cancelled' THEN 'void'
         ELSE 'open'
       END AS stage
FROM orders
ORDER BY order_id
LIMIT 6;
\`\`\`

## Bilməyə dəyər qaydalar

- True olan **ilk** WHEN qalib gəlir, sonrakılar ötürülür. Şərtlərinizi ən spesifikdən ən ümumiyə doğru sıralayın: \`WHEN price < 50\`-dən əvvəl \`WHEN price < 500\` bütün ucuz məhsulları birinci budağa salardı.
- ELSE olmadan heç nəyə uyğun gəlməyən sətir **NULL** alır.
- \`WHEN\` **true** olmalıdır. Naməlum (NULL) uyğun gəlməmiş sayılır. Simple CASE-də \`CASE x WHEN NULL\` heç vaxt uyğun gəlmir. \`CASE WHEN x IS NULL\` işlədin.
- Bütün budaqların **uyğun tipləri** olmalıdır. \`THEN 'unknown' ELSE weight_kg\` uğursuz olur. Cast edin: \`ELSE weight_kg::text\`.
- CASE **hesablama sırasına zəmanət verən** yeganə konstruksiyadır: \`CASE WHEN qty > 0 THEN total / qty END\` heç vaxt sıfıra bölmür, \`CASE WHEN valid THEN raw::numeric END\` isə heç vaxt zibili cast etmir (8-ci mövzu).

## Geniş yayılmış pattern-lər

**Qruplara bölmə və etiketləmə:** səviyyələr, yaş qrupları, SLA kateqoriyaları.

**Xüsusi sıralama:**

\`\`\`sql
SELECT order_id, status
FROM orders
WHERE ordered_at >= '2025-06-25'
ORDER BY CASE status WHEN 'pending' THEN 1 WHEN 'processing' THEN 2 WHEN 'shipped' THEN 3 ELSE 4 END,
         order_id
LIMIT 10;
\`\`\`

**Şərti aqreqasiya / pivot** (aqreqatlar ətraflı 14-cü mövzuda): yalnız uyğun gələn sətirləri sayın və ya toplayın, hər kateqoriya üçün bir sütun:

\`\`\`sql
SELECT count(*)                                               AS orders,
       sum(CASE WHEN channel = 'phone'  THEN 1 ELSE 0 END)   AS phone_orders,
       count(*) FILTER (WHERE channel = 'mobile')            AS mobile_orders -- PostgreSQL-in qısa forması
FROM orders;
\`\`\`

**Şərti yeniləmələr:**

\`\`\`sql
UPDATE products
SET price = CASE WHEN price < 50 THEN price * 1.05 ELSE price END
WHERE discontinued_at IS NULL
RETURNING product_id, price;
\`\`\`

## CASE və qısa yollar

- \`coalesce(a, b)\` = \`CASE WHEN a IS NOT NULL THEN a ELSE b END\`
- \`nullif(a, b)\` = \`CASE WHEN a = b THEN NULL ELSE a END\`
- \`greatest(a, b)\` ≈ \`CASE WHEN a >= b THEN a ELSE b END\` (amma greatest NULL-ları nəzərə almır)

Uyğun gəldikdə qısa yolu işlədin. O, daha qısadır və nə demək istədiyinizi deyir.

## Tələlər

- Üst-üstə düşən və ya sırası pozulmuş WHEN şərtləri: ilk uyğunluq səssizcə qalib gəlir.
- ELSE-i unutmaq gözlənilməz dəyərləri NULL-a çevirir. Bəzən bu faydalıdır (boşluqları göstərir), bəzən isə bug-dır.
- ELSE olmadan \`sum(CASE … THEN 1 END)\` heç nə uyğun gəlmədikdə 0 yox, NULL qaytarır. \`ELSE 0\` əlavə edin və ya \`count(*) FILTER (…)\` işlədin.`;

const topic: TopicText = {
  explanation,
  questions: {
    't13-q01': {
      title: 'Qiymət səviyyələri',
      prompt: `Hər məhsulu qiymət səviyyəsi ilə etiketləyin: 50-dən aşağı **\`'budget'\`**, 50-dən 500-ə qədər (500 daxil deyil) **\`'mid-range'\`**, 500-dən başlayaraq **\`'premium'\`**.

- **Sütunlar:** \`product_id\`, \`price\`, \`tier\`
- **Sıralama:** \`product_id\` üzrə.`,
      hints: ['İki WHEN və bir ELSE ilə searched CASE.', 'İlk true WHEN qalib gəlir, ona görə də əvvəlcə ən aşağı sərhədi yoxlayın.'],
      explanation: `CASE WHEN-ləri **sıra ilə** yoxlayır və ilk true olanda dayanır. \`< 50\`-dən əvvəl \`< 500\`-ü yoxlamaq "budget"-ə heç vaxt çatılmaması deməkdir, çünki hər ucuz məhsul artıq "mid-range"-ə uyğun gəlib.

ELSE olmadan premium məhsullar NULL alardı.`,
      commonMistakes: ['Şərtlər yanlış sırada.', 'ELSE-i unutmaq.'],
    },
    't13-q02': {
      title: 'Heç bir WHEN uyğun gəlmir',
      prompt: `**Heç bir WHEN şərti true olmayan** və **ELSE olmayan** sətir üçün CASE ifadəsi nə qaytarır?`,
      hints: ['Çatışmayan ELSE `ELSE NULL` kimi davranır.'],
      explanation: `ELSE olmayan CASE gizli şəkildə \`ELSE NULL\` ilə bitir. Bu faydalı ola bilər, məsələn, \`sum(CASE WHEN … THEN amount END)\` uyğun gəlməyən sətirləri nəzərə almır. O, həmçinin kateqoriyalarınızdakı boşluqları gizlədə bilər.`,
      commonMistakes: ['Xəta və ya standart dəyər gözləmək.'],
      options: ['Xəta.', 'NULL.', 'Son THEN-in dəyəri.', 'Boş sətir.'],
    },
    't13-q03': {
      title: 'Hansı WHEN qalib gəlir?',
      prompt: `Bu sorğu nə qaytarır?`,
      hints: ['500 > 10 artıq true-dur.'],
      explanation: `500 birinci şərti (\`x > 10\`) ödəyir, ona görə də o, 'big'-dir və 'huge' budağına heç vaxt çatılmır. Daha spesifik şərti (\`> 100\`) birinci qoyun.`,
      commonMistakes: ['CASE-in birincini yox, "ən yaxşı" uyğunluğu seçəcəyini gözləmək.'],
    },
    't13-q04': {
      title: 'Sifariş mərhələsi',
      prompt: `**2025-05-01 və ya sonra** verilmiş sifarişlər üçün mərhələ göstərin: çatdırılmış və ya qaytarılmış sifarişlər üçün \`'done'\`, ləğv edilmişlər üçün \`'void'\`, qalan hər şey üçün \`'open'\`.

- **Sütunlar:** \`order_id\`, \`status\`, \`stage\`
- **Sıralama:** \`order_id\` üzrə.`,
      hints: [`Simple CASE bir dəyəri müqayisə edir: \`CASE status WHEN 'delivered' THEN …\`.`],
      explanation: `Sadə forma \`CASE status WHEN 'a' THEN …\` bir dəyəri siyahı ilə müqayisə etməyin yığcam yoludur. "Bir neçə dəyərdən biri" üçün \`IN (…)\` ilə searched forma daha yaxşı oxunur.`,
      commonMistakes: ['returned statusunu unutmaq.', 'ELSE-i unutmaq.'],
    },
    't13-q05': {
      title: 'Təcililiyə görə sifarişlər',
      prompt: `**2025-ci ilin iyununda** verilmiş sifarişləri nə qədər təcili hərəkət tələb etdiklərinə görə sıralanmış şəkildə sadalayın: əvvəlcə **pending**, sonra **processing**, **shipped**, **delivered**, **returned**, ən sonda isə **cancelled**. Hər status daxilində \`order_id\` üzrə.

- **Sütunlar:** \`order_id\`, \`status\`
- **Sıralama:** təsvir edildiyi kimi.`,
      hints: ['ORDER BY hər statusu ədədə çevirən CASE işlədə bilər.'],
      explanation: `Mətnin özü üzrə sıralama əlifba sırası ilədir: cancelled, delivered, pending… CASE hər statusu onun dərəcəsinə çevirir, ORDER BY isə həmin ədəd üzrə sıralayır. İstənilən sıranın array-i üzərində \`array_position\` yığcam PostgreSQL alternatividir.`,
      commonMistakes: ['Əlifba sırası ilə sıralamaq.', 'Yalnız bəzi statusları dərəcələndirmək.'],
    },
    't13-q06': {
      title: 'Bir sətirdə kanallar üzrə sifarişlər',
      prompt: `**2024** (UTC) üçün bütün sifarişləri, ayrı sütunlarda isə **web**, **mobile**, **phone** və **marketplace** sifarişlərini sayın: cəmi bir sətir.

- **Sütunlar:** \`total\`, \`web\`, \`mobile\`, \`phone\`, \`marketplace\``,
      hints: [`\`sum(CASE WHEN channel = 'web' THEN 1 ELSE 0 END)\` uyğun gələn sətirləri sayır.`, 'PostgreSQL-də `count(*) FILTER (WHERE …)` də var.'],
      explanation: `**Şərti aqreqasiya:** CASE uyğun gələn sətirlər üçün 1, digərləri üçün 0 verir, SUM isə onları toplayır. Bu, bir ölçünün sütunlara pivot edilməsidir.

Tələ: \`count(CASE … THEN 1 ELSE 0 END)\` **hər** sətri sayır, çünki 0 NULL deyil, count isə yalnız NULL-ları ötürür. Ya sum işlədin, ya count-un içində ELSE-i buraxın, ya da \`count(*) FILTER (WHERE …)\` işlədin.`,
      commonMistakes: ['Hər şeyi sayan ELSE 0 ilə count().', 'İl filtrini unutmaq.'],
    },
    't13-q07': {
      title: 'Yaş qrupları',
      prompt: `**1-dən 40-a qədər** müştərilərə **2025-06-30**-da tamamlanmış illərlə yaşlarına əsasən yaş qrupu təyin edin: \`'18-29'\`, \`'30-44'\`, \`'45-64'\`, \`'65+'\`, \`birth_date\` NULL olduqda isə \`'unknown'\`.

- **Sütunlar:** \`customer_id\`, \`age_group\`
- **Sıralama:** \`customer_id\` üzrə.`,
      hints: [`Yaş: \`extract(year FROM age(DATE '2025-06-30', birth_date))\` (11-ci mövzu).`, 'NULL doğum tarixini birinci WHEN-də emal edin.'],
      explanation: `NULL doğum tarixi üçün hər yaş müqayisəsi naməlumdur, ona görə də açıq NULL yoxlaması olmayan CASE **ELSE**-ə düşür və bu müştərilər '65+' kimi etiketlənir! Əvvəlcə NULL-ı yoxlayın.

Qrup sərhədləri: '18-29' yaş < 30 deməkdir, ona görə də 30 yaşlı '30-44'-ə aiddir. \`<=\` işlətmək hər sərhədi bir il sürüşdürür.`,
      commonMistakes: ['Naməlum yaşların ELSE qrupuna düşməsi.', 'Bir vahid sürüşmüş sərhədlər.'],
    },
    't13-q08': {
      title: 'Düzəlt: çəki etiketi',
      prompt: `Bu sorğu ilk 20 məhsulun hər birinin çəkisini, \`weight_kg\` NULL-dursa **\`'unknown'\`** göstərməlidir. O, uğursuz olur. Düzəldin.

- **Sütunlar:** \`product_id\`, \`weight_label\` (text)
- **Sıralama:** \`product_id\` üzrə. 20 sətir.`,
      hints: ['CASE-in bütün budaqları eyni tipdə olmalıdır.'],
      explanation: `Xəta: *invalid input syntax for type numeric: "unknown"*. PostgreSQL CASE üçün bir nəticə tipi müəyyən edir, burada ELSE budağından numeric, sonra isə 'unknown'-ı ədədə çevirə bilmir. Hər iki budaq text olsun deyə numeric budağı text-ə cast edin. \`coalesce(weight_kg::text, 'unknown')\` qısa formadır.`,
      commonMistakes: ['NULL-ı saxta ədədlə əvəz etmək.'],
    },
    't13-q09': {
      title: 'Çatdırılma sürəti kateqoriyaları',
      prompt: `**2025-ci ilin iyununda** verilmiş sifarişlərin göndərişləri üçün çatdırılma sürətini kateqoriyalara bölün: hələ çatdırılmayıbsa \`'in transit'\`, **3 gün** ərzində \`'fast'\`, **7 gün** ərzində \`'normal'\`, əks halda \`'slow'\` (müddətlər \`delivered_at - shipped_at\` kimi ölçülür, sərhədlər daxildir).

- **Sütunlar:** \`shipment_id\`, \`speed\`
- **Sıralama:** \`shipment_id\` üzrə.`,
      hints: [`Interval-ları müqayisə edin: \`delivered_at - shipped_at <= INTERVAL '3 days'\`.`, 'Əvvəlcə NULL halı.'],
      explanation: `Çatdırılmamış göndərişlərin \`delivered_at\`-ı NULL-dur, bu da hər müddət müqayisəsini naməlum edir. Açıq birinci WHEN olmadan onlar ELSE-ə düşür və 'slow' kimi göstərilir.

İkinci yanlış cavab keçən vaxt əvəzinə təqvim günlərini sayır. Bu, başqa qaydadır və sərhədlərə yaxın bağlamalar üçün fərqli nəticə verir.`,
      commonMistakes: ['Çatdırılmamış bağlamaların ELSE-ə düşməsi.', 'Təqvim günlərini işlətmək.'],
    },
    't13-q10': {
      title: 'CASE NULL ilə qarşılaşır',
      prompt: `Bu sorğu nə qaytarır?`,
      hints: ['Simple CASE `=` ilə müqayisə edir. `NULL = NULL` nədir?'],
      explanation: `- **a:** simple CASE \`NULL = NULL\`-ı yoxlayır, bu naməlumdur, ona görə də uyğunluq yoxdur: 'no match'.
- **b:** NULL olan WHEN şərti true sayılmır, ona görə də ELSE 'no' verir.
- **c:** \`NULL IS NULL\` true-dur: 'yes'.

NULL üzrə budaqlanmaq üçün həmişə \`IS NULL\` ilə searched formanı işlədin.`,
      commonMistakes: ['CASE x WHEN NULL yazmaq.'],
    },
    't13-q11': {
      title: 'Metod və il üzrə captured ödənişlər',
      prompt: `**captured** ödəniş məbləğlərini pivot edin: \`paid_at\`-ın (UTC) hər **ili** üçün bir sətir, hər metod üçün bir sütun.

- **Sütunlar:** \`year\` (integer), \`card\`, \`paypal\`, \`bank_transfer\`, \`gift_card\`, \`wallet\` (cəmlər; yoxdursa 0)
- **Sıralama:** \`year\` üzrə.`,
      hints: [`İl üzrə GROUP BY. Hər metod üçün \`sum(CASE WHEN method = 'card' THEN amount ELSE 0 END)\`.`, 'Yalnız captured ödənişlər.'],
      explanation: `Pivot bir sütunun (method) dəyərlərini sütunlara çevirir. Sətir ölçüsü (il) üzrə qruplaşdırın və hər nəticə sütunu üçün yalnız həmin metodun sətirlərini toplayın. CASE məbləği daxil edir və ya 0 töhfə verir.

Status filtri olmadan uğursuz cəhdlər və geri qaytarmalar cəmlərə əlavə olunur. PostgreSQL-in \`sum(amount) FILTER (WHERE …)\`-u ekvivalentdir. O, heç nə uyğun gəlmədikdə 0 əvəzinə NULL verir, coalesce də buna görədir.`,
      commonMistakes: ['Bütün ödəniş statuslarını toplamaq.', 'Məbləğləri toplamaq əvəzinə sətirləri saymaq.'],
    },
    't13-q12': {
      title: 'Marja kateqoriyası, naməlumlar daxil',
      prompt: `Hər məhsulun \`(price - cost) / price\` marjasını kateqoriyalara bölün: cost NULL olduqda \`'unknown'\`, **50% və ya daha çox** olduqda \`'high'\`, **30% və ya daha çox** olduqda \`'medium'\`, əks halda \`'low'\`.

- **Sütunlar:** \`product_id\`, \`margin_category\`
- **Sıralama:** \`product_id\` üzrə.`,
      hints: ['Əvvəlcə NULL cost-u yoxlayın.', 'Kəsri 0.5 və 0.3 ilə müqayisə edin.'],
      explanation: `Bir sualda iki klassik CASE tələsi:

1. **NULL ELSE-ə düşür.** Birinci WHEN olmadan naməlum maya dəyərləri 'low' kimi etiketlənir.
2. **Üst-üstə düşən şərtlərin sırası.** \`>= 0.5\`-dən əvvəl \`>= 0.3\`-ü yoxlamaq hər yüksək marjalı məhsulu 'medium'-a göndərir.

Alternativ "marja ≥ 50%"-i "maya dəyəri ≤ qiymətin yarısı" kimi yenidən yazır, bu da bölmədən qaçır.`,
      commonMistakes: ['NULL-ı birinci emal etməmək.', 'Üst-üstə düşən hədlərin yanlış sırası.'],
    },
    't13-q13': {
      title: 'Pilləli qiymət artımı',
      prompt: `**Hələ satışda olan** məhsullara tək UPDATE ilə **pilləli qiymət artımı** tətbiq edin: 50-dən aşağı qiymətlər üçün **+5%**, 50-dən 500-ə qədər (500 daxil deyil) qiymətlər üçün **+3%**, 500 və yuxarı üçün isə **dəyişiklik yoxdur**. (Qiymətlər \`numeric(10,2)\`-dir, ona görə də avtomatik olaraq sentlərə yuvarlaqlaşdırılır.)`,
      hints: ['`SET price = CASE WHEN … THEN price * 1.05 WHEN … THEN price * 1.03 ELSE price END`'],
      explanation: `SET-dəki CASE hər sətrin yeni dəyərini bir keçiddə hesablayır və hər budaq sətrin **köhnə** qiymətini görür.

- \`ELSE price\` olmadan bahalı məhsullar NULL alardı. Burada NOT NULL məhdudiyyəti bunu rədd edərdi, yəni bu, xətadır.
- İki ayrı UPDATE klassik tələdir: 49.99-luq məhsul birinci əmrlə 52.49-a qaldırılır, sonra onu artıq 50–500 aralığında görən ikinci əmrlə *yenidən* qaldırılır. Bir CASE ikiqat tətbiqin qarşısını alır. (Alternativdə olduğu kimi, əvvəlcə **yuxarı** pilləni işə salsanız, iki UPDATE işləyir: qaldırılmış məhsullar aşağı pilləyə geri düşə bilməz.)`,
      commonMistakes: ['Qiyməti NULL edən çatışmayan ELSE.', 'Bəzi sətirlərə iki dəfə toxunan ardıcıl UPDATE-lər.'],
    },
    't13-q14': {
      title: 'Kataloq sıralaması: əvvəlcə satışda olanlar',
      prompt: `Bütün kataloqu belə sıralayın: əvvəlcə **hələ satışda olan** məhsullar, ən bahalısı birinci; sonra **satışdan çıxarılmış** məhsullar, ən son çıxarılanı birinci. Bərabərlikdə \`product_id\` üzrə.

- **Sütunlar:** \`product_id\`, \`price\`, \`discontinued_at\`
- **Sıralama:** təsvir edildiyi kimi.`,
      hints: ['Birinci sıralama açarı: satışda olanlar üçün 0, çıxarılanlar üçün 1 olan CASE.', 'Hər qrupun öz ikinci açarı var. CASE "digər" qrup üçün NULL qaytara bilər ki, mane olmasın.'],
      explanation: `Şərti sıralama hər qayda üçün bir açar tələb edir:

1. Qrup: 0 = satışda, 1 = çıxarılıb.
2. Satışda olan məhsullar daxilində qiymət azalan. Çıxarılmış sətirlər üçün bu CASE NULL-dur, ona görə də hamısı bu açarda bərabərdir və növbəti açar qərar verir.
3. Çıxarılma tarixi azalan. Satışda olan sətirlər üçün o, NULL-dur və onlar artıq əvvəlki açarlarla sıralanıb.

Cəlbedici qısa yol \`ORDER BY discontinued_at DESC, price DESC, product_id\`-dir. Azalan sırada NULL-lar birinci gəlir, ona görə də satışda olan məhsullar qiymətə görə sıralanaraq önə keçir. Bu, *demək olar ki* düzgündür: eyni çıxarılma tarixini paylaşan çıxarılmış məhsullar isə \`product_id\` yox, qiymət üzrə sıralanır, gizli verilənlərdə də belə bərabərlik var. Açıq CASE versiyası hər qaydanı dəqiq ifadə edir.`,
      commonMistakes: ['Hər iki qrup üçün tək ortaq ikinci açar.'],
    },
    't13-q15': {
      title: 'Müştəri seqmentləri',
      prompt: `Müştəriləri **ləğv edilməmiş** sifarişlərinə görə seqmentlərə bölün:

| seqment | qayda (bu sıra ilə yoxlanılır) |
|---|---|
| \`'vip'\` | ümumi xərc ≥ 5000 **və** ən azı 10 sifariş |
| \`'loyal'\` | ən azı 5 sifariş |
| \`'big spender'\` | ümumi xərc ≥ 2000 |
| \`'regular'\` | ən azı bir sifarişi **olan** qalan hamı |
| \`'prospect'\` | heç bir ləğv edilməmiş sifariş yoxdur |

Xərc = sifariş sətirləri üzrə \`quantity * unit_price * (1 - discount)\`-ın cəmi.

- **Sütunlar:** \`customer_id\`, \`orders\`, \`spend\` (2 onluq rəqəmə yuvarlaqlaşdırılmış, prospect-lər üçün 0), \`segment\`
- **Sıralama:** \`customer_id\` üzrə. Hər müştəri görünür.`,
      hints: ['Əvvəlcə hər müştəri üzrə aqreqasiya edin: fərqli sifarişləri sayın və sətir dəyərlərini toplayın (14-cü mövzu).', 'Prospect-lər NULL ilə görünsün deyə həmin xülasəni customers-ə LEFT JOIN edin, sonra coalesce ilə 0 edin.', 'Qaydalar verilmiş sıra ilə olan tək CASE.'],
      explanation: `Klassik analitika tapşırığı: **əvvəl aqreqasiya, sonra təsnifat**.

1. **Müştəri üzrə statistika:** sifarişləri sətirlərlə join etmək sətirləri çoxaldır, ona görə də sifarişləri sətirləri sayacaq \`count(*)\` ilə yox, \`count(DISTINCT order_id)\` ilə sayın.
2. **Hamını saxlayın:** xülasəni customers-ə LEFT JOIN edin. Prospect-lərin xülasə sətri yoxdur, ona görə də onların statistikası NULL-dur. Göstərmək üçün coalesce edin, CASE-də isə \`IS NULL\` yoxlayın.
3. **Prioritet sırası ilə təsnif edin:** VIP-lər 'loyal' qaydasını da ödəyir, ona görə də VIP yoxlaması birinci gəlməlidir.`,
      commonMistakes: ['Sətirləri join etdikdən sonra sifarişləri yox, sətirləri sayan count(*).', 'Daha geniş qaydanı daha spesifikdən əvvəl yoxlamaq.'],
    },
    't13-q16': {
      title: 'Kanal üzrə status matrisi',
      prompt: `Sifariş saylarının **kanal × status** matrisini qurun: hər \`channel\` üçün bir sətir, hər status üçün bir sütun.

- **Sütunlar:** \`channel\`, \`pending\`, \`processing\`, \`shipped\`, \`delivered\`, \`returned\`, \`cancelled\`, \`total\`
- **Sıralama:** \`channel\` üzrə.`,
      hints: ['channel üzrə GROUP BY, hər status üçün isə `count(*) FILTER (WHERE status = …)` və ya `sum(CASE …)`.'],
      explanation: `Şərti aqreqasiya ilə pivot: sətir ölçüsü üzrə GROUP BY, hər sütun dəyəri üçün isə bir filtrlənmiş say.

- \`count(*) FILTER (WHERE …)\` PostgreSQL-in (və SQL standartının) təmiz sintaksisidir.
- \`sum(CASE … THEN 1 ELSE 0 END)\` portativ versiyadır.
- \`count(CASE … ELSE 0 END)\` hər sətri sayır, çünki 0 NULL deyil.

GROUP BY channel, status eyni ədədləri "uzun" formatda verir (hər cüt üçün bir sətir). Pivot isə "geniş" formatdır.`,
      commonMistakes: ['ELSE 0 ilə count.', 'Matris əvəzinə uzun formatı qaytarmaq.'],
    },
  },
};

export default topic;
