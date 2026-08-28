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

  const { public_token } = req.body;

  if (!public_token) {
    return res.status(400).json({ error: "public_token is required" });
  }

  try {
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: public_token,
    });

    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;

    // For now we just return it (later we will store it securely)
    res.status(200).json({
      access_token: accessToken,
      item_id: itemId,
    });
  } catch (error) {
    console.error("Error exchanging public token:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to exchange public token" });
  }
}
