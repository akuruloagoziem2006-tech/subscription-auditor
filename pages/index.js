import { useState, useEffect } from "react";

export default function Home() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState("");
  const [costOfLiving, setCostOfLiving] = useState({
    housing: 0,
    food: 0,
    transport: 0,
    utilities: 0,
    other: 0
  });

  // For manual add
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");

  // Load saved data
  useEffect(() => {
    const savedSubs = localStorage.getItem("subscriptions");
    const savedTotal = localStorage.getItem("total");
    const savedCOL = localStorage.getItem("costOfLiving");

    if (savedSubs) setSubscriptions(JSON.parse(savedSubs));
    if (savedTotal) setTotal(parseFloat(savedTotal));
    if (savedCOL) setCostOfLiving(JSON.parse(savedCOL));
  }, []);

  // Save data
  useEffect(() => {
    localStorage.setItem("subscriptions", JSON.stringify(subscriptions));
    localStorage.setItem("total", total.toString());
    localStorage.setItem("costOfLiving", JSON.stringify(costOfLiving));
  }, [subscriptions, total, costOfLiving]);

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

      if (key.length < 3) return;

      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    });

    const recurring = [];

    Object.keys(groups).forEach((key) => {
      const items = groups[key];
      if (items.length >= 2) {
        const avgAmount = items.reduce((sum, item) => sum + Math.abs(item.amount), 0) / items.length;
        recurring.push({
          id: key + Date.now(),
          name: items[0].description,
          amount: avgAmount,
          count: items.length,
          status: "keep"
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

  function addManualSubscription() {
    if (!newName || !newAmount) return;

    const newSub = {
      id: Date.now().toString(),
      name: newName,
      amount: parseFloat(newAmount),
      count: 1,
      status: "keep"
    };

    setSubscriptions(prev => [...prev, newSub]);
    setTotal(prev => prev + parseFloat(newAmount));
    setNewName("");
    setNewAmount("");
  }

  function updateCostOfLiving(field, value) {
    setCostOfLiving(prev => ({
      ...prev,
      [field]: parseFloat(value) || 0
    }));
  }

  const totalCOL = Object.values(costOfLiving).reduce((a, b) => a + b, 0);
  const savings = subscriptions
    .filter(sub => sub.status === "cancel")
    .reduce((sum, sub) => sum + sub.amount, 0);

  return (
    <div style={{ 
      padding: "16px", 
      fontFamily: "system-ui, -apple-system, sans-serif", 
      maxWidth: "480px", 
      margin: "0 auto",
      backgroundColor: "#f1f5f9",
      minHeight: "100vh"
    }}>
      <h1 style={{ fontSize: "24px", fontWeight: "700", marginBottom: "4px", color: "#0f172a" }}>
        Subscription Auditor
      </h1>
      <p style={{ color: "#64748b", marginBottom: "20px", fontSize: "14px" }}>
        Find forgotten subscriptions & track living costs
      </p>

      {/* Total + Savings Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
        <div style={{ 
          backgroundColor: "white",
          padding: "16px", 
          borderRadius: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
        }}>
          <div style={{ fontSize: "13px", color: "#64748b" }}>Monthly Recurring</div>
          <div style={{ fontSize: "24px", fontWeight: "700", color: "#0f172a" }}>
            ${total.toFixed(2)}
          </div>
        </div>

        <div style={{ 
          backgroundColor: "white",
          padding: "16px", 
          borderRadius: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
        }}>
          <div style={{ fontSize: "13px", color: "#64748b" }}>You can save</div>
          <div style={{ fontSize: "24px", fontWeight: "700", color: "#16a34a" }}>
            ${savings.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Upload */}
      <label style={{
        display: "block",
        textAlign: "center",
        padding: "14px",
        backgroundColor: "#2563eb",
        color: "white",
        borderRadius: "10px",
        fontWeight: "600",
        marginBottom: "12px",
        cursor: "pointer"
      }}>
        Upload Transactions (CSV)
        <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: "none" }} />
      </label>

      {message && (
        <p style={{ textAlign: "center", color: "#2563eb", fontSize: "14px", marginBottom: "16px" }}>
          {message}
        </p>
      )}

      {/* Manual Add */}
      <div style={{ 
        backgroundColor: "white",
        borderRadius: "12px",
        padding: "16px",
        marginBottom: "16px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
      }}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: "15px" }}>Add Subscription Manually</h3>
        <input
          type="text"
          placeholder="Name (e.g. Netflix)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "8px", borderRadius: "8px", border: "1px solid #e2e8f0" }}
        />
        <input
          type="number"
          placeholder="Amount"
          value={newAmount}
          onChange={(e) => setNewAmount(e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "8px", borderRadius: "8px", border: "1px solid #e2e8f0" }}
        />
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
        <div style={{ 
          backgroundColor: "white",
          borderRadius: "12px",
          padding: "16px",
          marginBottom: "16px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
        }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "15px" }}>Your Subscriptions</h3>
          
          {subscriptions.map((sub) => (
            <div key={sub.id} style={{
              padding: "12px 0",
              borderBottom: "1px solid #f1f5f9",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <div style={{ fontWeight: "500" }}>{sub.name}</div>
                <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                  {sub.count > 1 ? `Appeared ${sub.count} times` : "Manual entry"}
                </div>
              </div>
              
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: "600" }}>${sub.amount.toFixed(2)}</div>
                <div style={{ marginTop: "6px" }}>
                  <button
                    onClick={() => updateStatus(sub.id, "keep")}
                    style={{
                      padding: "4px 10px",
                      fontSize: "12px",
                      marginRight: "4px",
                      backgroundColor: sub.status === "keep" ? "#16a34a" : "#e2e8f0",
                      color: sub.status === "keep" ? "white" : "#334155",
                      border: "none",
                      borderRadius: "6px"
                    }}
                  >
                    Keep
                  </button>
                  <button
                    onClick={() => updateStatus(sub.id, "cancel")}
                    style={{
                      padding: "4px 10px",
                      fontSize: "12px",
                      backgroundColor: sub.status === "cancel" ? "#dc2626" : "#e2e8f0",
                      color: sub.status === "cancel" ? "white" : "#334155",
                      border: "none",
                      borderRadius: "6px"
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cost of Living */}
      <div style={{ 
        backgroundColor: "white",
        borderRadius: "12px",
        padding: "16px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
      }}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: "15px" }}>Cost of Living (Monthly)</h3>
        
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
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                textAlign: "right"
              }}
            />
          </div>
        ))}

        <div style={{ 
          marginTop: "12px", 
          paddingTop: "12px", 
          borderTop: "1px solid #f1f5f9",
          display: "flex",
          justifyContent: "space-between",
          fontWeight: "600"
        }}>
          <span>Total Living Costs</span>
          <span>${totalCOL.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
