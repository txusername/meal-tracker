import { sql } from '../../../lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS meals (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL,
        calories INT NOT NULL,
        protein DECIMAL(6,1) NOT NULL,
        carbs DECIMAL(6,1) NOT NULL,
        fiber DECIMAL(6,1) NOT NULL DEFAULT 0,
        fat DECIMAL(6,1) NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS meal_plan (
        id SERIAL PRIMARY KEY,
        plan_date DATE NOT NULL,
        meal_slot VARCHAR(50) NOT NULL,
        meal_id INT REFERENCES meals(id),
        checked_off BOOLEAN DEFAULT FALSE,
        checked_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(plan_date, meal_slot)
      )
    `;

    // Seed initial meals
    await sql`
      INSERT INTO meals (name, category, calories, protein, carbs, fiber, fat, notes) VALUES
      ('4 Egg Omelet + Oats + Banana', 'breakfast', 520, 40, 75, 7, 18, 'Use whole eggs, rolled oats'),
      ('Greek Yogurt + Granola + Berries', 'pre_workout', 310, 20, 45, 4, 5, 'Full fat Greek yogurt'),
      ('Protein Shake + Rice Cakes + PB', 'post_workout', 480, 40, 50, 3, 12, '2 scoops whey, 2 rice cakes, 1 tbsp PB'),
      ('Chicken Breast + Rice + Roasted Veg', 'lunch', 520, 50, 60, 6, 8, '6oz chicken, 1 cup rice, mixed veg'),
      ('Salmon + Sweet Potato + Greens', 'dinner', 520, 35, 40, 8, 25, '6oz salmon, medium sweet potato'),
      ('Cottage Cheese + Fruit', 'snack', 220, 25, 20, 2, 3, '1 cup cottage cheese, mixed fruit'),
      ('Chicken + Pasta + Marinara', 'dinner', 580, 45, 65, 5, 10, 'Lean ground chicken or breast'),
      ('Turkey Wrap + Veggies', 'lunch', 450, 40, 45, 5, 12, 'Whole wheat wrap, deli turkey'),
      ('Overnight Oats + Protein Powder', 'breakfast', 490, 38, 60, 8, 12, 'Prep night before'),
      ('Rice + Ground Beef + Peppers', 'lunch', 540, 42, 55, 4, 14, 'Extra lean ground beef')
      ON CONFLICT DO NOTHING
    `;

    return NextResponse.json({ success: true, message: 'Database initialized' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
