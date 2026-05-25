import { NextResponse } from 'next/server';

/**
 * Normalizes phone numbers to the 233XXXXXXXXX format required by Ghanaian gateways.
 */
function normalizePhoneNumber(phone: string): string {
  const cleaned = String(phone || '').replace(/\D/g, '');
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return '233' + cleaned.substring(1);
  }
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
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
  }

  if (!phoneNumber || !message || !config || config.provider === 'none') {
    return NextResponse.json({ error: 'SMS service is not fully configured in Settings.' }, { status: 400 });
  }

  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const provider = config.provider;

  // Use a longer timeout (25s) for outbound gateway communication
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const commonHeaders = {
      'User-Agent': 'RateEase-Revenue-System/1.1',
      'Accept': 'application/json',
      'Cache-Control': 'no-cache'
    };

    // --- ARKESEL V2 INTEGRATION ---
    if (provider === 'arkesel') {
        const sender = String(config.senderId || 'RateEase').substring(0, 11);
        
        const response = await fetch(`https://openapi.arkesel.com/api/v2/sms/send`, {
            method: 'POST',
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
            if (!response.ok) {
                throw new Error(`Arkesel Gateway Error (${response.status}): ${text.substring(0, 100)}`);
            }
            result = { message: text };
        }
        
        if (response.ok) {
            return NextResponse.json({ success: true, data: result });
        } else {
            return NextResponse.json({ 
                error: result?.message || `Arkesel API Error: ${response.status}`,
                details: result 
            }, { status: response.status });
        }
    } 
    
    // --- TWILIO INTEGRATION ---
    if (provider === 'twilio') {
        const auth = Buffer.from(`${config.twilioSid}:${config.twilioToken}`).toString('base64');
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.twilioSid}/Messages.json`, {
            method: 'POST',
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
        
        return NextResponse.json({ error: result.message || 'Twilio Rejected the request.' }, { status: res.status });
    }

    // --- SMS ONLINE GH INTEGRATION ---
    if (provider === 'sms_gh') {
        const params = new URLSearchParams({
            key: config.apiKey || '',
            secret: config.apiSecret || '',
            to: normalizedPhone,
            from: String(config.senderId || 'RateEase').substring(0, 11),
            msg: message,
        });
        const res = await fetch(`https://api.smsgh.com/v3/messages/send?${params.toString()}`, {
            headers: commonHeaders,
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) return NextResponse.json({ success: true });
        const errorText = await res.text();
        return NextResponse.json({ error: `SMS GH Provider Error: ${errorText.substring(0, 100)}` }, { status: res.status });
    }

    return NextResponse.json({ error: 'The selected SMS provider is not currently supported by this route.' }, { status: 501 });

  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("SMS API Route Runtime Error:", error);

    let message = error.message || 'Unknown network error';
    let hint = 'Verify that the server has an active internet connection and that the provider\'s domain (e.g. openapi.arkesel.com) is not blocked by a firewall or proxy.';

    if (error.name === 'AbortError') {
      message = 'Gateway Connection Timed Out';
      hint = 'The provider did not respond within 25 seconds. Check your internet connection or if the provider service is currently down.';
    }

    return NextResponse.json({ 
        error: `Provider Connection Failed: ${message}`,
        hint: hint
    }, { status: 500 });
  }
}
