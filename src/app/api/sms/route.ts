import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { phoneNumber, message } = await request.json();

  const { ARKESEL_API_KEY, ARKESEL_SENDER_ID } = process.env;

  if (!ARKESEL_API_KEY || !ARKESEL_SENDER_ID) {
    return NextResponse.json({ error: 'SMS service is not configured on the server.' }, { status: 500 });
  }

  const params = new URLSearchParams({
    action: 'send-sms',
    api_key: ARKESEL_API_KEY,
    to: phoneNumber,
    from: ARKESEL_SENDER_ID,
    sms: message,
  });

  const arkeselUrl = `https://sms.arkesel.com/sms/api?${params.toString()}`;

  try {
    const response = await fetch(arkeselUrl, {
      method: 'GET', // Arkesel uses GET for this API
    });

    if (response.ok) {
      const data = await response.json();
      if (data.code === 'ok' && data.status === 'SUCCESS') {
        return NextResponse.json({ success: true, balance: data.balance, user: data.user });
      } else {
        console.error('Arkesel error response:', data);
        return NextResponse.json({ error: `Arkesel error: ${data.message || 'Unknown error'}` }, { status: 400 });
      }
    } else {
      const errorText = await response.text();
      console.error('Arkesel API request failed:', errorText);
      return NextResponse.json({ error: `Arkesel API request failed: ${response.statusText}` }, { status: response.status });
    }
  } catch (error: any) {
    console.error('Failed to send SMS via Arkesel:', error);
    return NextResponse.json({ error: 'Failed to send SMS.' }, { status: 500 });
  }
}
