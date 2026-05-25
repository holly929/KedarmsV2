import { NextResponse } from 'next/server';

function normalizePhoneNumber(phone: string): string {
  // Remove all non-numeric characters
  const cleaned = String(phone || '').replace(/\D/g, '');
  
  // If it starts with 0 and is 10 digits (Ghana local), change to 233
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return '233' + cleaned.substring(1);
  }
  
  // If it starts with 233 but is short, or already correct, return it
  return cleaned;
}

export async function POST(request: Request) {
  const { phoneNumber, message, config } = await request.json();

  if (!phoneNumber || !message || !config) {
    return NextResponse.json({ error: 'Missing parameters.' }, { status: 400 });
  }

  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const provider = config.provider;

  try {
    if (provider === 'arkesel') {
        // Using Arkesel v2 API (JSON)
        const response = await fetch(`https://openapi.arkesel.com/api/v2/sms/send`, {
            method: 'POST',
            headers: {
                'api-key': config.apiKey || '',
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                sender: config.senderId || 'RateEase',
                message: message,
                recipients: [normalizedPhone]
            })
        });

        const result = await response.json();
        
        // Arkesel v2 returns 201 for successful submission
        if (response.status === 200 || response.status === 201) {
            return NextResponse.json({ success: true, data: result });
        } else {
            return NextResponse.json({ 
                error: result.message || result.error || `Arkesel Error: ${response.status}`,
                details: result 
            }, { status: response.status });
        }
    } 
    
    if (provider === 'sms_gh') {
        const params = new URLSearchParams({
            key: config.apiKey || '',
            secret: config.apiSecret || '',
            to: normalizedPhone,
            from: config.senderId || 'RateEase',
            msg: message,
        });
        const res = await fetch(`https://api.smsgh.com/v3/messages/send?${params.toString()}`);
        if (res.ok) return NextResponse.json({ success: true });
        
        const errorText = await res.text();
        return NextResponse.json({ error: `SMS GH Error: ${errorText}` }, { status: res.status });
    } 
    
    if (provider === 'twilio') {
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
        
        const result = await res.json();
        if (res.ok) return NextResponse.json({ success: true, data: result });
        
        return NextResponse.json({ error: result.message || 'Twilio Error' }, { status: res.status });
    }

    return NextResponse.json({ error: 'SMS Provider not supported or configured incorrectly.' }, { status: 500 });
  } catch (error: any) {
    console.error("SMS API Route Error:", error);
    return NextResponse.json({ error: error.message || 'Internal API Error' }, { status: 500 });
  }
}
