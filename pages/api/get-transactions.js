import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const config = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(config);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { access_token } = req.body;

  if (!access_token) {
    return res.status(400).json({ error: "access_token is required" });
  }

  try {
    // Get transactions from the last 90 days
    const now = new Date();
    const startDate = new Date(now.setDate(now.getDate() - 90)).toISOString().split("T")[0];
    const endDate = new Date().toISOString().split("T")[0];

    const response = await plaidClient.transactionsGet({
      access_token: access_token,
      start_date: startDate,
      end_date: endDate,
    });

    const transactions = response.data.transactions.map((tx) => ({
      description: tx.name || tx.merchant_name || "Unknown",
      amount: tx.amount,
      date: tx.date,
    }));

    res.status(200).json({ transactions });
  } catch (error) {
    console.error("Error fetching transactions:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
}
