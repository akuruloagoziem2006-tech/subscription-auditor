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
  const [editNotes, setEditNotes] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("amount-desc");
  const [lastSynced, setLastSynced] = useState(null);
  const [showCostOfLiving, setShowCostOfLiving] = useState(false);
  const [showTip, setShowTip] = useState(true);

  const [costOfLiving, setCostOfLiving] = useState({
    housing: 0, food: 0, transport: 0, utilities: 0, other: 0
  });

  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCategory, setNewCategory] = useState("Entertainment");
  const [newNotes, setNewNotes] = useState("");

  const [linkToken, setLinkToken] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [plaidStatus, setPlaidStatus] = useState("idle");

  const categories = ["Entertainment", "Music", "Health", "Software", "Shopping", "Food", "Other"];

  useEffect(() => {
    const savedSubs = localStorage.getItem("subscriptions");
    const savedTotal = localStorage.getItem("total");
    const savedCOL = localStorage.getItem("costOfLiving");
    const savedDark = localStorage.getItem("darkMode");
    const savedSync = localStorage.getItem("lastSynced");
    const tipDismissed = localStorage.getItem("tipDismissed");

    if (savedSubs) setSubscriptions(JSON.parse(savedSubs));
    if (savedTotal) setTotal(parseFloat(savedTotal));
    if (savedCOL) setCostOfLiving(JSON.parse(savedCOL));
    if (savedDark) setDarkMode(savedDark === "true");
    if (savedSync) setLastSynced(savedSync);
    if (tipDismissed === "true") setShowTip(false);
  }, []);

  useEffect(() => {
    localStorage.setItem("subscriptions", JSON.stringify(subscriptions));
    localStorage.setItem("total", total.toString());
    localStorage.setItem("costOfLiving", JSON.stringify(costOfLiving));
    localStorage.setItem("darkMode", darkMode.toString());
    if (lastSynced) localStorage.setItem("lastSynced", lastSynced);
  }, [subscriptions, total, costOfLiving, darkMode, lastSynced]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  async function createLinkToken() {
    setPlaidStatus("preparing");
    try {
      const response = await fetch("/api/create-link-token", { method: "POST" });
      const data = await response.json();
      if (data.link_token) {
        setLinkToken(data.link_token);
        setPlaidStatus("ready");
      } else {
        setPlaidStatus("error");
        alert("Failed to create link token");
      }
    } catch (error) {
      setPlaidStatus("error");
      alert("Error connecting to server");
    }
  }

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token) => {
      setPlaidStatus("connecting");
      try {
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
          setLastSynced(new Date().toLocaleString());
          setPlaidStatus("success");
          alert(`Success! Found ${detected.length} recurring subscriptions from your bank.`);
        } else {
          setPlaidStatus("error");
          alert("No transactions found.");
        }
      } catch (error) {
        setPlaidStatus("error");
        alert("Error during bank connection process");
      }
    },
    onExit: () => setPlaidStatus(linkToken ? "ready" : "idle"),
  });

  function detectRecurring(transactions) {
    const groups = {};
    transactions.forEach((tx) => {
      let key = (tx.description || "")
        .toLowerCase()
        .replace(/[0-9]/g, "")
        .replace(/[^a-z\s]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b(ltd|inc|llc|payment|debit|credit|card)\b/g, "")
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
        let category = "Other";
        const lower = key.toLowerCase();

        if (lower.includes("netflix") || lower.includes("disney") || lower.includes("hulu") || lower.includes("youtube") || lower.includes("prime video") || lower.includes("hbo") || lower.includes("paramount") || lower.includes("peacock") || lower.includes("crunchyroll") || lower.includes("apple tv")) {
          category = "Entertainment";
        } else if (lower.includes("spotify") || lower.includes("apple music") || lower.includes("tidal") || lower.includes("youtube music") || lower.includes("deezer") || lower.includes("pandora") || lower.includes("amazon music")) {
          category = "Music";
        } else if (lower.includes("gym") || lower.includes("fitness") || lower.includes("health") || lower.includes("peloton") || lower.includes("planet fitness") || lower.includes("yoga") || lower.includes("calm") || lower.includes("headspace") || lower.includes("myfitnesspal")) {
          category = "Health";
        } else if (lower.includes("adobe") || lower.includes("microsoft") || lower.includes("google") || lower.includes("dropbox") || lower.includes("notion") || lower.includes("slack") || lower.includes("zoom") || lower.includes("canva") || lower.includes("github") || lower.includes("openai") || lower.includes("chatgpt") || lower.includes("grammarly") || lower.includes("lastpass") || lower.includes("1password") || lower.includes("icloud")) {
          category = "Software";
        } else if (lower.includes("amazon") || lower.includes("ebay") || lower.includes("walmart") || lower.includes("target") || lower.includes("shopify") || lower.includes("etsy") || lower.includes("best buy") || lower.includes("aliexpress")) {
          category = "Shopping";
        } else if (lower.includes("mcdonald") || lower.includes("starbucks") || lower.includes("uber eats") || lower.includes("doordash") || lower.includes("grubhub") || lower.includes("chipotle") || lower.includes("dunkin") || lower.includes("coffee") || lower.includes("restaurant")) {
          category = "Food";
        }

        recurring.push({
          id: key + Date.now() + Math.random(),
          name: items[0].description,
          amount: avgAmount,
          count: items.length,
          status: "keep",
          category,
          notes: "",
          reviewed: false
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
            if (description && !isNaN(amount)) transactions.push({ description, amount });
          }
        }
        const detected = detectRecurring(transactions);
        setSubscriptions(detected);
        setTotal(detected.reduce((sum, sub) => sum + sub.amount, 0));
        setMessage(`Found ${detected.length} recurring subscriptions`);
        setLastSynced(new Date().toLocaleString());
      } catch (err) {
        setMessage("Error reading file.");
      }
    };
    reader.readAsText(file);
  }

  function updateStatus(id, newStatus) {
    setSubscriptions(prev => prev.map(sub => sub.id === id ? { ...sub, status: newStatus } : sub));
  }

  function toggleReviewed(id) {
    setSubscriptions(prev => prev.map(sub => sub.id === id ? { ...sub, reviewed: !sub.reviewed } : sub));
  }

  function clearAllReviewed() {
    if (!confirm("Clear reviewed status from all subscriptions?")) return;
    setSubscriptions(prev => prev.map(sub => ({ ...sub, reviewed: false })));
  }

  function quickChangeCategory(id, newCat) {
    setSubscriptions(prev => prev.map(sub => sub.id === id ? { ...sub, category: newCat } : sub));
  }

  function deleteSubscription(id) {
    if (!confirm("Are you sure you want to delete this subscription?")) return;
    const sub = subscriptions.find(s => s.id === id);
    if (sub) setTotal(prev => prev - sub.amount);
    setSubscriptions(prev => prev.filter(sub => sub.id !== id));
  }

  function startEdit(sub) {
    setEditingId(sub.id);
    setEditName(sub.name);
    setEditAmount(sub.amount.toString());
    setEditCategory(sub.category || "Other");
    setEditNotes(sub.notes || "");
  }

  function saveEdit() {
    if (!editName || !editAmount) return;
    const newAmt = parseFloat(editAmount);
    const oldSub = subscriptions.find(s => s.id === editingId);
    const difference = newAmt - (oldSub ? oldSub.amount : 0);
    setSubscriptions(prev =>
      prev.map(sub => sub.id === editingId ? { ...sub, name: editName, amount: newAmt, category: editCategory, notes: editNotes } : sub)
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
      category: newCategory,
      notes: newNotes,
      reviewed: false
    };
    setSubscriptions(prev => [...prev, newSub]);
    setTotal(prev => prev + amount);
    setNewName("");
    setNewAmount("");
    setNewNotes("");
  }

  function updateCostOfLiving(field, value) {
    setCostOfLiving(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
  }

  function exportData(onlyFiltered = false) {
    const dataToExport = onlyFiltered ? filteredSubs : subscriptions;
    let csv = "Name,Amount,Category,Status,Count,Notes,Reviewed\n";
    dataToExport.forEach(sub => {
      csv += `"\( {sub.name}", \){sub.amount.toFixed(2)},\( {sub.category}, \){sub.status},\( {sub.count}," \){sub.notes || ""}",${sub.reviewed ? "Yes" : "No"}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = onlyFiltered ? "filtered-subscriptions.csv" : "subscriptions-export.csv";
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
      setFilterCategory("All");
      setSearchTerm("");
      setLastSynced(null);
    }
  }

  function dismissTip() {
    setShowTip(false);
    localStorage.setItem("tipDismissed", "true");
  }

  let filteredSubs = subscriptions
    .filter(sub => filterCategory === "All" || sub.category === filterCategory)
    .filter(sub => sub.name.toLowerCase().includes(searchTerm.toLowerCase()));

  if (sortBy === "amount-desc") filteredSubs.sort((a, b) => b.amount - a.amount);
  else if (sortBy === "amount-asc") filteredSubs.sort((a, b) => a.amount - b.amount);
  else if (sortBy === "name") filteredSubs.sort((a, b) => a.name.localeCompare(b.name));
  else if (sortBy === "category") filteredSubs.sort((a, b) => a.category.localeCompare(b.category));

  const categoryTotals = {};
  subscriptions.forEach(sub => {
    categoryTotals[sub.category] = (categoryTotals[sub.category] || 0) + sub.amount;
  });

  const maxCategoryAmount = Math.max(...Object.values(categoryTotals), 1);
  const reviewedCount = subscriptions.filter(s => s.reviewed).length;

  const totalCOL = Object.values(costOfLiving).reduce((a, b) => a + b, 0);
  const savings = subscriptions.filter(sub => sub.status === "cancel").reduce((sum, sub) => sum + sub.amount, 0);
  const displayTotal = viewMode === "yearly" ? total * 12 : total;
  const displaySavings = viewMode === "yearly" ? savings * 12 : savings;
  const displayCOL = viewMode === "yearly" ? totalCOL * 12 : totalCOL;
  const grandTotal = displayTotal + displayCOL;
  const yearlySavings = savings * 12;

  const bg = darkMode ? "#0f172a" : "#f8fafc";
  const card = darkMode ? "#1e293b" : "white";
  const text = darkMode ? "#f1f5f9" : "#0f172a";
  const muted = darkMode ? "#94a3b8" : "#64748b";
  const border = darkMode ? "#334155" : "#e2e8f0";

  return (
    <div style={{ padding: "16px", fontFamily: "system-ui, -apple-system, sans-serif", maxWidth: "720px", margin: "0 auto", backgroundColor: bg, minHeight: "100vh", color: text }}>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: "700", margin: 0 }}>Subscription Auditor</h1>
        <button onClick={() => setDarkMode(!darkMode)} style={{ padding: "6px 12px", borderRadius: "20px", border: `1px solid ${border}`, background: card, color: text, fontSize: "13px" }}>
          {darkMode ? "Light" : "Dark"}
        </button>
      </div>
      <p style={{ color: muted, marginBottom: "6px", fontSize: "13px" }}>Find forgotten subscriptions & track living costs</p>
      
      {lastSynced && (
        <p style={{ color: muted, marginBottom: "14px", fontSize: "12px" }}>Last synced: {lastSynced}</p>
      )}

      {/* Onboarding Tip */}
      {showTip && subscriptions.length === 0 && (
        <div style={{ backgroundColor: darkMode ? "#1e3a5f" : "#eff6ff", border: darkMode ? "1px solid #1e40af" : "1px solid #bfdbfe", borderRadius: "12px", padding: "14px", marginBottom: "14px", position: "relative" }}>
          <button onClick={dismissTip} style={{ position: "absolute", top: "8px", right: "10px", background: "none", border: "none", color: muted, fontSize: "16px", cursor: "pointer" }}>×</button>
          <div style={{ fontWeight: "600", fontSize: "14px", marginBottom: "4px" }}>Getting Started</div>
          <div style={{ fontSize: "13px", color: muted, lineHeight: "1.4" }}>
            Upload a CSV of your bank transactions or connect your bank with Plaid to automatically detect recurring subscriptions.
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
        <button onClick={() => setViewMode("monthly")} style={{ flex: 1, padding: "9px", borderRadius: "8px", border: "none", background: viewMode === "monthly" ? "#2563eb" : card, color: viewMode === "monthly" ? "white" : text, fontWeight: "600", fontSize: "13px" }}>Monthly</button>
        <button onClick={() => setViewMode("yearly")} style={{ flex: 1, padding: "9px", borderRadius: "8px", border: "none", background: viewMode === "yearly" ? "#2563eb" : card, color: viewMode === "yearly" ? "white" : text, fontWeight: "600", fontSize: "13px" }}>Yearly</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
        <div style={{ backgroundColor: card, padding: "14px", borderRadius: "12px" }}>
          <div style={{ fontSize: "12px", color: muted }}>{viewMode === "yearly" ? "Yearly" : "Monthly"} Recurring</div>
          <div style={{ fontSize: "20px", fontWeight: "700" }}>${displayTotal.toFixed(2)}</div>
        </div>
        <div style={{ backgroundColor: darkMode ? "#14532d" : "#ecfdf5", padding: "14px", borderRadius: "12px", border: darkMode ? "1px solid #166534" : "1px solid #bbf7d0" }}>
          <div style={{ fontSize: "12px", color: darkMode ? "#86efac" : "#166534" }}>You can save</div>
          <div style={{ fontSize: "20px", fontWeight: "700", color: "#16a34a" }}>${displaySavings.toFixed(2)}</div>
        </div>
      </div>

      {savings > 0 && (
        <div style={{ backgroundColor: darkMode ? "#052e16" : "#f0fdf4", border: darkMode ? "1px solid #166534" : "1px solid #bbf7d0", borderRadius: "12px", padding: "12px 16px", marginBottom: "14px", textAlign: "center" }}>
          <div style={{ fontSize: "13px", color: darkMode ? "#86efac" : "#166534" }}>Potential Yearly Savings</div>
          <div style={{ fontSize: "22px", fontWeight: "700", color: "#16a34a" }}>${yearlySavings.toFixed(2)}</div>
        </div>
      )}

      <div style={{ backgroundColor: darkMode ? "#1e293b" : "#0f172a", color: "white", padding: "12px 16px", borderRadius: "12px", marginBottom: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "13px" }}>Total {viewMode === "yearly" ? "Yearly" : "Monthly"}</span>
        <span style={{ fontSize: "17px", fontWeight: "700" }}>${grandTotal.toFixed(2)}</span>
      </div>

      {subscriptions.length > 0 && (
        <div style={{ backgroundColor: card, borderRadius: "12px", padding: "14px", marginBottom: "14px" }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600" }}>Spending by Category</h3>
          {Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => {
            const percentage = (amount / maxCategoryAmount) * 100;
            const displayAmount = viewMode === "yearly" ? amount * 12 : amount;
            return (
              <div key={cat} style={{ marginBottom: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                  <span>{cat}</span>
                  <span style={{ fontWeight: "600" }}>${displayAmount.toFixed(2)}</span>
                </div>
                <div style={{ height: "6px", backgroundColor: border, borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${percentage}%`, backgroundColor: "#2563eb", borderRadius: "4px" }}></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
        <label style={{ display: "block", textAlign: "center", padding: "11px", backgroundColor: "#2563eb", color: "white", borderRadius: "10px", fontWeight: "600", fontSize: "13px" }}>
          Upload CSV
          <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: "none" }} />
        </label>
        <button onClick={() => exportData(false)} style={{ padding: "11px", backgroundColor: card, color: text, border: `1px solid ${border}`, borderRadius: "10px", fontWeight: "600", fontSize: "13px" }}>Export All</button>
      </div>

      {filteredSubs.length > 0 && filteredSubs.length !== subscriptions.length && (
        <button onClick={() => exportData(true)} style={{ width: "100%", padding: "10px", marginBottom: "8px", backgroundColor: card, color: text, border: `1px solid ${border}`, borderRadius: "10px", fontWeight: "600", fontSize: "13px" }}>
          Export Filtered ({filteredSubs.length})
        </button>
      )}

      <button
        onClick={() => {
          if (plaidStatus === "ready" && ready) open();
          else if (["idle", "error", "success"].includes(plaidStatus)) createLinkToken();
        }}
        disabled={plaidStatus === "preparing" || plaidStatus === "connecting"}
        style={{
          width: "100%", padding: "12px", marginBottom: "10px",
          backgroundColor: plaidStatus === "success" ? "#16a34a" : "#0f172a",
          color: "white", border: "none", borderRadius: "10px", fontWeight: "600", fontSize: "14px",
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

      <div style={{ display: "grid", gridTemplateColumns: reviewedCount > 0 ? "1fr 1fr" : "1fr", gap: "8px", marginBottom: "14px" }}>
        <button onClick={clearAllData} style={{ padding: "9px", backgroundColor: darkMode ? "#450a0a" : "#fef2f2", color: "#dc2626", border: "none", borderRadius: "10px", fontWeight: "600", fontSize: "13px" }}>
          Clear All Data
        </button>
        {reviewedCount > 0 && (
          <button onClick={clearAllReviewed} style={{ padding: "9px", backgroundColor: darkMode ? "#0c4a6e" : "#e0f2fe", color: darkMode ? "#7dd3fc" : "#0369a1", border: "none", borderRadius: "10px", fontWeight: "600", fontSize: "13px" }}>
            Clear Reviewed ({reviewedCount})
          </button>
        )}
      </div>

      {message && <p style={{ textAlign: "center", color: "#2563eb", fontSize: "13px", marginBottom: "14px" }}>{message}</p>}

      {subscriptions.length > 0 && (
        <>
          <input
            type="text"
            placeholder="Search subscriptions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "100%", padding: "10px", marginBottom: "10px", borderRadius: "8px", border: `1px solid ${border}`, background: card, color: text, boxSizing: "border-box", fontSize: "14px" }}
          />

          <div style={{ display: "flex", gap: "8px", marginBottom: "12px", alignItems: "center" }}>
            <span style={{ fontSize: "13px", color: muted }}>Sort:</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: `1px solid ${border}`, background: card, color: text, fontSize: "13px" }}>
              <option value="amount-desc">Highest amount</option>
              <option value="amount-asc">Lowest amount</option>
              <option value="name">Name A-Z</option>
              <option value="category">Category</option>
            </select>
          </div>
        </>
      )}

      {subscriptions.length > 0 && (
        <div style={{ marginBottom: "14px", overflowX: "auto", whiteSpace: "nowrap", paddingBottom: "4px" }}>
          <button onClick={() => setFilterCategory("All")} style={{ padding: "6px 12px", marginRight: "6px", borderRadius: "20px", border: "none", background: filterCategory === "All" ? "#2563eb" : card, color: filterCategory === "All" ? "white" : text, fontSize: "12px" }}>All</button>
          {categories.map(cat => (
            <button key={cat} onClick={() => setFilterCategory(cat)} style={{ padding: "6px 12px", marginRight: "6px", borderRadius: "20px", border: "none", background: filterCategory === cat ? "#2563eb" : card, color: filterCategory === cat ? "white" : text, fontSize: "12px" }}>{cat}</button>
          ))}
        </div>
      )}

      <div style={{ backgroundColor: card, borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: "15px", fontWeight: "600" }}>Add Subscription</h3>
        <input type="text" placeholder="Name (e.g. Netflix)" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "8px", borderRadius: "8px", border: `1px solid ${border}`, background: bg, color: text, boxSizing: "border-box" }} />
        <input type="number" placeholder="Amount" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "8px", borderRadius: "8px", border: `1px solid ${border}`, background: bg, color: text, boxSizing: "border-box" }} />
        <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "8px", borderRadius: "8px", border: `1px solid ${border}`, background: bg, color: text }}>
          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <input type="text" placeholder="Notes (optional)" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "10px", borderRadius: "8px", border: `1px solid ${border}`, background: bg, color: text, boxSizing: "border-box" }} />
        <button onClick={addManualSubscription} style={{ width: "100%", padding: "11px", backgroundColor: "#0f172a", color: "white", border: "none", borderRadius: "8px", fontWeight: "600" }}>Add Subscription</button>
      </div>

      {filteredSubs.length > 0 ? (
        <div style={{ backgroundColor: card, borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "600" }}>
              Your Subscriptions {filterCategory !== "All" && `(${filterCategory})`}
            </h3>
            <span style={{ fontSize: "12px", color: muted }}>{filteredSubs.length} shown</span>
          </div>

          {filteredSubs.map((sub) => {
            const isHighCost = sub.amount >= 50;
            return (
              <div key={sub.id} style={{ 
                padding: "12px 0", 
                borderBottom: `1px solid ${border}`, 
                opacity: sub.reviewed ? 0.7 : 1,
                backgroundColor: isHighCost ? (darkMode ? "#1c1917" : "#fff7ed") : "transparent",
                margin: isHighCost ? "0 -8px" : "0",
                paddingLeft: isHighCost ? "8px" : "0",
                paddingRight: isHighCost ? "8px" : "0",
                borderRadius: isHighCost ? "8px" : "0"
              }}>
                {editingId === sub.id ? (
                  <div>
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} style={{ width: "100%", padding: "8px", marginBottom: "6px", borderRadius: "6px", border: `1px solid ${border}`, background: bg, color: text, boxSizing: "border-box" }} />
                    <input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} style={{ width: "100%", padding: "8px", marginBottom: "6px", borderRadius: "6px", border: `1px solid ${border}`, background: bg, color: text, boxSizing: "border-box" }} />
                    <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} style={{ width: "100%", padding: "8px", marginBottom: "6px", borderRadius: "6px", border: `1px solid ${border}`, background: bg, color: text }}>
                      {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    <input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Notes" style={{ width: "100%", padding: "8px", marginBottom: "8px", borderRadius: "6px", border: `1px solid ${border}`, background: bg, color: text, boxSizing: "border-box" }} />
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={saveEdit} style={{ flex: 1, padding: "8px", background: "#16a34a", color: "white", border: "none", borderRadius: "6px" }}>Save</button>
                      <button onClick={() => setEditingId(null)} style={{ flex: 1, padding: "8px", background: border, color: text, border: "none", borderRadius: "6px" }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: "500", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          {sub.name}
                          {isHighCost && <span style={{ fontSize: "10px", background: "#ea580c", color: "white", padding: "1px 5px", borderRadius: "4px" }}>High</span>}
                          {sub.reviewed && <span style={{ fontSize: "10px", background: "#16a34a", color: "white", padding: "1px 5px", borderRadius: "4px" }}>Reviewed</span>}
                        </div>
                        <div style={{ fontSize: "12px", color: muted, marginTop: "2px" }}>
                          {sub.category} • {sub.count > 1 ? `${sub.count} times` : "Manual"}
                          {sub.notes && ` • ${sub.notes}`}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: "600", marginBottom: "6px", fontSize: "14px" }}>
                          ${(viewMode === "yearly" ? sub.amount * 12 : sub.amount).toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div style={{ margin: "8px 0 6px 0" }}>
                      <select
                        value={sub.category}
                        onChange={(e) => quickChangeCategory(sub.id, e.target.value)}
                        style={{ padding: "4px 6px", fontSize: "11px", borderRadius: "6px", border: `1px solid ${border}`, background: bg, color: text }}
                      >
                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>

                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                      <button onClick={() => updateStatus(sub.id, "keep")} style={{ padding: "4px 7px", fontSize: "11px", backgroundColor: sub.status === "keep" ? "#16a34a" : border, color: sub.status === "keep" ? "white" : text, border: "none", borderRadius: "6px" }}>Keep</button>
                      <button onClick={() => updateStatus(sub.id, "cancel")} style={{ padding: "4px 7px", fontSize: "11px", backgroundColor: sub.status === "cancel" ? "#dc2626" : border, color: sub.status === "cancel" ? "white" : text, border: "none", borderRadius: "6px" }}>Cancel</button>
                      <button onClick={() => toggleReviewed(sub.id)} style={{ padding: "4px 7px", fontSize: "11px", backgroundColor: sub.reviewed ? "#0ea5e9" : border, color: sub.reviewed ? "white" : text, border: "none", borderRadius: "6px" }}>
                        {sub.reviewed ? "Reviewed" : "Mark Reviewed"}
                      </button>
                      <button onClick={() => startEdit(sub)} style={{ padding: "4px 7px", fontSize: "11px", backgroundColor: border, color: text, border: "none", borderRadius: "6px" }}>Edit</button>
                      <button onClick={() => deleteSubscription(sub.id)} style={{ padding: "4px 7px", fontSize: "11px", backgroundColor: darkMode ? "#450a0a" : "#fee2e2", color: "#ef4444", border: "none", borderRadius: "6px" }}>Delete</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ backgroundColor: card, borderRadius: "12px", padding: "40px 16px", marginBottom: "16px", textAlign: "center", color: muted }}>
          <div style={{ fontSize: "16px", marginBottom: "8px", fontWeight: "500" }}>No subscriptions yet</div>
          <div style={{ fontSize: "13px", lineHeight: "1.5" }}>
            Upload a CSV of your transactions<br />or connect your bank to get started
          </div>
        </div>
      )}

      <div style={{ backgroundColor: card, borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
        <div onClick={() => setShowCostOfLiving(!showCostOfLiving)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "600" }}>Cost of Living</h3>
          <span style={{ fontSize: "13px", color: muted }}>{showCostOfLiving ? "Hide ▲" : "Show ▼"}</span>
        </div>

        {showCostOfLiving && (
          <div style={{ marginTop: "14px" }}>
            {["housing", "food", "transport", "utilities", "other"].map((field) => (
              <div key={field} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <label style={{ textTransform: "capitalize", fontSize: "13px" }}>{field}</label>
                <input type="number" value={costOfLiving[field]} onChange={(e) => updateCostOfLiving(field, e.target.value)} style={{ width: "100px", padding: "8px", border: `1px solid ${border}`, borderRadius: "8px", textAlign: "right", background: bg, color: text }} />
              </div>
            ))}
            <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: `1px solid ${border}`, display: "flex", justifyContent: "space-between", fontWeight: "600", fontSize: "14px" }}>
              <span>Total Living Costs ({viewMode})</span>
              <span>${displayCOL.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ textAlign: "center", marginTop: "20px", paddingBottom: "20px", fontSize: "12px", color: muted }}>
        <a href="/privacy" style={{ color: muted, marginRight: "14px" }}>Privacy Policy</a>
        <a href="/terms" style={{ color: muted }}>Terms of Service</a>
      </div>
    </div>
  );
}
