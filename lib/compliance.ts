export interface ComplianceRow {
  plan_date: string;
  meal_slot: string;
  checked_off: boolean;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export function aggregateCompliance(rows: ComplianceRow[]) {
  const byDate = new Map<string, any>();
  for (const row of rows) {
    if (!byDate.has(row.plan_date)) {
      byDate.set(row.plan_date, {
        date: row.plan_date,
        meals_planned: 0,
        meals_checked: 0,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        meals: [],
      });
    }
    const day = byDate.get(row.plan_date);
    const checked = !!row.checked_off;
    day.meals_planned += 1;
    if (checked) {
      day.meals_checked += 1;
      day.calories += Number(row.calories);
      day.protein += Number(row.protein);
      day.carbs += Number(row.carbs);
      day.fat += Number(row.fat);
      day.fiber += Number(row.fiber);
    }
    day.meals.push({
      meal_slot: row.meal_slot,
      name: row.name,
      checked,
      calories: Number(row.calories),
      protein: Number(row.protein),
      carbs: Number(row.carbs),
      fat: Number(row.fat),
      fiber: Number(row.fiber),
    });
  }

  return Array.from(byDate.values()).map((day) => ({
    ...day,
    compliance_pct: day.meals_planned > 0 ? Math.round((day.meals_checked / day.meals_planned) * 100) : 0,
  }));
}
