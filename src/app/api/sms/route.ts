import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { phoneNumber, message } = await request.json();

  const { INFOBIP_BASE_URL, INFOBIP_API_KEY, INFOBIP_SENDER_ID } = process.env;

  if (!INFOBIP_BASE_URL || !INFOBIP_API_KEY || !INFOBIP_SENDER_ID) {
    return NextResponse.json({ error: 'SMS service is not configured on the server.' }, { status: 500 });
  }
  
  if (!INFOBIP_BASE_URL.includes('api.infobip.com')) {
     return NextResponse.json({ error: 'Invalid Infobip Base URL configured.' }, { status: 500 });
  }

  const infobipUrl = `https://${INFOBIP_BASE_URL}/sms/2/text/advanced`;
  
  const payload = {
    messages: [
      {
        destinations: [{ to: phoneNumber }],
        from: INFOBIP_SENDER_ID,
        text: message,
      },
    ],
  };

  try {
    const response = await fetch(infobipUrl, {
      method: 'POST',
      headers: {
        'Authorization': `App ${INFOBIP_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const data = await response.json();
      const firstMessage = data.messages?.[0];
      // Check for successful queuing status
      if (firstMessage?.status?.groupName === 'PENDING' || firstMessage?.status?.groupName === 'DELIVERED') {
         return NextResponse.json({ success: true, messageId: firstMessage.messageId });
      } else {
         console.error('Infobip error response:', firstMessage?.status);
         return NextResponse.json({ error: `Infobip error: ${firstMessage?.status?.description || 'Unknown error'}` }, { status: response.status });
      }
    } else {
      const errorText = await response.text();
      console.error('Infobip API request failed:', errorText);
      return NextResponse.json({ error: `Infobip API request failed: ${response.statusText}` }, { status: response.status });
    }
  } catch (error: any) {
    console.error('Failed to send SMS via Infobip:', error);
    return NextResponse.json({ error: 'Failed to send SMS.' }, { status: 500 });
  }
}
