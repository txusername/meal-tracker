# Panel Nutrition — Meal Tracker PWA

A mobile-first meal tracking Progressive Web App for the coaching panel.

## Features
- Daily meal check-off (tap once to mark a meal as eaten)
- Macro tracking: Calories, Protein, Carbs, Fiber, Fat
- Weekly compliance view
- Meals library
- MCP API for the coaching panel to post weekly meal plans

## Deploy to Vercel

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
gh repo create meal-tracker --public
git push origin main
```

### 2. Create Vercel Postgres Database
- Go to vercel.com → your project → Storage → Create Database → Postgres
- Connect it to your project (this auto-sets POSTGRES_URL env vars)

### 3. Deploy on Vercel
- Import your GitHub repo at vercel.com/new
- Vercel auto-detects Next.js
- Add environment variable: `MCP_AUTH_TOKEN` = a secret token for panel API access

### 4. Initialize the Database
After deploy, visit:
```
https://your-app.vercel.app/api/init
```
This creates tables and seeds initial meals.

### 5. Add to Phone Home Screen
- Open the app URL in Safari (iOS) or Chrome (Android)
- iOS: Share → Add to Home Screen
- Android: Menu → Add to Home Screen

## MCP API

The panel can post weekly meal plans via:

```
POST https://your-app.vercel.app/api/mcp
Authorization: Bearer YOUR_MCP_AUTH_TOKEN

{
  "action": "post_weekly_plan",
  "data": [
    { "plan_date": "2026-05-25", "meal_slot": "breakfast", "meal_id": 1 },
    { "plan_date": "2026-05-25", "meal_slot": "lunch", "meal_id": 4 }
  ]
}
```

### Available actions:
- `post_weekly_plan` — set meal plan for a week
- `add_meal` — add a new meal to the library
- `get_compliance` — get check-off compliance for a date range
- `get_meals` — list all meals in the library

## Macro Targets (Phase 1)
- Calories: 2,600
- Protein: 185g
- Carbs: 270g
- Fiber: 35g
- Fat: 75g
