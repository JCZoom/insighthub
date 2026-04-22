import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

// GET /api/health — public health check endpoint for monitoring (basic status only)
export async function GET() {
  // Simple database connectivity check
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      {
        status: 'degraded',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
