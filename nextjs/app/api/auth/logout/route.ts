import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/session';
import { ApiResponse } from '@/types/api';

export async function POST() {
  try {
    await destroySession();

    return NextResponse.json<ApiResponse>({
      success: true,
    });
  } catch (error) {
    console.error('Logout error:', error);

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: 'Chyba při odhlašování',
      },
      { status: 500 }
    );
  }
}
