const http = require('http');

http.get('http://localhost:8060/api/payments', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
        const payments = JSON.parse(data);
        if(payments.length > 0) {
        console.log(JSON.stringify(payments.slice(0, 2), null, 2));
        } else {
        console.log('No payments');
        }
    } catch(e) { console.log(e); }
  });
}).on('error', (err) => {
  console.log('Error:', err.message);
});
