import { useState, useEffect } from "react";
import { usePlaidLink } from "react-plaid-link";

export default function Home() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [viewMode, setViewMode] = useState("monthly");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState("Entertainment");

  const [costOfLiving, setCostOfLiving] = useState({
    housing: 0,
    food: 0,
    transport: 0,
    utilities: 0,
    other: 0
  });

  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCategory, setNewCategory] = useState("Entertainment");

  // Plaid states
  const [linkToken, setLinkToken] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [plaidStatus, setPlaidStatus] = useState("idle"); // idle | preparing | ready | connecting | success | error

  const categories = ["Entertainment", "Music", "Health", "Software", "Shopping", "Other"];

  // Load saved data
  useEffect(() => {
    const savedSubs = localStorage.getItem("subscriptions");
    const savedTotal = localStorage.getItem("total");
    const savedCOL = localStorage.getItem("costOfLiving");
    const savedDark = localStorage.getItem("darkMode");

    if (savedSubs) setSubscriptions(JSON.parse(savedSubs));
    if (savedTotal) setTotal(parseFloat(savedTotal));
    if (savedCOL) setCostOfLiving(JSON.parse(savedCOL));
    if (savedDark) setDarkMode(savedDark === "true");
  }, []);

  // Save data
  useEffect(() => {
    localStorage.setItem("subscriptions", JSON.stringify(subscriptions));
    localStorage.setItem("total", total.toString());
    localStorage.setItem("costOfLiving", JSON.stringify(costOfLiving));
    localStorage.setItem("darkMode", darkMode.toString());
  }, [subscriptions, total, costOfLiving, darkMode]);

  // Register service worker (PWA)
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => console.log("Service Worker registered"))
        .catch((err) => console.log("SW registration failed", err));
    }
  }, []);

  // Create Link Token
  async function createLinkToken() {
    setPlaidStatus("preparing");
    try {
      const response = await fetch("/api/create-link-token", {
        method: "POST",
      });
      const data = await response.json();

      if (data.link_token) {
        setLinkToken(data.link_token);
        setPlaidStatus("ready");
      } else {
        setPlaidStatus("error");
        alert("Failed to create link token");
      }
    } catch (error) {
      console.error(error);
      setPlaidStatus("error");
      alert("Error connecting to server");
    }
  }

  // Plaid Link
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token) => {
      setPlaidStatus("connecting");

      try {
        // Exchange public_token
        const exchangeRes = await fetch("/api/exchange-public-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token }),
        });

        const exchangeData = await exchangeRes.json();

        if (!exchangeData.access_token) {
          setPlaidStatus("error");
          alert("Failed to get access token");
          return;
        }

        setAccessToken(exchangeData.access_token);

        // Get transactions
        const txRes = await fetch("/api/get-transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: exchangeData.access_token }),
        });

        const txData = await txRes.json();

        if (txData.transactions && txData.transactions.length > 0) {
          const detected = detectRecurring(txData.transactions);
          setSubscriptions(detected);
          const totalAmount = detected.reduce((sum, sub) => sum + sub.amount, 0);
          setTotal(totalAmount);
          setMessage(`Found ${detected.length} recurring subscriptions from bank`);
          setPlaidStatus("success");
          alert(`Success! Found ${detected.length} recurring subscriptions from your bank.`);
        } else {
          setPlaidStatus("error");
          alert("No transactions found.");
        }
      } catch (error) {
        console.error(error);
        setPlaidStatus("error");
        alert("Error during bank connection process");
      }
    },
    onExit: () => {
      setPlaidStatus(linkToken ? "ready" : "idle");
    },
  });

  function detectRecurring(transactions) {
    const groups = {};

    transactions.forEach((tx) => {
      let key = (tx.description || "")
        .toLowerCase()
        .replace(/[0-9]/g, "")
        .replace(/[^a-z\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();

      key = key.replace(/\b(ltd|inc|llc|payment|debit|credit|card)\b/g, "").trim();
      if (key.length < 3) return;

      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    });

    const recurring = [];

    Object.keys(groups).forEach((key) => {
      const items = groups[key];
      if (items.length >= 2) {
        const avgAmount = items.reduce((sum, item) => sum + Math.abs(item.amount), 0) / items.length;

        let category = "Other";
        const lower = key.toLowerCase();
        if (lower.includes("netflix") || lower.includes("disney") || lower.includes("hulu") || lower.includes("youtube")) category = "Entertainment";
        else if (lower.includes("spotify") || lower.includes("apple music") || lower.includes("tidal")) category = "Music";
        else if (lower.includes("gym") || lower.includes("fitness") || lower.includes("health")) category = "Health";
        else if (lower.includes("adobe") || lower.includes("microsoft") || lower.includes("google") || lower.includes("dropbox")) category = "Software";

        recurring.push({
          id: key + Date.now() + Math.random(),
          name: items[0].description,
          amount: avgAmount,
          count: items.length,
          status: "keep",
          category
        });
      }
    });

    return recurring.sort((a, b) => b.amount - a.amount);
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const lines = text.split("\n").filter(line => line.trim() !== "");

        const transactions = [];
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(",");
          if (parts.length >= 3) {
            const description = parts[1].trim();
            const amount = parseFloat(parts[2]);
            if (description && !isNaN(amount)) {
              transactions.push({ description, amount });
            }
          }
        }

        const detected = detectRecurring(transactions);
        setSubscriptions(detected);
        const totalAmount = detected.reduce((sum, sub) => sum + sub.amount, 0);
        setTotal(totalAmount);
        setMessage(`Found ${detected.length} recurring subscriptions`);
      } catch (err) {
        setMessage("Error reading file. Please use a valid CSV.");
      }
    };
    reader.readAsText(file);
  }

  function updateStatus(id, newStatus) {
    setSubscriptions(prev =>
      prev.map(sub => sub.id === id ? { ...sub, status: newStatus } : sub)
    );
  }

  function deleteSubscription(id) {
    const sub = subscriptions.find(s => s.id === id);
    if (sub) setTotal(prev => prev - sub.amount);
    setSubscriptions(prev => prev.filter(sub => sub.id !== id));
  }

  function startEdit(sub) {
    setEditingId(sub.id);
    setEditName(sub.name);
    setEditAmount(sub.amount.toString());
    setEditCategory(sub.category || "Other");
  }

  function saveEdit() {
    if (!editName || !editAmount) return;

    const newAmt = parseFloat(editAmount);
    const oldSub = subscriptions.find(s => s.id === editingId);
    const difference = newAmt - (oldSub ? oldSub.amount : 0);

    setSubscriptions(prev =>
      prev.map(sub =>
        sub.id === editingId
          ? { ...sub, name: editName, amount: newAmt, category: editCategory }
          : sub
      ).sort((a, b) => b.amount - a.amount)
    );

    setTotal(prev => prev + difference);
    setEditingId(null);
  }

  function addManualSubscription() {
    if (!newName || !newAmount) return;

    const amount = parseFloat(newAmount);
    const newSub = {
      id: Date.now().toString(),
      name: newName,
      amount,
      count: 1,
      status: "keep",
      category: newCategory
    };

    setSubscriptions(prev => [...prev, newSub].sort((a, b) => b.amount - a.amount));
    setTotal(prev => prev + amount);
    setNewName("");
    setNewAmount("");
  }

  function updateCostOfLiving(field, value) {
    setCostOfLiving(prev => ({
      ...prev,
      [field]: parseFloat(value) || 0
    }));
  }

  function exportData() {
    let csv = "Name,Amount,Category,Status,Count\n";
    subscriptions.forEach(sub => {
      csv += `"\( {sub.name}", \){sub.amount.toFixed(2)},\( {sub.category}, \){sub.status},${sub.count}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subscriptions-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearAllData() {
    if (confirm("Are you sure you want to delete all data?")) {
      setSubscriptions([]);
      setTotal(0);
      setCostOfLiving({ housing: 0, food: 0, transport: 0, utilities: 0, other: 0 });
      setMessage("");
      setPlaidStatus("idle");
      setLinkToken(null);
      setAccessToken(null);
    }
  }

  const totalCOL = Object.values(costOfLiving).reduce((a, b) => a + b, 0);
  const savings = subscriptions
    .filter(sub => sub.status === "cancel")
    .reduce((sum, sub) => sum + sub.amount, 0);

  const displayTotal = viewMode === "yearly" ? total * 12 : total;
  const displaySavings = viewMode === "yearly" ? savings * 12 : savings;
  const displayCOL = viewMode === "yearly" ? totalCOL * 12 : totalCOL;
  const grandTotal = displayTotal + displayCOL;

  const bg = darkMode ? "#0f172a" : "#f8fafc";
  const card = darkMode ? "#1e293b" : "white";
  const text = darkMode ? "#f1f5f9" : "#0f172a";
  const muted = darkMode ? "#94a3b8" : "#64748b";
  const border = darkMode ? "#334155" : "#e2e8f0";

  return (
    <div style={{ 
      padding: "20px 16px", 
      fontFamily: "system-ui, -apple-system, sans-serif", 
      maxWidth: "720px",
      margin: "0 auto",
      backgroundColor: bg,
      minHeight: "100vh",
      color: text
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: "700", margin: 0 }}>Subscription Auditor</h1>
        <button
          onClick={() => setDarkMode(!darkMode)}
          style={{
            padding: "6px 14px",
            borderRadius: "20px",
            border: `1px solid ${border}`,
            background: card,
            color: text,
            fontSize: "13px"
          }}
        >
          {darkMode ? "Light" : "Dark"}
        </button>
      </div>
      <p style={{ color: muted, marginBottom: "16px", fontSize: "14px" }}>
        Find forgotten subscriptions & track living costs
      </p>

      {/* View Mode */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <button onClick={() => setViewMode("monthly")} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "none", background: viewMode === "monthly" ? "#2563eb" : card, color: viewMode === "monthly" ? "white" : text, fontWeight: "600", fontSize: "13px" }}>Monthly</button>
        <button onClick={() => setViewMode("yearly")} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "none", background: viewMode === "yearly" ? "#2563eb" : card, color: viewMode === "yearly" ? "white" : text, fontWeight: "600", fontSize: "13px" }}>Yearly</button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
        <div style={{ backgroundColor: card, padding: "16px", borderRadius: "12px" }}>
          <div style={{ fontSize: "13px", color: muted }}>{viewMode === "yearly" ? "Yearly" : "Monthly"} Recurring</div>
          <div style={{ fontSize: "22px", fontWeight: "700" }}>${displayTotal.toFixed(2)}</div>
        </div>
        <div style={{ backgroundColor: darkMode ? "#14532d" : "#ecfdf5", padding: "16px", borderRadius: "12px", border: darkMode ? "1px solid #166534" : "1px solid #bbf7d0" }}>
          <div style={{ fontSize: "13px", color: darkMode ? "#86efac" : "#166534" }}>You can save</div>
          <div style={{ fontSize: "22px", fontWeight: "700", color: "#16a34a" }}>${displaySavings.toFixed(2)}</div>
        </div>
      </div>

      {/* Grand Total */}
      <div style={{ backgroundColor: darkMode ? "#1e293b" : "#0f172a", color: "white", padding: "14px 18px", borderRadius: "12px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "14px" }}>Total {viewMode === "yearly" ? "Yearly" : "Monthly"}</span>
        <span style={{ fontSize: "18px", fontWeight: "700" }}>${grandTotal.toFixed(2)}</span>
      </div>

      {/* Action Buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
        <label style={{ display: "block", textAlign: "center", padding: "12px", backgroundColor: "#2563eb", color: "white", borderRadius: "10px", fontWeight: "600", fontSize: "14px" }}>
          Upload CSV
          <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: "none" }} />
        </label>
        <button onClick={exportData} style={{ padding: "12px", backgroundColor: card, color: text, border: `1px solid ${border}`, borderRadius: "10px", fontWeight: "600", fontSize: "14px" }}>Export CSV</button>
      </div>

      {/* Connect Bank Button */}
      <button
        onClick={() => {
          if (plaidStatus === "ready" && ready) {
            open();
          } else if (plaidStatus === "idle" || plaidStatus === "error" || plaidStatus === "success") {
            createLinkToken();
          }
        }}
        disabled={plaidStatus === "preparing" || plaidStatus === "connecting"}
        style={{
          width: "100%",
          padding: "13px",
          marginBottom: "12px",
          backgroundColor: plaidStatus === "success" ? "#16a34a" : "#0f172a",
          color: "white",
          border: "none",
          borderRadius: "10px",
          fontWeight: "600",
          fontSize: "14px",
          opacity: plaidStatus === "preparing" || plaidStatus === "connecting" ? 0.7 : 1
        }}
      >
        {plaidStatus === "preparing" && "Preparing..."}
        {plaidStatus === "ready" && "Open Bank Connection"}
        {plaidStatus === "connecting" && "Connecting & Fetching..."}
        {plaidStatus === "success" && "Connected ✓ (Tap to reconnect)"}
        {plaidStatus === "error" && "Try Again"}
        {plaidStatus === "idle" && "Connect Bank (Plaid)"}
      </button>

      <button onClick={clearAllData} style={{ width: "100%", padding: "10px", marginBottom: "16px", backgroundColor: darkMode ? "#450a0a" : "#fef2f2", color: "#dc2626", border: "none", borderRadius: "10px", fontWeight: "600", fontSize: "13px" }}>
        Clear All Data
      </button>

      {message && <p style={{ textAlign: "center", color: "#2563eb", fontSize: "14px", marginBottom: "16px" }}>{message}</p>}

      {/* Add Subscription */}
      <div style={{ backgroundColor: card, borderRadius: "12px", padding: "18px", marginBottom: "18px" }}>
        <h3 style={{ margin: "0 0 14px 0", fontSize: "16px", fontWeight: "600" }}>Add Subscription</h3>
        <input type="text" placeholder="Name (e.g. Netflix)" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ width: "100%", padding: "11px", marginBottom: "10px", borderRadius: "8px", border: `1px solid ${border}`, background: bg, color: text, boxSizing: "border-box" }} />
        <input type="number" placeholder="Amount" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} style={{ width: "100%", padding: "11px", marginBottom: "10px", borderRadius: "8px", border: `1px solid ${border}`, background: bg, color: text, boxSizing: "border-box" }} />
        <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} style={{ width: "100%", padding: "11px", marginBottom: "10px", borderRadius: "8px", border: `1px solid ${border}`, background: bg, color: text }}>
          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <button onClick={addManualSubscription} style={{ width: "100%", padding: "12px", backgroundColor: "#0f172a", color: "white", border: "none", borderRadius: "8px", fontWeight: "600" }}>Add Subscription</button>
      </div>

      {/* Subscriptions List */}
      {subscriptions.length > 0 ? (
        <div style={{ backgroundColor: card, borderRadius: "12px", padding: "18px", marginBottom: "18px" }}>
          <h3 style={{ margin: "0 0 14px 0", fontSize: "16px", fontWeight: "600" }}>Your Subscriptions</h3>
          {subscriptions.map((sub) => (
            <div key={sub.id} style={{ padding: "14px 0", borderBottom: `1px solid ${border}` }}>
              {editingId === sub.id ? (
                <div>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} style={{ width: "100%", padding: "8px", marginBottom: "6px", borderRadius: "6px", border: `1px solid ${border}`, background: bg, color: text, boxSizing: "border-box" }} />
                  <input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} style={{ width: "100%", padding: "8px", marginBottom: "6px", borderRadius: "6px", border: `1px solid ${border}`, background: bg, color: text, boxSizing: "border-box" }} />
                  <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} style={{ width: "100%", padding: "8px", marginBottom: "8px", borderRadius: "6px", border: `1px solid ${border}`, background: bg, color: text }}>
                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={saveEdit} style={{ flex: 1, padding: "8px", background: "#16a34a", color: "white", border: "none", borderRadius: "6px" }}>Save</button>
                    <button onClick={() => setEditingId(null)} style={{ flex: 1, padding: "8px", background: border, color: text, border: "none", borderRadius: "6px" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "500", fontSize: "15px" }}>{sub.name}</div>
                    <div style={{ fontSize: "13px", color: muted, marginTop: "2px" }}>{sub.category} • {sub.count > 1 ? `${sub.count} times` : "Manual"}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: "600", marginBottom: "8px", fontSize: "15px" }}>${(viewMode === "yearly" ? sub.amount * 12 : sub.amount).toFixed(2)}</div>
                    <div style={{ display: "flex", gap: "5px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <button onClick={() => updateStatus(sub.id, "keep")} style={{ padding: "4px 8px", fontSize: "11px", backgroundColor: sub.status === "keep" ? "#16a34a" : border, color: sub.status === "keep" ? "white" : text, border: "none", borderRadius: "6px" }}>Keep</button>
                      <button onClick={() => updateStatus(sub.id, "cancel")} style={{ padding: "4px 8px", fontSize: "11px", backgroundColor: sub.status === "cancel" ? "#dc2626" : border, color: sub.status === "cancel" ? "white" : text, border: "none", borderRadius: "6px" }}>Cancel</button>
                      <button onClick={() => startEdit(sub)} style={{ padding: "4px 8px", fontSize: "11px", backgroundColor: border, color: text, border: "none", borderRadius: "6px" }}>Edit</button>
                      <button onClick={() => deleteSubscription(sub.id)} style={{ padding: "4px 8px", fontSize: "11px", backgroundColor: darkMode ? "#450a0a" : "#fee2e2", color: "#ef4444", border: "none", borderRadius: "6px" }}>Delete</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ backgroundColor: card, borderRadius: "12px", padding: "40px 20px", marginBottom: "18px", textAlign: "center", color: muted }}>
          <div style={{ fontSize: "16px", marginBottom: "8px" }}>No subscriptions yet</div>
          <div style={{ fontSize: "14px" }}>Upload a CSV or connect your bank to get started</div>
        </div>
      )}

      {/* Cost of Living */}
      <div style={{ backgroundColor: card, borderRadius: "12px", padding: "18px" }}>
        <h3 style={{ margin: "0 0 14px 0", fontSize: "16px", fontWeight: "600" }}>Cost of Living</h3>
        {["housing", "food", "transport", "utilities", "other"].map((field) => (
          <div key={field} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <label style={{ textTransform: "capitalize", fontSize: "14px" }}>{field}</label>
            <input type="number" value={costOfLiving[field]} onChange={(e) => updateCostOfLiving(field, e.target.value)} style={{ width: "110px", padding: "9px", border: `1px solid ${border}`, borderRadius: "8px", textAlign: "right", background: bg, color: text }} />
          </div>
        ))}
        <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: `1px solid ${border}`, display: "flex", justifyContent: "space-between", fontWeight: "600" }}>
          <span>Total Living Costs ({viewMode})</span>
          <span>${displayCOL.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
