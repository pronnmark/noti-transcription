#!/bin/bash
# Test script to diagnose reverse proxy connectivity issues
# Usage: ./test-proxy-connectivity.sh

echo "=== Noti Proxy Connectivity Diagnostic ==="
echo "Date: $(date)"
echo "Testing from: $(hostname -I | awk '{print $1}')"
echo

# Test 1: Our Noti app accessibility
echo "1. Testing Noti app local access..."
if curl -s -I http://localhost:5173 > /dev/null; then
    echo "✅ Localhost:5173 - OK"
else
    echo "❌ Localhost:5173 - FAILED"
fi

if curl -s -I http://192.168.0.110:5173 > /dev/null; then
    echo "✅ Network IP:5173 - OK"
else
    echo "❌ Network IP:5173 - FAILED"
fi

# Test 2: Health endpoint
echo
echo "2. Testing health endpoint..."
if curl -s http://localhost:5173/api/health > /dev/null; then
    echo "✅ Health endpoint - OK"
else
    echo "❌ Health endpoint - FAILED"
fi

# Test 3: Domain server connectivity
echo
echo "3. Testing domain server connectivity..."
if ping -c 1 -W 3 192.168.0.108 > /dev/null 2>&1; then
    echo "✅ Ping to 192.168.0.108 - OK"
else
    echo "❌ Ping to 192.168.0.108 - FAILED"
fi

# Test 4: Port accessibility
echo
echo "4. Testing port accessibility..."
if timeout 3 bash -c "</dev/tcp/192.168.0.108/443" > /dev/null 2>&1; then
    echo "✅ Port 443 accessible"
else
    echo "❌ Port 443 not accessible"
fi

if timeout 3 bash -c "</dev/tcp/192.168.0.108/80" > /dev/null 2>&1; then
    echo "✅ Port 80 accessible"
else
    echo "❌ Port 80 not accessible"
fi

# Test 5: Domain resolution and response
echo
echo "5. Testing domain response..."
DOMAIN_RESPONSE=$(curl -s -I -m 10 https://noti.se 2>/dev/null | head -1)
if [[ "$DOMAIN_RESPONSE" == *"200"* ]]; then
    echo "✅ Domain returns 200 OK"
elif [[ "$DOMAIN_RESPONSE" == *"502"* ]]; then
    echo "❌ Domain returns 502 Bad Gateway (Caddy can't reach us)"
elif [[ "$DOMAIN_RESPONSE" == *"503"* ]]; then
    echo "❌ Domain returns 503 Service Unavailable"
else
    echo "❌ Domain response: ${DOMAIN_RESPONSE:-No response}"
fi

# Test 6: Firewall check
echo
echo "6. Network interface information..."
echo "Active interfaces:"
ip -4 addr show | grep -E "(inet|UP)" | grep -v 127.0.0.1

echo
echo "=== Diagnostic Summary ==="
echo "If you see 502 errors, the issue is likely:"
echo "1. Caddy configuration points to wrong IP/port"
echo "2. Network firewall blocking 192.168.0.108 → 192.168.0.110:5173"
echo "3. Caddy health checks failing"
echo
echo "Next steps:"
echo "1. Check Caddy logs: ssh oggman@192.168.0.108 'sudo journalctl -u caddy -f'"
echo "2. Verify Caddy config points to http://192.168.0.110:5173"
echo "3. Test from 192.168.0.108: curl -I http://192.168.0.110:5173"