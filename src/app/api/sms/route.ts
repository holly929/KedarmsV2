import { NextResponse } from 'next/server';

function normalizePhoneNumber(phone: string): string {
  const cleaned = String(phone || '').replace(/\D/g, '');
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return '233' + cleaned.substring(1);
  }
  return cleaned;
}

export async function POST(request: Request) {
  const { phoneNumber, message, config } = await request.json();

  if (!phoneNumber || !message || !config) {
    return NextResponse.json({ error: 'Missing parameters.' }, { status: 400 });
  }

  const normalizedPhone = normalizePhoneNumber(phoneNumber);

  try {
    if (config.provider === 'arkesel') {
        const params = new URLSearchParams({
            action: 'send-sms',
            api_key: config.apiKey || '',
            to: normalizedPhone,
            from: config.senderId || '',
            sms: message,
        });
        const res = await fetch(`https://sms.arkesel.com/sms/api?${params.toString()}`);
        const text = await res.text();
        if (res.ok && (text.includes('SUCCESS') || text.includes('sent successfully'))) {
            return NextResponse.json({ success: true });
        }
    } else if (config.provider === 'sms_gh') {
        const params = new URLSearchParams({
            key: config.apiKey || '',
            secret: config.apiSecret || '',
            to: normalizedPhone,
            from: config.senderId || '',
            msg: message,
        });
        const res = await fetch(`https://api.smsgh.com/v3/messages/send?${params.toString()}`);
        if (res.ok) return NextResponse.json({ success: true });
    } else if (config.provider === 'twilio') {
        const auth = Buffer.from(`${config.twilioSid}:${config.twilioToken}`).toString('base64');
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.twilioSid}/Messages.json`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                To: `+${normalizedPhone}`,
                From: config.twilioFrom || '',
                Body: message
            })
        });
        if (res.ok) return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'SMS delivery failed through chosen provider.' }, { status: 500 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal API Error' }, { status: 500 });
  }
}
