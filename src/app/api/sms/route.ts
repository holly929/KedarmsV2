import { NextResponse } from 'next/server';

function normalizePhoneNumber(phone: string): string {
  // Remove all non-numeric characters
  const cleaned = String(phone || '').replace(/\D/g, '');
  
  // If it starts with 0 and is 10 digits (Ghana local), change to 233
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return '233' + cleaned.substring(1);
  }
  
  // If it's already correct (starts with 233 and is 12 digits), or other format, return it
  return cleaned;
}

export async function POST(request: Request) {
  let phoneNumber, message, config;
  
  try {
    const body = await request.json();
    phoneNumber = body.phoneNumber;
    message = body.message;
    config = body.config;
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!phoneNumber || !message || !config || config.provider === 'none') {
    return NextResponse.json({ error: 'Missing parameters or SMS provider not configured.' }, { status: 400 });
  }

  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const provider = config.provider;

  try {
    if (provider === 'arkesel') {
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
        
        if (response.ok) {
            return NextResponse.json({ success: true, data: result });
        } else {
            return NextResponse.json({ 
                error: result.message || result.error || `Arkesel API Error: ${response.status}`,
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
        // Use btoa for edge compatibility instead of Buffer
        const auth = btoa(`${config.twilioSid}:${config.twilioToken}`);
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

    return NextResponse.json({ error: 'SMS Provider not supported.' }, { status: 500 });
  } catch (error: any) {
    console.error("SMS API Route Runtime Error:", error);
    return NextResponse.json({ 
        error: `System Error: ${error.message || 'Internal connection failure'}`,
        hint: 'This usually means the server could not reach the SMS provider API.'
    }, { status: 500 });
  }
}
