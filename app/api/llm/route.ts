import { NextRequest, NextResponse } from 'next/server';
import { processDialogueTurn, initSessionState, SessionState } from '@/lib/dialogue/stateMachine';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const { messages, sessionState } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid or missing messages array' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing GOOGLE_API_KEY' }, { status: 500 });
    }

    // Retrieve or initialize session state
    let state = sessionState as SessionState;
    if (!state || !state.sessionId) {
      const sessionId = 'session_' + Math.random().toString(36).substring(2, 11);
      state = initSessionState(sessionId);
    }

    // Retrieve user message (the last item in messages array)
    const lastUserMsg = messages[messages.length - 1];
    const userMessage = lastUserMsg?.content || '';

    // Synchronize previous messages into state history to ensure consistency
    const previousMessages = messages.slice(0, -1);
    state.conversationHistory = previousMessages.map((msg: Message) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Run dialogue pipeline
    const { responseText, updatedState } = await processDialogueTurn(userMessage, state);

    return NextResponse.json({
      responseText,
      updatedState,
    });
  } catch (error: any) {
    console.error('LLM Route Error:', error);
    return NextResponse.json({ error: error.message || 'LLM execution failed' }, { status: 500 });
  }
}

