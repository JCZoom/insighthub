import { NextResponse } from 'next/server';

// GET /api/health — public health check endpoint for monitoring (basic status only)
export async function GET() {
  // Simple database connectivity check
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();

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
