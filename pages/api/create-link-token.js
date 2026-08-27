import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";

const config = new Configuration({
  basePath: PlaidEnvironments.sandbox, // We start with sandbox
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

  try {
    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: "user-" + Date.now(), // temporary unique ID
      },
      client_name: "Subscription Auditor",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us], // Change later if needed
      language: "en",
    });

    res.status(200).json({ link_token: response.data.link_token });
  } catch (error) {
    console.error("Error creating link token:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to create link token" });
  }
}
