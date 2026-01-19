import { fetchFitExamples } from '@/lib/blob';

// Use Node.js runtime to allow local file fallback in development
export const runtime = 'nodejs';

export async function GET() {
  try {
    const examples = await fetchFitExamples();
    return Response.json(examples);
  } catch (error) {
    console.error('Failed to fetch fit examples:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to load examples' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
