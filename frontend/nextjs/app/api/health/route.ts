import { NextResponse } from 'next/server';
import { config } from '@/lib/config';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: config.APP_NAME,
    version: config.APP_VERSION,
  });
}
