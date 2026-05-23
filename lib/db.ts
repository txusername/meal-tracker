import { neon } from '@neondatabase/serverless';

const neonSql = neon(process.env.DATABASE_URL!);

// Wrap neon to return { rows } like @vercel/postgres did
export const sql = new Proxy(neonSql, {
  apply: async (target, thisArg, args) => {
    const rows = await Reflect.apply(target, thisArg, args);
    return { rows };
  }
}) as unknown as typeof neonSql & ((...args: any[]) => Promise<{ rows: any[] }>);

export interface Meal {
  id: number; name: string; category: string;
  calories: number; protein: number; carbs: number; fiber: number; fat: number; notes?: string;
}

export const MEAL_SLOTS = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { key: 'pre_workout', label: 'Pre-Workout', emoji: '⚡' },
  { key: 'post_workout', label: 'Post-Workout', emoji: '💪' },
  { key: 'lunch', label: 'Lunch', emoji: '☀️' },
  { key: 'dinner', label: 'Dinner', emoji: '🌙' },
  { key: 'snack', label: 'Snack', emoji: '🥜' },
];

export const MACRO_TARGETS = {
  calories: 2600, protein: 185, carbs: 270, fiber: 35, fat: 75,
};