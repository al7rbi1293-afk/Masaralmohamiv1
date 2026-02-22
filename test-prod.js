const fetch = require('node-fetch');

async function testPayment() {
  console.log('Testing payment add...');
  try {
    const res = await fetch('https://masaralmohamiproject-pied.vercel.app/app/api/payments/add', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            invoice_id: "00000000-0000-0000-0000-000000000000",
            amount: 100
        })
    });
    const text = await res.text();
    console.log(`Payment Status: ${res.status}`);
    console.log(`Payment Body: ${text.slice(0, 300)}`);
  } catch (e) {
    console.error('Payment Error:', e.message);
  }
}

testPayment();
