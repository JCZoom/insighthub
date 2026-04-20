import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';

/**
 * POST /api/voice/transcribe
 *
 * Server-side proxy to OpenAI Whisper API.
 * Accepts audio as multipart form data (field: "audio").
 * Returns { text: string } on success.
 *
 * The OpenAI key never leaves the server.
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication required - prevents abuse of OpenAI proxy
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } catch (error) {
    // Handle auth errors
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Auth error in voice transcribe:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Voice transcription is not configured. Set OPENAI_API_KEY.' },
      { status: 503 }
    );
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio');

    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json(
        { error: 'Missing "audio" field in form data.' },
        { status: 400 }
      );
    }

    // Forward to OpenAI Whisper API
    const whisperForm = new FormData();
    whisperForm.append('file', audioFile, 'recording.webm');
    whisperForm.append('model', 'whisper-1');
    whisperForm.append('language', 'en');
    // response_format=text returns raw text (faster than json — no parsing overhead)
    whisperForm.append('response_format', 'text');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: whisperForm,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Whisper API error:', response.status, errorBody);
      return NextResponse.json(
        { error: 'Transcription failed. Please try again.' },
        { status: 502 }
      );
    }

    // response_format=text returns plain text directly
    const text = (await response.text()).trim();

    return NextResponse.json({ text });
  } catch (err) {
    console.error('Voice transcription error:', err);
    return NextResponse.json(
      { error: 'Internal error during transcription.' },
      { status: 500 }
    );
  }
}
