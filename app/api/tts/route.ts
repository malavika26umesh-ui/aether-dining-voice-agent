import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing SARVAM_API_KEY' }, { status: 500 });
    }

    const response = await fetch('https://api.sarvam.ai/text-to-speech/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey,
      },
      body: JSON.stringify({
        text: text,
        target_language_code: 'en-IN',
        speaker: 'shubh',
        model: 'bulbul:v3',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Sarvam AI Stream Error:', errorText);
      return NextResponse.json({ error: `Sarvam AI API failed: ${errorText}` }, { status: response.status });
    }

    if (!response.body) {
      return NextResponse.json({ error: 'No response body from Sarvam AI' }, { status: 500 });
    }

    // Return the response stream directly as audio/mpeg
    return new Response(response.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error: any) {
    console.error('TTS Route Error:', error);
    return NextResponse.json({ error: error.message || 'TTS execution failed' }, { status: 500 });
  }
}
