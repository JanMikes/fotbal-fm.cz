import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    console.log('=== CLIENT DEBUG LOG ===');
    console.log('Form:', data.form);
    console.log('User Agent:', data.userAgent);
    console.log('Timestamp:', new Date().toISOString());
    console.log('Validation Errors:', JSON.stringify(data.errors, null, 2));
    console.log('Form Values:', JSON.stringify(data.formValues, null, 2));
    console.log('========================');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Debug log error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
