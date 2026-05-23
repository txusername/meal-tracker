-- Meals library
CREATE TABLE IF NOT EXISTS meals (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL, -- breakfast, pre_workout, post_workout, lunch, dinner, snack
  calories INT NOT NULL,
  protein DECIMAL(6,1) NOT NULL,
  carbs DECIMAL(6,1) NOT NULL,
  fiber DECIMAL(6,1) NOT NULL DEFAULT 0,
  fat DECIMAL(6,1) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Weekly meal plan slots
CREATE TABLE IF NOT EXISTS meal_plan (
  id SERIAL PRIMARY KEY,
  plan_date DATE NOT NULL,
  meal_slot VARCHAR(50) NOT NULL, -- breakfast, pre_workout, post_workout, lunch, dinner, snack
  meal_id INT REFERENCES meals(id),
  checked_off BOOLEAN DEFAULT FALSE,
  checked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(plan_date, meal_slot)
);

-- MCP API key
CREATE TABLE IF NOT EXISTS api_keys (
  id SERIAL PRIMARY KEY,
  key_hash VARCHAR(255) NOT NULL,
  label VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed with initial meals from the plan
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
ON CONFLICT DO NOTHING;
