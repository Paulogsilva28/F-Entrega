const clientId = "e1672113-a764-4a00-abfc-be84a84a2db3";
const clientSecret = "1a8fec91-1fa1-424a-9eb3-eb64e9a8f4c5";
const itemId = "6c69735a-be91-4621-90ef-838be53b197f";

async function main() {
  const authRes = await fetch("https://api.pluggy.ai/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  const { apiKey } = await authRes.json();

  console.log("Fetching item info...");
  const itemRes = await fetch(`https://api.pluggy.ai/items/${itemId}`, {
    headers: { "X-API-KEY": apiKey },
  });

  console.log("Status:", itemRes.status);
  console.log("Response:", await itemRes.json());
}

main();
