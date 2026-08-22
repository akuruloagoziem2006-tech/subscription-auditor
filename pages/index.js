import { useState, useEffect } from "react";

export default function Home() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState("");
  const [darkMode, setDarkMode] = useState(false);
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

  // Improved detection
  function detectRecurring(transactions) {
    const groups = {};

    transactions.forEach((tx) => {
      let key = tx.description
        .toLowerCase()
        .replace(/[0-9]/g, "")
        .replace(/[^a-z\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();

      // Common cleanups
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

        // Simple category guess
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

    return recurring;
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

    setSubscriptions(prev => [...prev, newSub]);
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

  const totalCOL = Object.values(costOfLiving).reduce((a, b) => a + b, 0);
  const savings = subscriptions
    .filter(sub => sub.status === "cancel")
    .reduce((sum, sub) => sum + sub.amount, 0);
  const grandTotal = total + totalCOL;

  // Theme colors
  const bg = darkMode ? "#0f172a" : "#f8fafc";
  const card = darkMode ? "#1e293b" : "white";
  const text = darkMode ? "#f1f5f9" : "#0f172a";
  const muted = darkMode ? "#94a3b8" : "#64748b";
  const border = darkMode ? "#334155" : "#e2e8f0";

  return (
    <div style={{ 
      padding: "16px", 
      fontFamily: "system-ui, -apple-system, sans-serif", 
      maxWidth: "480px", 
      margin: "0 auto",
      backgroundColor: bg,
      minHeight: "100vh",
      color: text,
      transition: "background 0.3s"
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: "700", margin: 0 }}>
          Subscription Auditor
        </h1>
        <button
          onClick={() => setDarkMode(!darkMode)}
          style={{
            padding: "6px 12px",
            borderRadius: "20px",
            border: `1px solid ${border}`,
            background: card,
            color: text,
            fontSize: "13px",
            cursor: "pointer"
          }}
        >
          {darkMode ? "Light" : "Dark"}
        </button>
      </div>
      <p style={{ color: muted, marginBottom: "20px", fontSize: "13px" }}>
        Find forgotten subscriptions & track living costs
      </p>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
        <div style={{ backgroundColor: card, padding: "14px", borderRadius: "12px" }}>
          <div style={{ fontSize: "12px", color: muted }}>Monthly Recurring</div>
          <div style={{ fontSize: "20px", fontWeight: "700" }}>${total.toFixed(2)}</div>
        </div>

        <div style={{ 
          backgroundColor: darkMode ? "#14532d" : "#ecfdf5",
          padding: "14px", 
          borderRadius: "12px",
          border: darkMode ? "1px solid #166534" : "1px solid #bbf7d0"
        }}>
          <div style={{ fontSize: "12px", color: darkMode ? "#86efac" : "#166534" }}>You can save</div>
          <div style={{ fontSize: "20px", fontWeight: "700", color: "#16a34a" }}>
            ${savings.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Grand Total */}
      <div style={{ 
        backgroundColor: darkMode ? "#1e293b" : "#0f172a",
        color: "white",
        padding: "12px 16px", 
        borderRadius: "12px",
        marginBottom: "16px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <span style={{ fontSize: "13px" }}>Total Monthly</span>
        <span style={{ fontSize: "17px", fontWeight: "700" }}>${grandTotal.toFixed(2)}</span>
      </div>

      {/* Buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
        <label style={{
          display: "block",
          textAlign: "center",
          padding: "12px",
          backgroundColor: "#2563eb",
          color: "white",
          borderRadius: "10px",
          fontWeight: "600",
          fontSize: "14px",
          cursor: "pointer"
        }}>
          Upload CSV
          <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: "none" }} />
        </label>

        <button
          onClick={exportData}
          style={{
            padding: "12px",
            backgroundColor: card,
            color: text,
            border: `1px solid ${border}`,
            borderRadius: "10px",
            fontWeight: "600",
            fontSize: "14px",
            cursor: "pointer"
          }}
        >
          Export CSV
        </button>
      </div>

      {message && (
        <p style={{ textAlign: "center", color: "#2563eb", fontSize: "13px", marginBottom: "12px" }}>
          {message}
        </p>
      )}

      {/* Manual Add */}
      <div style={{ backgroundColor: card, borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: "15px", fontWeight: "600" }}>Add Subscription</h3>
        <input
          type="text"
          placeholder="Name (e.g. Netflix)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "8px", borderRadius: "8px", border: `1px solid ${border}`, background: bg, color: text, boxSizing: "border-box" }}
        />
        <input
          type="number"
          placeholder="Amount"
          value={newAmount}
          onChange={(e) => setNewAmount(e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "8px", borderRadius: "8px", border: `1px solid ${border}`, background: bg, color: text, boxSizing: "border-box" }}
        />
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "8px", borderRadius: "8px", border: `1px solid ${border}`, background: bg, color: text }}
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <button
          onClick={addManualSubscription}
          style={{
            width: "100%",
            padding: "10px",
            backgroundColor: "#0f172a",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontWeight: "600"
          }}
        >
          Add Subscription
        </button>
      </div>

      {/* Subscriptions List */}
      {subscriptions.length > 0 && (
        <div style={{ backgroundColor: card, borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "15px", fontWeight: "600" }}>Your Subscriptions</h3>
          
          {subscriptions.map((sub) => (
            <div key={sub.id} style={{
              padding: "12px 0",
              borderBottom: `1px solid ${border}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start"
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "500" }}>{sub.name}</div>
                <div style={{ fontSize: "12px", color: muted }}>
                  {sub.category} • {sub.count > 1 ? `${sub.count} times` : "Manual"}
                </div>
              </div>
              
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: "600", marginBottom: "6px" }}>${sub.amount.toFixed(2)}</div>
                <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button onClick={() => updateStatus(sub.id, "keep")} style={{
                    padding: "4px 8px", fontSize: "11px",
                    backgroundColor: sub.status === "keep" ? "#16a34a" : border,
                    color: sub.status === "keep" ? "white" : text,
                    border: "none", borderRadius: "6px"
                  }}>Keep</button>
                  <button onClick={() => updateStatus(sub.id, "cancel")} style={{
                    padding: "4px 8px", fontSize: "11px",
                    backgroundColor: sub.status === "cancel" ? "#dc2626" : border,
                    color: sub.status === "cancel" ? "white" : text,
                    border: "none", borderRadius: "6px"
                  }}>Cancel</button>
                  <button onClick={() => deleteSubscription(sub.id)} style={{
                    padding: "4px 8px", fontSize: "11px",
                    backgroundColor: darkMode ? "#450a0a" : "#fee2e2",
                    color: "#ef4444",
                    border: "none", borderRadius: "6px"
                  }}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cost of Living */}
      <div style={{ backgroundColor: card, borderRadius: "12px", padding: "16px" }}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: "15px", fontWeight: "600" }}>Cost of Living</h3>
        
        {["housing", "food", "transport", "utilities", "other"].map((field) => (
          <div key={field} style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            marginBottom: "10px"
          }}>
            <label style={{ textTransform: "capitalize", fontSize: "14px" }}>{field}</label>
            <input
              type="number"
              value={costOfLiving[field]}
              onChange={(e) => updateCostOfLiving(field, e.target.value)}
              style={{
                width: "100px",
                padding: "8px",
                border: `1px solid ${border}`,
                borderRadius: "8px",
                textAlign: "right",
                background: bg,
                color: text
              }}
            />
          </div>
        ))}

        <div style={{ 
          marginTop: "12px", 
          paddingTop: "12px", 
          borderTop: `1px solid ${border}`,
          display: "flex",
          justifyContent: "space-between",
          fontWeight: "600"
        }}>
          <span>Total Living Costs</span>
          <span>${totalCOL.toFixed(2)}</span>
        </div>
      </div>

      {/* Future Bank Connection Note */}
      <p style={{ textAlign: "center", fontSize: "12px", color: muted, marginTop: "24px" }}>
        Bank connection (Plaid) coming soon
      </p>
    </div>
  );
}
