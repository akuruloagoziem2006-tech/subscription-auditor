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

  // Load saved data when the page opens
  useEffect(() => {
    const savedSubs = localStorage.getItem("subscriptions");
    const savedTotal = localStorage.getItem("total");
    const savedCOL = localStorage.getItem("costOfLiving");

    if (savedSubs) setSubscriptions(JSON.parse(savedSubs));
    if (savedTotal) setTotal(parseFloat(savedTotal));
    if (savedCOL) setCostOfLiving(JSON.parse(savedCOL));
  }, []);

  // Save data whenever it changes
  useEffect(() => {
    localStorage.setItem("subscriptions", JSON.stringify(subscriptions));
    localStorage.setItem("total", total.toString());
    localStorage.setItem("costOfLiving", JSON.stringify(costOfLiving));
  }, [subscriptions, total, costOfLiving]);

  // Improved recurring detection
  function detectRecurring(transactions) {
    const groups = {};

    transactions.forEach((tx) => {
      // Clean the description (remove extra spaces, numbers, etc.)
      let key = tx.description
        .toLowerCase()
        .replace(/[0-9]/g, "")
        .replace(/\s+/g, " ")
        .trim();

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(tx);
    });

    const recurring = [];

    Object.keys(groups).forEach((key) => {
      const items = groups[key];
      if (items.length >= 2) {
        const avgAmount = items.reduce((sum, item) => sum + Math.abs(item.amount), 0) / items.length;
        recurring.push({
          id: key,
          name: items[0].description,
          amount: avgAmount,
          count: items.length,
          status: "keep" // default
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
      prev.map(sub =>
        sub.id === id ? { ...sub, status: newStatus } : sub
      )
    );
  }

  function updateCostOfLiving(field, value) {
    setCostOfLiving(prev => ({
      ...prev,
      [field]: parseFloat(value) || 0
    }));
  }

  const totalCOL = Object.values(costOfLiving).reduce((a, b) => a + b, 0);

  return (
    <div style={{ 
      padding: "16px", 
      fontFamily: "system-ui, sans-serif", 
      maxWidth: "480px", 
      margin: "0 auto",
      backgroundColor: "#f8f9fa",
      minHeight: "100vh"
    }}>
      <h1 style={{ fontSize: "22px", marginBottom: "4px" }}>
        Subscription Auditor
      </h1>
      <p style={{ color: "#666", marginBottom: "20px", fontSize: "14px" }}>
        Detect recurring payments & track living costs
      </p>

      {/* Total Card */}
      <div style={{ 
        backgroundColor: "white",
        padding: "20px", 
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        marginBottom: "16px"
      }}>
        <div style={{ fontSize: "14px", color: "#666" }}>Monthly Recurring Spend</div>
        <div style={{ fontSize: "32px", fontWeight: "700", margin: "4px 0" }}>
          ${total.toFixed(2)}
        </div>
        <div style={{ fontSize: "13px", color: "#888" }}>
          {subscriptions.length} subscriptions detected
        </div>
      </div>

      {/* Upload Button */}
      <label style={{
        display: "block",
        textAlign: "center",
        padding: "14px",
        backgroundColor: "#0070f3",
        color: "white",
        borderRadius: "10px",
        fontWeight: "600",
        marginBottom: "12px",
        cursor: "pointer"
      }}>
        Upload Transactions (CSV)
        <input 
          type="file" 
          accept=".csv" 
          onChange={handleFileUpload}
          style={{ display: "none" }}
        />
      </label>

      {message && (
        <p style={{ textAlign: "center", color: "#0070f3", fontSize: "14px", marginBottom: "16px" }}>
          {message}
        </p>
      )}

      {/* Detected Subscriptions */}
      {subscriptions.length > 0 && (
        <div style={{ 
          backgroundColor: "white",
          borderRadius: "12px",
          padding: "16px",
          marginBottom: "20px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
        }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "16px" }}>Detected Subscriptions</h3>
          
          {subscriptions.map((sub) => (
            <div key={sub.id} style={{
              padding: "12px 0",
              borderBottom: "1px solid #eee",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <div style={{ fontWeight: "500" }}>{sub.name}</div>
                <div style={{ fontSize: "13px", color: "#888" }}>
                  Appeared {sub.count} times
                </div>
              </div>
              
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: "600" }}>${sub.amount.toFixed(2)}</div>
                <div style={{ marginTop: "6px" }}>
                  <button
                    onClick={() => updateStatus(sub.id, "keep")}
                    style={{
                      padding: "4px 8px",
                      fontSize: "12px",
                      marginRight: "4px",
                      backgroundColor: sub.status === "keep" ? "#10b981" : "#e5e7eb",
                      color: sub.status === "keep" ? "white" : "#333",
                      border: "none",
                      borderRadius: "4px"
                    }}
                  >
                    Keep
                  </button>
                  <button
                    onClick={() => updateStatus(sub.id, "cancel")}
                    style={{
                      padding: "4px 8px",
                      fontSize: "12px",
                      backgroundColor: sub.status === "cancel" ? "#ef4444" : "#e5e7eb",
                      color: sub.status === "cancel" ? "white" : "#333",
                      border: "none",
                      borderRadius: "4px"
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

      {/* Cost of Living Section */}
      <div style={{ 
        backgroundColor: "white",
        borderRadius: "12px",
        padding: "16px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
      }}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: "16px" }}>Cost of Living (Monthly)</h3>
        
        {["housing", "food", "transport", "utilities", "other"].map((field) => (
          <div key={field} style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            marginBottom: "10px"
          }}>
            <label style={{ textTransform: "capitalize", fontSize: "14px" }}>
              {field}
            </label>
            <input
              type="number"
              value={costOfLiving[field]}
              onChange={(e) => updateCostOfLiving(field, e.target.value)}
              style={{
                width: "100px",
                padding: "6px 10px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                textAlign: "right"
              }}
            />
          </div>
        ))}

        <div style={{ 
          marginTop: "12px", 
          paddingTop: "12px", 
          borderTop: "1px solid #eee",
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
