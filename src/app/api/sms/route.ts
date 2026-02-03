import { NextResponse } from 'next/server';

function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const cleaned = String(phone || '').replace(/\D/g, '');
  
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    // Replace leading '0' with '233' for Ghanaian numbers (e.g., 024... -> 23324...)
    return '233' + cleaned.substring(1);
  }
  
  if (cleaned.startsWith('233') && cleaned.length === 12) {
    // Already in correct format
    return cleaned;
  }
  
  // Best-effort for other formats. Arkesel expects digits only.
  return cleaned;
}


export async function POST(request: Request) {
  const { phoneNumber, message } = await request.json();

  if (!phoneNumber || !message) {
    return NextResponse.json({ error: 'Phone number and message are required.' }, { status: 400 });
  }

  const { ARKESEL_API_KEY, ARKESEL_SENDER_ID } = process.env;

  if (!ARKESEL_API_KEY || !ARKESEL_SENDER_ID) {
    return NextResponse.json({ error: 'SMS service is not configured on the server. Please check .env.local file.' }, { status: 500 });
  }

  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
  
  if (!normalizedPhoneNumber) {
    return NextResponse.json({ error: 'Invalid or empty phone number provided.' }, { status: 400 });
  }

  const params = new URLSearchParams({
    action: 'send-sms',
    api_key: ARKESEL_API_KEY,
    to: normalizedPhoneNumber,
    from: ARKESEL_SENDER_ID,
    sms: message,
  });

  const arkeselUrl = `https://sms.arkesel.com/sms/api?${params.toString()}`;

  try {
    const response = await fetch(arkeselUrl, {
      method: 'GET', // Arkesel uses GET for this API
    });

    const responseText = await response.text();

    if (response.ok) {
      try {
        const data = JSON.parse(responseText);
        if (data.code === 'ok' && data.status === 'SUCCESS') {
          return NextResponse.json({ success: true, balance: data.balance, user: data.user });
        } else {
          console.error('Arkesel error response:', data);
          return NextResponse.json({ error: `Arkesel error: ${data.message || 'Unknown error'}` }, { status: 400 });
        }
      } catch (e) {
         if (responseText.toLowerCase().includes('sent successfully')) {
             return NextResponse.json({ success: true });
         }
         console.error('Arkesel returned non-JSON response:', responseText);
         return NextResponse.json({ error: `Arkesel API returned an invalid response.`, details: responseText }, { status: 500 });
      }
    } else {
      console.error('Arkesel API request failed:', responseText);
      return NextResponse.json({ error: `Arkesel API request failed: ${responseText || response.statusText}` }, { status: response.status });
    }
  } catch (error: any) {
    console.error('Failed to send SMS via Arkesel:', error);
    return NextResponse.json({ error: 'Failed to connect to SMS service.' }, { status: 500 });
  }
}
