// Mövzu adları və qısa təsvirləri. SQL açar sözləri və funksiya adları olduğu kimi qalır.
const meta: Record<number, { title: string; summary: string }> = {
  1: { title: 'Verilənləri sorğulamaq (SELECT)', summary: 'SELECT, sütun alias-ları, ifadələr, DISTINCT, ORDER BY, LIMIT/OFFSET.' },
  2: { title: 'DDL əmrləri', summary: 'Cədvəllərin CREATE / ALTER / DROP edilməsi, verilən tipləri, constraint-lər, açarlar.' },
  3: { title: 'DML əmrləri', summary: 'INSERT, UPDATE, DELETE, RETURNING, ON CONFLICT ilə upsert-lər.' },
  4: { title: 'Verilənləri filtrləmək', summary: 'WHERE, müqayisə və məntiq operatorları, IN, BETWEEN, LIKE/ILIKE, IS NULL.' },
  5: { title: 'SQL JOIN-lər (əsaslar)', summary: 'INNER, LEFT, RIGHT və FULL join-lər; join şərtləri; USING.' },
  6: { title: 'SQL JOIN-lər (qabaqcıl)', summary: 'Self-join-lər, anti/semi join-lər, CROSS JOIN, LATERAL, çoxcədvəlli join-lər.' },
  7: { title: 'Set operator-lar', summary: 'UNION, UNION ALL, INTERSECT, EXCEPT və onların qaydaları.' },
  8: { title: 'SQL funksiyaları', summary: 'Scalar və aggregate funksiyalar, tip çevrilməsi (::, CAST), çevirmə və formatlama.' },
  9: { title: 'Mətn funksiyaları', summary: 'Birləşdirmə, kəsmə (trim), hərf registri, alt-mətnlər, bölmə, regular expression-lar.' },
  10: { title: 'Ədədi funksiyalar', summary: 'ROUND, TRUNC, CEIL/FLOOR, tam bölmə, qalıq (modulo), numeric və float.' },
  11: { title: 'Tarix və vaxt funksiyaları', summary: 'date_trunc, extract, interval-lar, AT TIME ZONE, tarixlərin generate_series-i.' },
  12: { title: 'NULL funksiyaları', summary: 'COALESCE, NULLIF, üçqiymətli məntiq, IS DISTINCT FROM.' },
  13: { title: 'CASE ifadəsi', summary: 'Sadə və axtarışlı CASE, qruplara bölmə (bucketing), şərti aqreqasiya.' },
  14: { title: 'Aggregate funksiyalar', summary: 'COUNT/SUM/AVG/MIN/MAX, GROUP BY, HAVING, FILTER, string_agg, percentile-lar.' },
  15: { title: 'Window function-lar: əsaslar', summary: "OVER, PARTITION BY, window daxilində ORDER BY, window və GROUP BY fərqi." },
  16: { title: 'Window aggregate-lər', summary: 'Running total-lar, hərəkətli ortalar, frame-lər (ROWS/RANGE), ümumi cəmdəki pay.' },
  17: { title: 'Window ranking', summary: 'ROW_NUMBER, RANK, DENSE_RANK, NTILE, PERCENT_RANK, hər qrupda top-N.' },
  18: { title: 'Window value funksiyaları', summary: 'LAG, LEAD, FIRST_VALUE, LAST_VALUE, NTH_VALUE, dövrlər arası müqayisə.' },
  19: { title: 'Subquery-lər', summary: 'Scalar, row və table subquery-lər, correlated subquery-lər, EXISTS, ANY/ALL.' },
  20: { title: 'Common Table Expression-lar (CTE)', summary: 'WITH, CTE-lərin zəncirlənməsi, iyerarxiyalar və seriyalar üçün rekursiv CTE-lər.' },
  21: { title: 'View-lar', summary: 'CREATE VIEW, yenilənə bilən view-lar, WITH CHECK OPTION, materialized view-lar.' },
};

export default meta;
