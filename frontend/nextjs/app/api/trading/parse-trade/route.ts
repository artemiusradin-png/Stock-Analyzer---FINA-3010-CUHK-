import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client lazily to avoid errors if API key is missing
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }
  return new OpenAI({
    apiKey,
  });
}

interface TradeDescription {
  date?: string;
  ticker?: string;
  orderType?: 'market' | 'limit_buy' | 'limit_sell' | 'stop_loss';
  action?: 'buy' | 'sell' | 'short_sell';
  quantity?: number;
  price?: number;
  commission?: number;
  notes?: string;
  confidence: number;
  missing_fields: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, conversationHistory = [] } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Get OpenAI client (will throw if API key not configured)
    let openai;
    try {
      openai = getOpenAIClient();
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'OpenAI API key not configured' }, { status: 500 });
    }

    // Build conversation context
    const systemPrompt = `You are a financial assistant helping to extract trade information from user descriptions. Your job is to parse natural language descriptions of stock trades and extract structured data.

**CRITICAL RULES:**
1. ONLY extract information that is EXPLICITLY stated in the user's message
2. DO NOT guess, assume, or hallucinate any values
3. If a field is not mentioned, mark it as missing
4. Be conservative - if uncertain, mark as missing rather than guessing
5. Dates should be in YYYY-MM-DD format
6. Prices and quantities must be exact numbers from the message
7. Order types: "market", "limit_buy", "limit_sell", "stop_loss"
8. Actions: "buy", "sell", "short_sell"
9. Commission defaults to $5 per FINA3010 rules, but only if not specified

**Response Format (JSON only):**
{
  "date": "YYYY-MM-DD" or null,
  "ticker": "SYMBOL" or null,
  "orderType": "market" | "limit_buy" | "limit_sell" | "stop_loss" or null,
  "action": "buy" | "sell" | "short_sell" or null,
  "quantity": number or null,
  "price": number or null,
  "commission": number or 5 (default),
  "notes": "extracted notes" or null,
  "confidence": 0.0-1.0,
  "missing_fields": ["field1", "field2"],
  "suggestions": "helpful suggestions for missing fields"
}

**Examples:**
User: "I bought 100 shares of AAPL at $150 on January 15th"
Response: {"date": "2026-01-15", "ticker": "AAPL", "action": "buy", "quantity": 100, "price": 150, "orderType": "market", "commission": 5, "confidence": 0.95, "missing_fields": [], "suggestions": "All fields extracted successfully"}

User: "Sold TSLA"
Response: {"date": null, "ticker": "TSLA", "action": "sell", "quantity": null, "price": null, "orderType": null, "commission": 5, "confidence": 0.3, "missing_fields": ["date", "quantity", "price", "orderType"], "suggestions": "Please provide: date, quantity, and price"}

Respond with ONLY valid JSON, no markdown, no explanations.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages as any,
      temperature: 0.1, // Low temperature to reduce hallucinations
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    let parsedTrade: TradeDescription;
    try {
      parsedTrade = JSON.parse(content);
    } catch (error) {
      throw new Error('Invalid JSON response from OpenAI');
    }

    // Validate and sanitize the response
    const validatedTrade: TradeDescription = {
      date: parsedTrade.date && /^\d{4}-\d{2}-\d{2}$/.test(parsedTrade.date) 
        ? parsedTrade.date 
        : undefined,
      ticker: parsedTrade.ticker && typeof parsedTrade.ticker === 'string'
        ? parsedTrade.ticker.toUpperCase().trim()
        : undefined,
      orderType: ['market', 'limit_buy', 'limit_sell', 'stop_loss'].includes(parsedTrade.orderType)
        ? parsedTrade.orderType
        : undefined,
      action: ['buy', 'sell', 'short_sell'].includes(parsedTrade.action)
        ? parsedTrade.action
        : undefined,
      quantity: typeof parsedTrade.quantity === 'number' && parsedTrade.quantity > 0
        ? parsedTrade.quantity
        : undefined,
      price: typeof parsedTrade.price === 'number' && parsedTrade.price > 0
        ? parsedTrade.price
        : undefined,
      commission: typeof parsedTrade.commission === 'number' && parsedTrade.commission >= 0
        ? parsedTrade.commission
        : 5, // Default commission
      notes: typeof parsedTrade.notes === 'string' ? parsedTrade.notes : undefined,
      confidence: typeof parsedTrade.confidence === 'number'
        ? Math.max(0, Math.min(1, parsedTrade.confidence))
        : 0.5,
      missing_fields: Array.isArray(parsedTrade.missing_fields)
        ? parsedTrade.missing_fields
        : [],
    };

    // Determine missing fields
    const missing: string[] = [];
    if (!validatedTrade.date) missing.push('date');
    if (!validatedTrade.ticker) missing.push('ticker');
    if (!validatedTrade.action) missing.push('action');
    if (!validatedTrade.quantity) missing.push('quantity');
    if (!validatedTrade.price) missing.push('price');
    if (!validatedTrade.orderType) missing.push('orderType');

    validatedTrade.missing_fields = missing;

    return NextResponse.json({
      trade: validatedTrade,
      suggestions: parsedTrade.suggestions || `Missing: ${missing.join(', ')}`,
      can_add: missing.length <= 2, // Allow if only 1-2 fields missing (user can fill manually)
    });
  } catch (error: any) {
    console.error('Trade parsing error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to parse trade' },
      { status: 500 }
    );
  }
}
