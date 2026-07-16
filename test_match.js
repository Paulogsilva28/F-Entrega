import fs from 'fs';

const data = JSON.parse(fs.readFileSync('scratch_log_payload.json', 'utf8'));

for (const tx of data.sampleTransactions) {
  const rawAmount = Number(tx.amount);
  const description = (tx.description ?? "").toUpperCase();
  const date = (tx.date ?? "").slice(0, 10);

  if (rawAmount > 0) {
    const txStr = JSON.stringify(tx).toUpperCase();
    const payerRouting = tx.paymentData?.payer?.routingNumber;
    const payerISPB = tx.paymentData?.payer?.routingNumberISPB;

    const isUber = 
      txStr.includes("UBER") || 
      txStr.includes("PARTNERPAY") || 
      txStr.includes("DIGIO") ||
      payerRouting === "335" ||
      payerISPB === "27098060";

    const is99 = 
      txStr.includes("99PAY") || 
      txStr.includes("99 FOOD") || 
      txStr.includes("99FOOD") || 
      txStr.includes("99APP") || 
      txStr.includes("99 TECNOLOGIA") || 
      txStr.includes("99 TEC") || 
      txStr.includes("99 IP") || 
      txStr.includes("99PAY IP") ||
      payerRouting === "769" ||
      payerISPB === "24313102";

    console.log(`Tx: ${description} | Amount: ${rawAmount}`);
    console.log(`  isUber: ${isUber}`);
    console.log(`  is99: ${is99}`);
    console.log(`  payerRouting: ${payerRouting}`);
    console.log(`  payerISPB: ${payerISPB}`);
  }
}
