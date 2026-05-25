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

// Alternative Arkesel endpoints in case openapi.arkesel.com is blocked/unreachable
const ARKESEL_ENDPOINTS = [
    'https://openapi.arkesel.com/api/v2/sms/send',
    'https://api.arkesel.com/api/v2/sms/send',
    'https://sms.arkesel.com/api/v2/sms/send'
];

async function fetchWithTimeout(url: string, options: RequestInit, timeout = 15000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        clearTimeout(id);
        return response;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
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
    if (provider === 'arkesel') {
        const sender = String(config.senderId || 'RateEase').substring(0, 11);
        const apiKey = config.apiKey || '';
        
        let lastError = null;
        
        // Attempt multiple endpoints for resilience
        for (const endpoint of ARKESEL_ENDPOINTS) {
            try {
                const response = await fetchWithTimeout(endpoint, {
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
                    return NextResponse.json({ success: true, data: result, endpointUsed: endpoint });
                } else {
                    const errText = await response.text();
                    lastError = `Arkesel Rejected (${response.status}): ${errText}`;
                }
            } catch (e: any) {
                lastError = e.message || 'Connection failed';
                console.warn(`Endpoint ${endpoint} failed: ${lastError}`);
                continue; // Try next endpoint
            }
        }

        return NextResponse.json({ 
            error: 'All Arkesel endpoints failed.',
            details: lastError,
            hint: 'Your server is unable to establish a secure connection to openapi.arkesel.com. Please white-list this domain in your firewall for port 443.'
        }, { status: 502 });
    } 
    
    if (provider === 'twilio') {
        const auth = Buffer.from(`${config.twilioSid}:${config.twilioToken}`).toString('base64');
        const res = await fetchWithTimeout(`https://api.twilio.com/2010-04-01/Accounts/${config.twilioSid}/Messages.json`, {
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
        error: `Network Failure: ${error.message || 'fetch failed'}`,
        hint: 'The server environment was unable to reach the gateway. This is usually due to a firewall blocking outbound HTTPS requests. Contact your network administrator.'
    }, { status: 500 });
  }
}

async function performConnectivityTest(config: any) {
    if (!config || config.provider === 'none') return NextResponse.json({ error: 'No provider selected for test.' });
    
    const domain = config.provider === 'arkesel' ? 'openapi.arkesel.com' : 'api.twilio.com';
    const endpoints = config.provider === 'arkesel' ? ARKESEL_ENDPOINTS : [`https://${domain}`];

    const results = [];

    for (const url of endpoints) {
        try {
            const start = Date.now();
            const res = await fetchWithTimeout(url, { method: 'GET', next: { revalidate: 0 } }, 10000);
            const end = Date.now();
            
            results.push({
                url,
                success: true,
                status: res.status,
                time: `${end - start}ms`
            });
        } catch (e: any) {
            results.push({
                url,
                success: false,
                error: e.name === 'AbortError' ? 'Timeout (10s)' : e.message
            });
        }
    }

    const allFailed = results.every(r => !r.success);

    return NextResponse.json({ 
        success: !allFailed, 
        message: allFailed ? 'All connectivity tests failed.' : 'At least one gateway endpoint is reachable.',
        details: results,
        hint: allFailed ? `The server environment cannot reach ${domain}. You must white-list this domain for outbound HTTPS traffic on port 443.` : undefined
    });
}
