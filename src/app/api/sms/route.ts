import { NextResponse } from 'next/server';
import { normalizePhoneNumber } from '@/lib/utils';

const ARKESEL_V2_ENDPOINTS = [
    'https://openapi.arkesel.com/api/v2/sms/send',
    'https://api.arkesel.com/api/v2/sms/send'
];

const ARKESEL_V1_ENDPOINT = 'https://sms.arkesel.com/sms/api';

async function fetchWithTimeout(url: string, options: RequestInit, timeout = 25000) {
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

  // Ensure number is in 233 format for Arkesel
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const provider = config.provider;

  try {
    if (provider === 'arkesel') {
        const sender = String(config.senderId || 'RateEase').substring(0, 11);
        const apiKey = config.apiKey || '';
        
        let lastError = null;
        
        // 1. ATTEMPT ARKESEL V2 (Modern JSON API)
        for (const endpoint of ARKESEL_V2_ENDPOINTS) {
            try {
                const response = await fetchWithTimeout(endpoint, {
                    method: 'POST',
                    headers: {
                        'api-key': apiKey,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'User-Agent': 'RateEase/1.0'
                    },
                    body: JSON.stringify({
                        sender: sender,
                        message: message,
                        recipients: [normalizedPhone]
                    }),
                    cache: 'no-store'
                });

                if (response.ok) {
                    const result = await response.json();
                    return NextResponse.json({ success: true, data: result, api: 'v2', endpoint: endpoint });
                } else {
                    const errText = await response.text();
                    lastError = `V2 Rejected (${response.status}): ${errText}`;
                }
            } catch (e: any) {
                lastError = e.message || 'V2 Connection failed';
            }
        }

        // 2. ATTEMPT ARKESEL V1 FALLBACK (Legacy GET API) 
        try {
            const v1Params = new URLSearchParams({
                action: 'send-sms',
                api_key: apiKey,
                to: normalizedPhone,
                from: sender,
                sms: message
            });
            
            const v1Response = await fetchWithTimeout(`${ARKESEL_V1_ENDPOINT}?${v1Params.toString()}`, {
                method: 'GET',
                cache: 'no-store'
            });
            
            if (v1Response.ok) {
                const result = await v1Response.text();
                return NextResponse.json({ success: true, data: result, api: 'v1' });
            } else {
                lastError = `V1 also failed (${v1Response.status})`;
            }
        } catch (e: any) {
            lastError = `V1 Fallback failed: ${e.message}`;
        }

        return NextResponse.json({ 
            error: 'All Arkesel connection paths failed.',
            details: lastError,
            hint: 'The server cannot reach Arkesel. Whitelist openapi.arkesel.com and sms.arkesel.com on Port 443.'
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
    return NextResponse.json({ 
        error: `Provider Connection Failed: ${error.message || 'fetch failed'}`,
        hint: 'Verify that the server has an active internet connection and that the provider\'s domain (e.g. openapi.arkesel.com) is not blocked by a firewall or proxy.'
    }, { status: 500 });
  }
}

async function performConnectivityTest(config: any) {
    if (!config || config.provider === 'none') return NextResponse.json({ error: 'No provider selected for test.' });
    
    const targets = [
        { name: 'Arkesel Modern (V2)', url: 'https://openapi.arkesel.com' },
        { name: 'Arkesel Legacy (V1)', url: 'https://sms.arkesel.com' },
        { name: 'Twilio Gateway', url: 'https://api.twilio.com' },
        { name: 'Public Internet (Google)', url: 'https://www.google.com' }
    ];

    const results = [];

    for (const target of targets) {
        try {
            const start = Date.now();
            const res = await fetchWithTimeout(target.url, { method: 'HEAD', cache: 'no-store' }, 10000);
            const end = Date.now();
            
            results.push({
                url: target.url,
                name: target.name,
                success: true,
                status: res.status,
                time: `${end - start}ms`
            });
        } catch (e: any) {
            results.push({
                url: target.url,
                name: target.name,
                success: false,
                error: e.name === 'AbortError' ? 'Timeout (10s)' : e.message
            });
        }
    }

    const allGatewaysFailed = results.filter(r => r.name.includes('Arkesel') || r.name.includes('Twilio')).every(r => !r.success);

    return NextResponse.json({ 
        success: !allGatewaysFailed, 
        message: allGatewaysFailed ? 'CRITICAL: Server cannot reach any SMS provider.' : 'Connectivity check complete.',
        details: results,
        hint: allGatewaysFailed ? "Firewall is blocking outbound Port 443 traffic. Whitelist openapi.arkesel.com and sms.arkesel.com." : undefined
    });
}
