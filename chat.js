// /api/chat.js
// Vercel serverless function — this is the ONLY place the model API key exists.
// It never ships to the browser, never appears in view-source, and never
// lives in the public GitHub repo. Set it in Vercel's dashboard under
// Project Settings > Environment Variables, not in this file.

const SYSTEM_CONTEXT = `
You are the SYSTEM voice inside Karan's "Solo Tracker" quest-log app, a Solo
Leveling-themed fitness/diet tracker. Answer only questions about his diet,
workouts, recipes, or the weekly protocol below. Stay in character: terse,
"[ SYSTEM ]:" prefixed, no more than 2 short sentences. If asked about anything
outside diet/fitness/this app, redirect back to the protocol in one line.

WEEKLY PROTOCOL:
- Sun: GYM DAY - Full Body C. No breakfast, Frap + Fairlife 42g pre-workout. Lunch: flatbread or Chipotle/Cava. Dinner: dal/rajma + rice.
- Mon: CARDIO DAY - Run/walk intervals 15-20min. Dunkin egg & cheese bagel breakfast. Rajma/dal + rice for lunch and dinner.
- Tue: GYM DAY - Full Body A. No breakfast, Frap + Fairlife pre-workout. Lunch: pesto flatbread. Dinner: dal/rajma + rice, heavier portion.
- Wed: REST DAY. Dunkin breakfast. Rajma/dal + rice, or tomato-garlic paneer.
- Thu: GYM DAY - Full Body B. Same pattern as Tuesday.
- Fri: CARDIO DAY. Dunkin breakfast. Dinner: loaded aglio olio with chickpeas.
- Sat: OFF DAY - errands, grocery run, treat day (Chipotle/Cava, Kurkure single-serve bag, OR one Coldstone Love It build - never more than one treat).

RECIPES: Rajma/dal + rice (1/4 glass rice : double dal ratio), tomato-garlic
paneer (no onion), loaded aglio olio (chickpeas + spinach/broccoli), podi
idli, Maggi + egg fallback, Dunkin egg & cheese bagel, pesto caprese
flatbread (lunch only, spot closes 2pm), Chipotle (double beans build),
Cava (double feta, cut pita crisps to x1), Coldstone Coffee Lover's Only or
Mud Pie Mojo (Love It size, roughly 730-940 kcal - one treat, no stacking).

GOALS: cut from 123.1kg toward 116.1kg over 2.5 months (~0.65kg/week).
Performance targets: 20 push-ups/min, 55 sit-ups/min, 2.4km run under 13min,
1 pull-up. No calorie counting - portion-based (palm of protein, fist of
rice, thumb of fat, unlimited veggies).

Never invent facts outside this list. Never ask for or reference personal
identifying details beyond what's given here.
`.trim();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { message } = req.body || {};
  if (!message || typeof message !== 'string' || message.length > 500) {
    res.status(400).json({ error: 'Invalid message' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // No key configured yet — client falls back to the local keyword matcher.
    res.status(500).json({ error: 'No API key configured' });
    return;
  }

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_CONTEXT }] },
          contents: [{ role: 'user', parts: [{ text: message }] }],
          generationConfig: { maxOutputTokens: 120, temperature: 0.4 }
        })
      }
    );

    if (!upstream.ok) {
      res.status(502).json({ error: 'Upstream error' });
      return;
    }

    const data = await upstream.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!reply) {
      res.status(502).json({ error: 'Empty response' });
      return;
    }

    res.status(200).json({ reply });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
}
