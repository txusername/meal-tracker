'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { format, startOfWeek, addDays, isToday } from 'date-fns';


function PinScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const handleDigit = (d: string) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setError(false);
    if (next.length === 4) {
      setTimeout(() => verify(next), 100);
    }
  };

  const verify = async (code: string) => {
    const res = await fetch(`/api/pin?pin=${code}`);
    const data = await res.json();
    if (data.valid) {
      localStorage.setItem('panel_pin_ok', '1');
      onUnlock();
    } else {
      setShake(true);
      setError(true);
      setPin('');
      setTimeout(() => setShake(false), 500);
    }
  };

  const handleDelete = () => setPin(p => p.slice(0, -1));

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <div style={{ marginBottom: '48px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 600, color: '#f0ece4', margin: 0, letterSpacing: '-0.5px' }}>Panel Nutrition</h1>
        <p style={{ fontSize: '12px', color: '#444', fontFamily: "'DM Mono', monospace", marginTop: '6px' }}>ENTER PIN</p>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '48px' }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            width: '16px', height: '16px', borderRadius: '50%',
            background: pin.length > i ? (error ? '#c0392b' : '#c8b89a') : '#1e1e1e',
            border: `1px solid ${pin.length > i ? 'transparent' : '#2a2a2a'}`,
            transition: 'all 0.15s',
            transform: shake ? 'translateX(4px)' : 'none',
          }} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', width: '240px' }}>
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
          <button key={i} onClick={() => d === '⌫' ? handleDelete() : d ? handleDigit(d) : null}
            disabled={!d}
            style={{
              height: '64px', borderRadius: '14px',
              background: d === '⌫' ? '#1a1a1a' : d ? '#141414' : 'transparent',
              border: `1px solid ${d ? '#1e1e1e' : 'transparent'}`,
              color: '#f0ece4', fontSize: d === '⌫' ? '20px' : '22px',
              fontWeight: 400, cursor: d ? 'pointer' : 'default',
              transition: 'background 0.1s',
            }}>
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}

const MEAL_SLOTS = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { key: 'pre_workout', label: 'Pre-Workout', emoji: '⚡' },
  { key: 'post_workout', label: 'Post-Workout', emoji: '💪' },
  { key: 'lunch', label: 'Lunch', emoji: '☀️' },
  { key: 'dinner', label: 'Dinner', emoji: '🌙' },
  { key: 'snack', label: 'Snack', emoji: '🥜' },
];

const TARGETS = { calories: 2600, protein: 185, carbs: 270, fiber: 35, fat: 75 };

interface Meal {
  id: number; name: string; category: string;
  calories: number; protein: number; carbs: number; fiber: number; fat: number; notes?: string;
}

interface PlanSlot {
  id: number; plan_date: string; meal_slot: string; meal_id: number;
  checked_off: boolean; checked_at?: string;
  name: string; calories: number; protein: number; carbs: number; fiber: number; fat: number; notes?: string;
}

type View = 'today' | 'week' | 'meals' | 'chat';

export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [checkingPin, setCheckingPin] = useState(true);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ok = localStorage.getItem('panel_pin_ok');
      if (ok === '1') setUnlocked(true);
      setCheckingPin(false);
    }
  }, []);
  if (checkingPin) return null;
  if (!unlocked) return <PinScreen onUnlock={() => setUnlocked(true)} />;
  return <AppInner />;
}

function AppInner() {
  const [view, setView] = useState<View>('today');
  const [planSlots, setPlanSlots] = useState<PlanSlot[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [addMealForm, setAddMealForm] = useState({ name:'', category:'breakfast', calories:'', protein:'', carbs:'', fiber:'', fat:'', notes:'' });
  const [editMeal, setEditMeal] = useState<Meal | null>(null);
  const [editMealForm, setEditMealForm] = useState({ name:'', category:'breakfast', calories:'', protein:'', carbs:'', fiber:'', fat:'', notes:'' });
  const [showOneOff, setShowOneOff] = useState(false);
  const [oneOffForm, setOneOffForm] = useState({ name:'', category:'dinner', calories:'', protein:'', carbs:'', fiber:'', fat:'', notes:'' });
  const [loading, setLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<{id: number, role: 'user'|'assistant', content: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatUnread, setChatUnread] = useState(false);
  const [chatLoaded, setChatLoaded] = useState(false);

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    try {
      const date = format(selectedDate, 'yyyy-MM-dd');
      const res = await fetch(`/api/plan?date=${date}&week=${view === 'week' ? 'true' : 'false'}`);
      const data = await res.json();
      setPlanSlots(Array.isArray(data) ? data : []);
    } catch (e) {} finally { setLoading(false); }
  }, [selectedDate, view]);

  const fetchMeals = useCallback(async () => {
    const res = await fetch('/api/meals');
    const data = await res.json();
    setMeals(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { fetchPlan(); }, [fetchPlan]);
  useEffect(() => { fetchMeals(); }, [fetchMeals]);
  useEffect(() => {
    if (view !== 'chat') return;
    setChatUnread(false);
    if (chatLoaded) return;
    async function load() {
      const res = await fetch('/api/chat');
      const data = await res.json();
      if (Array.isArray(data)) {
        setChatMessages(data.map((m: any) => ({ id: m.id, role: m.role, content: m.content })));
      }
      setChatLoaded(true);
    }
    load();
  }, [view, chatLoaded]);
  useEffect(() => {
    async function setup() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      navigator.serviceWorker.addEventListener('message', (e: MessageEvent) => {
        if (e.data?.type === 'OPEN_CHAT') setView('chat');
      });
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) return;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey,
        });
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub }),
        });
      } catch {}
    }
    setup();
  }, []);

  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { id: Date.now(), role: 'user', content: msg }]);
    setChatLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();
      if (data.response) {
        setChatMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: data.response }]);
      }
    } catch {} finally {
      setChatLoading(false);
    }
  };

  const checkOff = async (slot: PlanSlot) => {
    const newVal = !slot.checked_off;
    setPlanSlots(prev => prev.map(s => s.id === slot.id ? { ...s, checked_off: newVal } : s));
    await fetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_date: slot.plan_date, meal_slot: slot.meal_slot, checked_off: newVal }),
    });
  };

  const addMeal = async () => {
    if (!addMealForm.name || !addMealForm.calories) return;
    await fetch('/api/meals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...addMealForm,
        calories: Number(addMealForm.calories), protein: Number(addMealForm.protein),
        carbs: Number(addMealForm.carbs), fiber: Number(addMealForm.fiber), fat: Number(addMealForm.fat),
      }),
    });
    setAddMealForm({ name:'', category:'breakfast', calories:'', protein:'', carbs:'', fiber:'', fat:'', notes:'' });
    setShowAddMeal(false);
    fetchMeals();
  };

  const openEditMeal = (meal: Meal) => {
    setEditMeal(meal);
    setEditMealForm({
      name: meal.name, category: meal.category,
      calories: String(meal.calories), protein: String(meal.protein),
      carbs: String(meal.carbs), fiber: String(meal.fiber),
      fat: String(meal.fat), notes: meal.notes || '',
      one_off: (meal as any).one_off || false,
    } as any);
  };

  const updateMeal = async () => {
    if (!editMeal || !editMealForm.name || !editMealForm.calories) return;
    await fetch(`/api/meals/${editMeal.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...editMealForm,
        calories: Number(editMealForm.calories), protein: Number(editMealForm.protein),
        carbs: Number(editMealForm.carbs), fiber: Number(editMealForm.fiber), fat: Number(editMealForm.fat),
        one_off: (editMealForm as any).one_off || false,
      }),
    });
    setEditMeal(null);
    fetchMeals();
  };

  const logOneOff = async () => {
    if (!oneOffForm.name || !oneOffForm.calories) return;
    const mealRes = await fetch('/api/meals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...oneOffForm,
        calories: Number(oneOffForm.calories), protein: Number(oneOffForm.protein),
        carbs: Number(oneOffForm.carbs), fiber: Number(oneOffForm.fiber), fat: Number(oneOffForm.fat),
        one_off: true,
      }),
    });
    const meal = await mealRes.json();
    await fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_date: format(selectedDate, 'yyyy-MM-dd'), meal_slot: oneOffForm.category, meal_id: meal.id }),
    });
    setShowOneOff(false);
    setOneOffForm({ name:'', category:'dinner', calories:'', protein:'', carbs:'', fiber:'', fat:'', notes:'' });
    fetchPlan();
  };

  const todaySlots = planSlots.filter(s => s.plan_date.startsWith(format(selectedDate, 'yyyy-MM-dd')));
  const checkedSlots = todaySlots.filter(s => s.checked_off);
  const todayMacros = checkedSlots.reduce((acc, s) => ({
    calories: acc.calories + Number(s.calories), protein: acc.protein + Number(s.protein),
    carbs: acc.carbs + Number(s.carbs), fiber: acc.fiber + Number(s.fiber), fat: acc.fat + Number(s.fat),
  }), { calories: 0, protein: 0, carbs: 0, fiber: 0, fat: 0 } as {calories:number,protein:number,carbs:number,fiber:number,fat:number});

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#f0ece4', fontFamily: "'DM Sans', sans-serif", paddingBottom: '80px', overflow: view === 'chat' ? 'hidden' : undefined }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid #1e1e1e' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 600, margin: 0, letterSpacing: '-0.5px' }}>Panel Nutrition</h1>
          <span style={{ fontSize: '12px', color: '#666', fontFamily: "'DM Mono', monospace" }}>DREW · PHASE 1</span>
        </div>
        {view === 'today' && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px', fontFamily: "'DM Mono', monospace" }}>
              {format(selectedDate, 'EEEE, MMM d').toUpperCase()} · {checkedSlots.length}/{todaySlots.length} MEALS
            </div>
            <MacroBar macros={todayMacros} targets={TARGETS} />
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '20px' }}>
        {view === 'today' && (
          <TodayView slots={todaySlots} onCheck={checkOff} onLogOneOff={() => setShowOneOff(true)} />
        )}
        {view === 'week' && (
          <WeekView days={weekDays} slots={planSlots} onCheck={checkOff} onDaySelect={d => { setSelectedDate(d); setView('today'); }} />
        )}
        {view === 'meals' && (
          <MealsView meals={meals} onAdd={() => setShowAddMeal(true)} onEdit={openEditMeal} />
        )}
        {view === 'chat' && (
          <ChatView messages={chatMessages} input={chatInput} onInputChange={setChatInput} onSend={sendChatMessage} loading={chatLoading} />
        )}
      </div>

      {/* Bottom nav */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#111', borderTop: '1px solid #1e1e1e', display: 'flex', padding: '8px 0' }}>
        {[
          { key: 'today', label: 'Today', icon: '◉' },
          { key: 'week', label: 'Week', icon: '▦' },
          { key: 'meals', label: 'Meals', icon: '≡' },
          { key: 'chat', label: 'Chat', icon: '💬' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setView(tab.key as View)}
            style={{ flex: 1, background: 'none', border: 'none', color: view === tab.key ? '#c8b89a' : '#555',
              fontSize: '10px', fontFamily: "'DM Mono', monospace", cursor: 'pointer', padding: '8px 0',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', transition: 'color 0.2s' }}>
            <span style={{ fontSize: '18px', position: 'relative', display: 'inline-block' }}>
              {tab.icon}
              {tab.key === 'chat' && chatUnread && (
                <span style={{ position: 'absolute', top: 0, right: '-3px', width: '7px', height: '7px', borderRadius: '50%', background: '#993C1D', border: '1px solid #111' }} />
              )}
            </span>
            {tab.label.toUpperCase()}
          </button>
        ))}
      </div>

      {/* One-Off Meal Modal */}
      {showOneOff && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }}>
          <div style={{ background: '#141414', width: '100%', borderRadius: '20px 20px 0 0', padding: '24px 20px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Log One-Off Meal</h2>
              <button onClick={() => setShowOneOff(false)} style={{ background: 'none', border: 'none', color: '#666', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>
            <p style={{ fontSize: '12px', color: '#555', marginBottom: '20px', fontFamily: "'DM Mono', monospace" }}>SAVED TO TODAY ONLY · NOT ADDED TO LIBRARY</p>
            {[
              { key: 'name', label: 'Meal Name', type: 'text' },
              { key: 'calories', label: 'Calories', type: 'number' },
              { key: 'protein', label: 'Protein (g)', type: 'number' },
              { key: 'carbs', label: 'Carbs (g)', type: 'number' },
              { key: 'fiber', label: 'Fiber (g)', type: 'number' },
              { key: 'fat', label: 'Fat (g)', type: 'number' },
              { key: 'notes', label: 'Notes', type: 'text' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '11px', color: '#666', fontFamily: "'DM Mono', monospace", display: 'block', marginBottom: '4px' }}>{f.label.toUpperCase()}</label>
                <input type={f.type} value={(oneOffForm as any)[f.key]}
                  onChange={e => setOneOffForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ width: '100%', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '10px 12px', color: '#f0ece4', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
            ))}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', color: '#666', fontFamily: "'DM Mono', monospace", display: 'block', marginBottom: '4px' }}>MEAL SLOT</label>
              <select value={oneOffForm.category} onChange={e => setOneOffForm(prev => ({ ...prev, category: e.target.value }))}
                style={{ width: '100%', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '10px 12px', color: '#f0ece4', fontSize: '14px' }}>
                {MEAL_SLOTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <button onClick={logOneOff}
              style={{ width: '100%', background: '#c8b89a', color: '#0a0a0a', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}>
              Log Meal
            </button>
          </div>
        </div>
      )}

      {/* Edit Meal Modal */}
      {editMeal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }}>
          <div style={{ background: '#141414', width: '100%', borderRadius: '20px 20px 0 0', padding: '24px 20px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Edit Meal</h2>
              <button onClick={() => setEditMeal(null)} style={{ background: 'none', border: 'none', color: '#666', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>
            {[
              { key: 'name', label: 'Meal Name', type: 'text' },
              { key: 'calories', label: 'Calories', type: 'number' },
              { key: 'protein', label: 'Protein (g)', type: 'number' },
              { key: 'carbs', label: 'Carbs (g)', type: 'number' },
              { key: 'fiber', label: 'Fiber (g)', type: 'number' },
              { key: 'fat', label: 'Fat (g)', type: 'number' },
              { key: 'notes', label: 'Notes', type: 'text' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '11px', color: '#666', fontFamily: "'DM Mono', monospace", display: 'block', marginBottom: '4px' }}>{f.label.toUpperCase()}</label>
                <input type={f.type} value={(editMealForm as any)[f.key]}
                  onChange={e => setEditMealForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ width: '100%', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '10px 12px', color: '#f0ece4', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
            ))}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', color: '#666', fontFamily: "'DM Mono', monospace", display: 'block', marginBottom: '4px' }}>CATEGORY</label>
              <select value={editMealForm.category} onChange={e => setEditMealForm(prev => ({ ...prev, category: e.target.value }))}
                style={{ width: '100%', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '10px 12px', color: '#f0ece4', fontSize: '14px' }}>
                {MEAL_SLOTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#1e1e1e', borderRadius: '8px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>One-off meal</div>
                <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>Hide from meal library</div>
              </div>
              <button onClick={() => setEditMealForm(prev => ({ ...prev, one_off: !(prev as any).one_off }))}
                style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'background 0.2s',
                  background: (editMealForm as any).one_off ? '#c8b89a' : '#2a2a2a', position: 'relative' }}>
                <span style={{ position: 'absolute', top: '2px', width: '20px', height: '20px', borderRadius: '50%', background: '#f0ece4', transition: 'left 0.2s',
                  left: (editMealForm as any).one_off ? '22px' : '2px' }} />
              </button>
            </div>
            <button onClick={updateMeal}
              style={{ width: '100%', background: '#c8b89a', color: '#0a0a0a', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}>
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* Add Meal Modal */}
      {showAddMeal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }}>
          <div style={{ background: '#141414', width: '100%', borderRadius: '20px 20px 0 0', padding: '24px 20px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Add Meal</h2>
              <button onClick={() => setShowAddMeal(false)} style={{ background: 'none', border: 'none', color: '#666', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>
            {[
              { key: 'name', label: 'Meal Name', type: 'text', full: true },
              { key: 'calories', label: 'Calories', type: 'number' },
              { key: 'protein', label: 'Protein (g)', type: 'number' },
              { key: 'carbs', label: 'Carbs (g)', type: 'number' },
              { key: 'fiber', label: 'Fiber (g)', type: 'number' },
              { key: 'fat', label: 'Fat (g)', type: 'number' },
              { key: 'notes', label: 'Notes', type: 'text', full: true },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '11px', color: '#666', fontFamily: "'DM Mono', monospace", display: 'block', marginBottom: '4px' }}>{f.label.toUpperCase()}</label>
                <input type={f.type} value={(addMealForm as any)[f.key]}
                  onChange={e => setAddMealForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ width: '100%', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '10px 12px', color: '#f0ece4', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
            ))}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', color: '#666', fontFamily: "'DM Mono', monospace", display: 'block', marginBottom: '4px' }}>CATEGORY</label>
              <select value={addMealForm.category} onChange={e => setAddMealForm(prev => ({ ...prev, category: e.target.value }))}
                style={{ width: '100%', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '10px 12px', color: '#f0ece4', fontSize: '14px' }}>
                {MEAL_SLOTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <button onClick={addMeal}
              style={{ width: '100%', background: '#c8b89a', color: '#0a0a0a', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}>
              Add Meal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MacroBar({ macros, targets }: { macros: any, targets: any }) {
  const items = [
    { key: 'protein', label: 'P', color: '#7eb8a4' },
    { key: 'carbs', label: 'C', color: '#c8b89a' },
    { key: 'fiber', label: 'F', color: '#8ba888' },
    { key: 'fat', label: 'FA', color: '#b89ab8' },
  ];
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', fontFamily: "'DM Mono', monospace", color: '#c8b89a' }}>{macros.calories}<span style={{ color: '#444' }}>/{targets.calories}</span></span>
        <span style={{ fontSize: '11px', color: '#555', fontFamily: "'DM Mono', monospace" }}>KCAL</span>
      </div>
      <div style={{ height: '4px', background: '#1e1e1e', borderRadius: '2px', marginBottom: '12px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, (macros.calories / targets.calories) * 100)}%`, background: '#c8b89a', borderRadius: '2px', transition: 'width 0.5s ease' }} />
      </div>
      <div style={{ display: 'flex', gap: '12px' }}>
        {items.map(item => (
          <div key={item.key} style={{ flex: 1 }}>
            <div style={{ fontSize: '10px', color: '#555', fontFamily: "'DM Mono', monospace", marginBottom: '4px' }}>{item.label}</div>
            <div style={{ height: '3px', background: '#1e1e1e', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, ((macros as any)[item.key] / (targets as any)[item.key]) * 100)}%`, background: item.color, borderRadius: '2px', transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ fontSize: '10px', color: '#444', fontFamily: "'DM Mono', monospace", marginTop: '3px' }}>{Math.round((macros as any)[item.key])}g</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TodayView({ slots, onCheck, onLogOneOff }: { slots: PlanSlot[], onCheck: (s: PlanSlot) => void, onLogOneOff: () => void }) {
  if (slots.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#444' }}>
      <div style={{ fontSize: '40px', marginBottom: '16px' }}>📋</div>
      <div style={{ fontSize: '14px', fontFamily: "'DM Mono', monospace" }}>NO MEALS PLANNED FOR TODAY</div>
      <div style={{ fontSize: '12px', marginTop: '8px', color: '#333' }}>The panel will post your weekly plan here</div>
      <button onClick={onLogOneOff} style={{ marginTop: '20px', background: '#1e1e1e', border: '1px dashed #2a2a2a', borderRadius: '10px', padding: '10px 20px', color: '#666', fontSize: '12px', fontFamily: "'DM Mono', monospace", cursor: 'pointer' }}>+ LOG A MEAL</button>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {MEAL_SLOTS.map(slot => {
        const planSlot = slots.find(s => s.meal_slot === slot.key);
        if (!planSlot) return null;
        return (
          <button key={slot.key} onClick={() => onCheck(planSlot)}
            style={{ background: planSlot.checked_off ? '#141f1a' : '#141414', border: `1px solid ${planSlot.checked_off ? '#2a4a36' : '#1e1e1e'}`,
              borderRadius: '12px', padding: '14px 16px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: planSlot.checked_off ? '#1a3a26' : '#1e1e1e',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
                {planSlot.checked_off ? '✓' : slot.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: planSlot.checked_off ? '#5a8a6a' : '#f0ece4',
                    textDecoration: planSlot.checked_off ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                    {planSlot.name}
                  </span>
                  <span style={{ fontSize: '13px', color: '#c8b89a', fontFamily: "'DM Mono', monospace", flexShrink: 0, marginLeft: '8px' }}>
                    {planSlot.calories} cal
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#555', fontFamily: "'DM Mono', monospace", marginTop: '4px' }}>
                  {slot.label.toUpperCase()} · P{planSlot.protein}g C{planSlot.carbs}g Fi{planSlot.fiber}g Fa{planSlot.fat}g
                </div>
              </div>
            </div>
          </button>
        );
      })}
      <button onClick={onLogOneOff}
        style={{ background: 'transparent', border: '1px dashed #2a2a2a', borderRadius: '10px', padding: '12px', color: '#444',
          fontSize: '12px', fontFamily: "'DM Mono', monospace", cursor: 'pointer', marginTop: '4px', letterSpacing: '0.5px' }}>
        + LOG ONE-OFF MEAL
      </button>
    </div>
  );
}

function WeekView({ days, slots, onCheck, onDaySelect }: { days: Date[], slots: PlanSlot[], onCheck: (s: PlanSlot) => void, onDaySelect: (d: Date) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {days.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const daySlots = slots.filter(s => s.plan_date.startsWith(dateStr));
        const checked = daySlots.filter(s => s.checked_off).length;
        const pct = daySlots.length > 0 ? (checked / daySlots.length) * 100 : 0;
        return (
          <div key={dateStr} style={{ background: '#141414', border: `1px solid ${isToday(day) ? '#2a3a2a' : '#1e1e1e'}`, borderRadius: '12px', overflow: 'hidden' }}>
            <button onClick={() => onDaySelect(day)}
              style={{ width: '100%', background: 'none', border: 'none', padding: '12px 16px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: isToday(day) ? '#c8b89a' : '#f0ece4' }}>{format(day, 'EEEE')}</span>
                <span style={{ fontSize: '11px', color: '#555', fontFamily: "'DM Mono', monospace", marginLeft: '8px' }}>{format(day, 'MMM d')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: '#555', fontFamily: "'DM Mono', monospace" }}>{checked}/{daySlots.length}</span>
                <div style={{ width: '40px', height: '4px', background: '#1e1e1e', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: '#7eb8a4', borderRadius: '2px' }} />
                </div>
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}

function MealsView({ meals, onAdd, onEdit }: { meals: Meal[], onAdd: () => void, onEdit: (m: Meal) => void }) {
  const grouped = MEAL_SLOTS.reduce((acc, slot) => {
    acc[slot.key] = meals.filter(m => m.category === slot.key);
    return acc;
  }, {} as Record<string, Meal[]>);

  return (
    <div>
      <button onClick={onAdd}
        style={{ width: '100%', background: '#1e1e1e', border: '1px dashed #2a2a2a', borderRadius: '12px', padding: '14px', color: '#666',
          fontSize: '13px', fontFamily: "'DM Mono', monospace", cursor: 'pointer', marginBottom: '20px', letterSpacing: '0.5px' }}>
        + ADD MEAL TO LIBRARY
      </button>
      {MEAL_SLOTS.map(slot => {
        const slotMeals = grouped[slot.key] || [];
        if (slotMeals.length === 0) return null;
        return (
          <div key={slot.key} style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', color: '#555', fontFamily: "'DM Mono', monospace", marginBottom: '8px', letterSpacing: '1px' }}>
              {slot.emoji} {slot.label.toUpperCase()}
            </div>
            {slotMeals.map(meal => (
              <div key={meal.id} style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: '10px', padding: '12px 14px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: 500 }}>{meal.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '13px', color: '#c8b89a', fontFamily: "'DM Mono', monospace" }}>{meal.calories}</span>
                    <button onClick={() => onEdit(meal)}
                      style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#555', fontSize: '11px',
                        fontFamily: "'DM Mono', monospace", padding: '3px 8px', cursor: 'pointer', letterSpacing: '0.5px' }}>
                      EDIT
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: '#444', fontFamily: "'DM Mono', monospace", marginTop: '4px' }}>
                  P{meal.protein}g · C{meal.carbs}g · Fi{meal.fiber}g · Fa{meal.fat}g
                </div>
                {meal.notes && <div style={{ fontSize: '11px', color: '#444', marginTop: '4px' }}>{meal.notes}</div>}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function ChatView({ messages, input, onInputChange, onSend, loading }: {
  messages: {id: number, role: 'user'|'assistant', content: string}[];
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  loading: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <div style={{ position: 'fixed', top: '70px', bottom: '72px', left: 0, right: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 20px' }}>
        {messages.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#444' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>💬</div>
            <div style={{ fontSize: '13px', fontFamily: "'DM Mono', monospace" }}>COACH BRIGGS IS READY</div>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: '8px' }}>
            {msg.role === 'assistant' && (
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#993C1D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#fff', flexShrink: 0, fontFamily: "'DM Mono', monospace" }}>
                CB
              </div>
            )}
            <div style={{
              maxWidth: '80%', padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              background: msg.role === 'user' ? '#c8b89a' : '#1e1e1e',
              color: msg.role === 'user' ? '#0a0a0a' : '#f0ece4',
              fontSize: '14px', lineHeight: '1.5',
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#993C1D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#fff', flexShrink: 0, fontFamily: "'DM Mono', monospace" }}>
              CB
            </div>
            <div style={{ padding: '10px 14px', borderRadius: '18px 18px 18px 4px', background: '#1e1e1e', color: '#555', fontSize: '13px', fontFamily: "'DM Mono', monospace" }}>
              TYPING...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: 'flex', gap: '8px', padding: '12px 20px', borderTop: '1px solid #1e1e1e', background: '#0a0a0a' }}>
        <input
          value={input}
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && onSend()}
          placeholder="Message Briggs..."
          style={{ flex: 1, background: '#141414', border: '1px solid #2a2a2a', borderRadius: '20px', padding: '10px 16px', color: '#f0ece4', fontSize: '14px', outline: 'none' }}
        />
        <button
          onClick={onSend}
          disabled={!input.trim() || loading}
          style={{ width: '40px', height: '40px', borderRadius: '50%', background: input.trim() && !loading ? '#c8b89a' : '#1e1e1e', border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', transition: 'background 0.2s', flexShrink: 0 }}>
          ↑
        </button>
      </div>
    </div>
  );
}
