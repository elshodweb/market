const BASE_URL = 'http://localhost:8080';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsImlhdCI6MTc4OTU0MjE0OSwiZXhwIjoxNzkwMTQ2OTQ5fQ.C4RoN-cChzpVl1oGeEYvhVdsaGUXyffYk02SFqkaDio';
const PRODUCT_ID = 3

async function run() {

  console.log('start');
  const promises = [];

  for (let i = 1; i <= 50; i++) {
    const idempotencyKey = crypto.randomUUID();
    promises.push(
      fetch(`${BASE_URL}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TOKEN}`,
          'idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({
          items: [{ product_id: PRODUCT_ID, quantity: 1 }],
        }),
      }).then(async (res) => ({
        status: res.status,
        data: await res.json(),
      })),
    );
  }

  const results = await Promise.all(promises);

  let count201 = 0;
  let count409 = 0;
  let others = 0;

  for (const r of results) {
    if (r.status === 201) count201++;
    else if (r.status === 409) count409++;
    else {
        console.log(r.data.message);
        others++;
    };

}


  console.log(`201 Created:    ${count201}`);
  console.log(`409 Conflict:   ${count409}`);
  console.log(`Others:   ${others}`)

  
}

run().catch(console.error);
