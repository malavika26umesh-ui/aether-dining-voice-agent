import * as fs from 'fs';
import * as path from 'path';

function generateSilentWav(): Buffer {
  const sampleRate = 8000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = sampleRate * 1; // 1 second
  const blockAlign = numChannels * (bitsPerSample / 16); // 16 bits = 2 bytes
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // The rest remains 0 (silent audio data)
  return buffer;
}

async function runTest() {
  const port = process.env.PORT || '3001';
  const baseUrl = `http://localhost:${port}`;
  console.log('--- Starting TableVoice Pipeline Test ---');

  // 1. Test STT
  try {
    console.log('\n[1/3] Testing Speech-to-Text API (/api/stt)...');
    const silentWav = generateSilentWav();
    const sttRes = await fetch(`${baseUrl}/api/stt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/wav',
      },
      body: new Uint8Array(silentWav),
    });

    if (!sttRes.ok) {
      throw new Error(`STT failed: ${sttRes.status} ${sttRes.statusText} - ${await sttRes.text()}`);
    }

    const sttData = await sttRes.json();
    console.log('STT Success!');
    console.log('Transcript:', JSON.stringify(sttData.transcript));
    console.log('Confidence:', sttData.confidence);
  } catch (err: any) {
    console.error('STT Step Failed:', err.message);
  }

  // 2. Test LLM
  let llmResponseText = '';
  try {
    console.log('\n[2/3] Testing Dialogue Manager API (/api/llm)...');
    const testMessages = [
      { role: 'user', content: "Hello! I'd like to book a table for standard dining this Saturday at 7 PM IST." }
    ];
    
    const llmRes = await fetch(`${baseUrl}/api/llm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: testMessages,
        sessionState: { test: true },
      }),
    });

    if (!llmRes.ok) {
      throw new Error(`LLM failed: ${llmRes.status} ${llmRes.statusText} - ${await llmRes.text()}`);
    }

    const llmData = await llmRes.json();
    console.log('LLM Success!');
    console.log('Response:', llmData.responseText);
    llmResponseText = llmData.responseText;
  } catch (err: any) {
    console.error('LLM Step Failed:', err.message);
  }

  // 3. Test TTS
  if (llmResponseText) {
    try {
      console.log('\n[3/3] Testing Text-to-Speech Streaming API (/api/tts)...');
      const ttsRes = await fetch(`${baseUrl}/api/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: llmResponseText,
        }),
      });

      if (!ttsRes.ok) {
        throw new Error(`TTS failed: ${ttsRes.status} ${ttsRes.statusText} - ${await ttsRes.text()}`);
      }

      const outputDir = path.join(__dirname);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      const outputPath = path.join(outputDir, 'output.mp3');
      const fileStream = fs.createWriteStream(outputPath);
      
      // Using standard response arrayBuffer
      const arrayBuffer = await ttsRes.arrayBuffer();
      fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));

      console.log('TTS Success!');
      console.log(`Saved speech output to: ${outputPath}`);
      console.log(`File size: ${fs.statSync(outputPath).size} bytes`);
    } catch (err: any) {
      console.error('TTS Step Failed:', err.message);
    }
  } else {
    console.log('\n[3/3] Skipping TTS Test (No text response from LLM)');
  }
}

runTest();
