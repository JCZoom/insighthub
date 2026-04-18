import { NextResponse } from 'next/server';

// GET /api/health — health check endpoint for monitoring
export async function GET() {
  const checks: Record<string, string> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
  };

  // Check database connectivity
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    checks.database = 'connected';
  } catch {
    checks.database = 'disconnected';
  }

  // Check if Anthropic key is configured
  checks.ai = process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing';

  const isHealthy = checks.database === 'connected';
  return NextResponse.json(checks, { status: isHealthy ? 200 : 503 });
}
