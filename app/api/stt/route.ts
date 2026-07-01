import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    const audioBuffer = await req.arrayBuffer();
    if (!audioBuffer || audioBuffer.byteLength === 0) {
      return NextResponse.json({ error: 'Empty audio data' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing GOOGLE_API_KEY' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: 'You are an expert audio transcription assistant. Transcribe the spoken audio exactly. Return only the transcription, with no metadata, notes, or extra commentary. If there is no speech, return an empty string.',
    });

    const contentType = req.headers.get('content-type') || 'audio/wav';
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Audio,
          mimeType: contentType,
        },
      },
      'Transcribe the audio.',
    ]);

    const transcript = result.response.text().trim();
    
    return NextResponse.json({ transcript, confidence: 0.95 });
  } catch (error: any) {
    console.error('STT Route Error:', error);
    return NextResponse.json({ error: error.message || 'STT compilation or execution failed' }, { status: 500 });
  }
}
