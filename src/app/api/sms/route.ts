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

  // Diagnostic mode check
  if (phoneNumber === 'DIAGNOSTIC_TEST') {
      return performConnectivityTest(config);
  }

  if (!phoneNumber || !message || !config || config.provider === 'none') {
    return NextResponse.json({ error: 'SMS service is not fully configured in Settings.' }, { status: 400 });
  }

  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const provider = config.provider;

  try {
    // --- ARKESEL V2 INTEGRATION ---
    if (provider === 'arkesel') {
        const sender = String(config.senderId || 'RateEase').substring(0, 11);
        const apiKey = config.apiKey || '';
        
        // We try the primary endpoint with a reasonable timeout
        const response = await fetch(`https://openapi.arkesel.com/api/v2/sms/send`, {
            method: 'POST',
            headers: {
                'api-key': apiKey,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                sender: sender,
                message: message,
                recipients: [normalizedPhone]
            }),
            next: { revalidate: 0 }
        });

        if (response.ok) {
            const result = await response.json();
            return NextResponse.json({ success: true, data: result });
        } else {
            const errText = await response.text();
            return NextResponse.json({ 
                error: `Arkesel Gateway Rejected Request (${response.status})`,
                details: errText 
            }, { status: response.status });
        }
    } 
    
    // --- TWILIO INTEGRATION ---
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

    return NextResponse.json({ error: 'Provider not implemented.' }, { status: 501 });

  } catch (error: any) {
    console.error("SMS API Error:", error);
    return NextResponse.json({ 
        error: `Provider Connection Failed: ${error.message || 'fetch failed'}`,
        hint: 'Verify that the server has an active internet connection and that the provider\'s domain (e.g. openapi.arkesel.com) is not blocked by a firewall or proxy.'
    }, { status: 500 });
  }
}

async function performConnectivityTest(config: any) {
    if (!config || config.provider === 'none') return NextResponse.json({ error: 'No provider selected for test.' });
    
    const domain = config.provider === 'arkesel' ? 'openapi.arkesel.com' : 'api.twilio.com';
    const url = config.provider === 'arkesel' ? `https://${domain}/api/v2/sms/send` : `https://${domain}`;

    try {
        const start = Date.now();
        // Just a HEAD or GET request to check domain reachability
        const res = await fetch(url, { method: 'GET', next: { revalidate: 0 } });
        const end = Date.now();
        
        return NextResponse.json({ 
            success: true, 
            message: `Connection to ${domain} established in ${end - start}ms.`,
            status: res.status,
            statusText: res.statusText
        });
    } catch (e: any) {
        return NextResponse.json({ 
            success: false, 
            error: e.message,
            hint: `The server environment cannot reach ${domain}. If you are on a corporate network or cloud environment, you may need to white-list this domain for outbound HTTPS traffic on port 443.`
        });
    }
}
