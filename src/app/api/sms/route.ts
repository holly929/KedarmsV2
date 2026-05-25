import { NextResponse } from 'next/server';

function normalizePhoneNumber(phone: string): string {
  // Remove all non-numeric characters
  const cleaned = String(phone || '').replace(/\D/g, '');
  
  // If it starts with 0 and is 10 digits (Ghana local), change to 233
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return '233' + cleaned.substring(1);
  }
  
  // Return cleaned number (expecting 233XXXXXXXXX format)
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

  // Set up an abort controller for a 12-second timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const commonHeaders = {
      'User-Agent': 'RateEase-Revenue-System/1.0',
      'Accept': 'application/json',
    };

    if (provider === 'arkesel') {
        const sender = String(config.senderId || 'RateEase').substring(0, 11);
        
        const response = await fetch(`https://openapi.arkesel.com/api/v2/sms/send`, {
            method: 'POST',
            cache: 'no-store',
            signal: controller.signal,
            headers: {
                ...commonHeaders,
                'api-key': config.apiKey || '',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                sender: sender,
                message: message,
                recipients: [normalizedPhone]
            })
        });

        clearTimeout(timeoutId);

        const contentType = response.headers.get('content-type');
        let result;
        if (contentType && contentType.includes('application/json')) {
            result = await response.json();
        } else {
            const text = await response.text();
            throw new Error(`Provider returned non-JSON response (likely a gateway block or 404): ${text.substring(0, 100)}`);
        }
        
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
            from: String(config.senderId || 'RateEase').substring(0, 11),
            msg: message,
        });
        const res = await fetch(`https://api.smsgh.com/v3/messages/send?${params.toString()}`, {
            cache: 'no-store',
            signal: controller.signal,
            headers: commonHeaders
        });
        clearTimeout(timeoutId);

        if (res.ok) return NextResponse.json({ success: true });
        
        const errorText = await res.text();
        return NextResponse.json({ error: `SMS GH Error: ${errorText}` }, { status: res.status });
    } 
    
    if (provider === 'twilio') {
        const auth = Buffer.from(`${config.twilioSid}:${config.twilioToken}`).toString('base64');
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.twilioSid}/Messages.json`, {
            method: 'POST',
            cache: 'no-store',
            signal: controller.signal,
            headers: {
                ...commonHeaders,
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                To: `+${normalizedPhone}`,
                From: config.twilioFrom || '',
                Body: message
            })
        });
        
        clearTimeout(timeoutId);
        const result = await res.json();
        if (res.ok) return NextResponse.json({ success: true, data: result });
        
        return NextResponse.json({ error: result.message || 'Twilio Error' }, { status: res.status });
    }

    return NextResponse.json({ error: 'SMS Provider not supported.' }, { status: 500 });
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("SMS API Route Runtime Error:", error);

    let message = error.message || 'fetch failed';
    let hint = 'Verify that the server has an active internet connection and that the provider\'s domain is not blocked by a firewall.';

    if (error.name === 'AbortError') {
      message = 'Request Timed Out';
      hint = 'The SMS gateway took too long to respond. This often happens due to high network latency or a proxy server delay.';
    }

    return NextResponse.json({ 
        error: `Provider Connection Failed: ${message}`,
        hint: hint
    }, { status: 500 });
  }
}
