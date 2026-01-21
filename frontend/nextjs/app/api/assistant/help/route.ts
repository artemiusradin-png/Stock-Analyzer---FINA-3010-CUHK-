import { NextResponse } from 'next/server';
import { config } from '@/lib/config';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    if (!Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY || config.OPENAI_API_KEY || '';
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 503 }
      );
    }

    const prompt = `You are an in-app companion for the FINA3010 trading workspace.
You help users navigate features: Stock Research (overview, DCF, sentiment, risk, add to watchlist/portfolio),
Trading Portfolio (journal, performance), Watchlist, Portfolio Builder (5-10% sizing), Reports, and Learning Center.
Be concise, neutral, and avoid hallucinations. If unsure, say so.
Never invent data or tickers. Do not give investment advice; focus on using the app.`;

    const openAiMessages = [
      { role: 'system', content: prompt },
      ...messages
        .slice(-10)
        .map((m: any) => ({
          role: m?.role === 'assistant' ? 'assistant' : 'user',
          content: String(m?.content ?? ''),
        })),
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: openAiMessages,
        temperature: 0.4,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg =
        errorData?.error?.message || `OpenAI error (${response.status})`;
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const data = await response.json();
    const reply =
      data?.choices?.[0]?.message?.content ??
      'Sorry, I could not generate a response.';
    return NextResponse.json({ reply });
  } catch (err: any) {
    console.error('assistant/help error', err);
    return NextResponse.json({ error: 'Assistant unavailable right now.' }, { status: 500 });
  }
}

