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
  const [highCostThreshold, setHighCostThreshold] = useState(50);
  const [simulatorSelected, setSimulatorSelected] = useState([]);
  const [showMoreActions, setShowMoreActions] = useState(false);

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
    const savedThreshold = localStorage.getItem("highCostThreshold");

    if (savedSubs) setSubscriptions(JSON.parse(savedSubs));
    if (savedTotal) setTotal(parseFloat(savedTotal));
    if (savedCOL) setCostOfLiving(JSON.parse(savedCOL));
    if (savedDark) setDarkMode(savedDark === "true");
    if (savedSync) setLastSynced(savedSync);
    if (tipDismissed === "true") setShowTip(false);
    if (savedThreshold) setHighCostThreshold(parseFloat(savedThreshold));
  }, []);

  useEffect(() => {
    localStorage.setItem("subscriptions", JSON.stringify(subscriptions));
    localStorage.setItem("total", total.toString());
    localStorage.setItem("costOfLiving", JSON.stringify(costOfLiving));
    localStorage.setItem("darkMode", darkMode.toString());
    localStorage.setItem("highCostThreshold", highCostThreshold.toString());
    if (lastSynced) localStorage.setItem("lastSynced", lastSynced);
  }, [subscriptions, total, costOfLiving, darkMode, lastSynced, highCostThreshold]);

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

  function cancelSelected() {
    if (simulatorSelected.length === 0) return;
    if (!confirm(`Mark ${simulatorSelected.length} subscription(s) as Cancel?`)) return;
    
    setSubscriptions(prev => 
      prev.map(sub => 
        simulatorSelected.includes(sub.id) ? { ...sub, status: "cancel" } : sub
      )
    );
    setSimulatorSelected([]);
  }

  function quickChangeCategory(id, newCat) {
    setSubscriptions(prev => prev.map(sub => sub.id === id ? { ...sub, category: newCat } : sub));
  }

  function deleteSubscription(id) {
    if (!confirm("Are you sure you want to delete this subscription?")) return;
    const sub = subscriptions.find(s => s.id === id);
    if (sub) setTotal(prev => prev - sub.amount);
    setSubscriptions(prev => prev.filter(sub => sub.id !== id));
    setSimulatorSelected(prev => prev.filter(sid => sid !== id));
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
      setSimulatorSelected([]);
    }
  }

  function dismissTip() {
    setShowTip(false);
    localStorage.setItem("tipDismissed", "true");
  }

  function toggleSimulator(id) {
    setSimulatorSelected(prev =>
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  }

  function clearSimulator() {
    setSimulatorSelected([]);
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

  const reviewedCount = subscriptions.filter(s => s.reviewed).length;
  const highCostCount = subscriptions.filter(s => s.amount >= highCostThreshold).length;
  const unreviewedCount = subscriptions.filter(s => !s.reviewed).length;
  const cancelCount = subscriptions.filter(s => s.status === "cancel").length;

  const totalCOL = Object.values(costOfLiving).reduce((a, b) => a + b, 0);
  const savings = subscriptions.filter(sub => sub.status === "cancel").reduce((sum, sub) => sum + sub.amount, 0);
  const displayTotal = viewMode === "yearly" ? total * 12 : total;
  const displaySavings = viewMode === "yearly" ? savings * 12 : savings;
  const displayCOL = viewMode === "yearly" ? totalCOL * 12 : totalCOL;
  const yearlySavings = savings * 12;

  const simulatorMonthly = subscriptions
    .filter(sub => simulatorSelected.includes(sub.id))
    .reduce((sum, sub) => sum + sub.amount, 0);
  const simulatorYearly = simulatorMonthly * 12;

  // Forgotten Money Score (0-100)
  // Higher score = more potential wasted money
  let forgottenScore = 0;
  if (subscriptions.length > 0) {
    const unreviewedRatio = unreviewedCount / subscriptions.length;
    const highCostRatio = highCostCount / subscriptions.length;
    const cancelRatio = cancelCount / subscriptions.length;
    
    forgottenScore = Math.round(
      (unreviewedRatio * 40) + 
      (highCostRatio * 35) + 
      (cancelRatio * 25)
    );
    if (forgottenScore > 100) forgottenScore = 100;
  }

  let scoreLabel = "Looking good";
  let scoreColor = "#16a34a";
  if (forgottenScore >= 70) {
    scoreLabel = "High risk of wasted money";
    scoreColor = "#dc2626";
  } else if (forgottenScore >= 40) {
    scoreLabel = "Some subscriptions need attention";
    scoreColor = "#ea580c";
  }

  let insight = "";
  if (subscriptions.length > 0) {
    if (savings > 0) {
      insight = "You could save $" + yearlySavings.toFixed(2) + " per year by cancelling marked subscriptions";
    } else if (highCostCount >= 2) {
      insight = "You have " + highCostCount + " high-cost subscriptions above $" + highCostThreshold;
    } else {
      const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
      if (topCategory) {
        insight = "Your highest spending category is " + topCategory[0] + " ($" + topCategory[1].toFixed(2) + "/mo)";
      }
    }
  }

  const bg = darkMode ? "#0b0f19" : "#f8fafc";
  const card = darkMode ? "#151b28" : "#ffffff";
  const text = darkMode ? "#f1f5f9" : "#0f172a";
  const muted = darkMode ? "#94a3b8" : "#64748b";
  const border = darkMode ? "#1e293b" : "#e2e8f0";
  const inputBg = darkMode ? "#0b0f19" : "#f8fafc";

  return (
    <div style={{ 
      padding: "20px 16px", 
      fontFamily: "system-ui, -apple-system, sans-serif", 
      maxWidth: "680px",
      width: "100%",
      margin: "0 auto", 
      backgroundColor: bg, 
      minHeight: "100vh", 
      color: text,
      boxSizing: "border-box"
    }}>
      
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", margin: 0 }}>Subscription Auditor</h1>
          {lastSynced && <p style={{ color: muted, margin: "4px 0 0 0", fontSize: "13px" }}>Last synced: {lastSynced}</p>}
        </div>
        <button onClick={() => setDarkMode(!darkMode)} style={{ padding: "8px 16px", borderRadius: "20px", border: `1px solid ${border}`, background: card, color: text, fontSize: "13px" }}>
          {darkMode ? "Light" : "Dark"}
        </button>
      </div>

      {/* Forgotten Money Score */}
      {subscriptions.length > 0 && (
        <div style={{ 
          backgroundColor: card, 
          borderRadius: "16px", 
          padding: "18px", 
          marginBottom: "20px", 
          border: `1px solid ${border}`,
          textAlign: "center"
        }}>
          <div style={{ fontSize: "13px", color: muted, marginBottom: "6px" }}>Forgotten Money Score</div>
          <div style={{ fontSize: "36px", fontWeight: "700", color: scoreColor }}>{forgottenScore}</div>
          <div style={{ fontSize: "14px", color: scoreColor, marginTop: "4px", fontWeight: "500" }}>{scoreLabel}</div>
        </div>
      )}

      {/* Insight */}
      {insight && (
        <div style={{ 
          backgroundColor: darkMode ? "#1e293b" : "#f1f5f9", 
          borderRadius: "16px", 
          padding: "16px 18px", 
          marginBottom: "24px",
          fontSize: "14px",
          lineHeight: "1.5",
          color: muted
        }}>
          {insight}
        </div>
      )}

      {/* Big Numbers */}
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <div style={{ fontSize: "40px", fontWeight: "700", letterSpacing: "-0.5px" }}>
          ${displayTotal.toFixed(2)}
        </div>
        <div style={{ fontSize: "15px", color: muted, marginTop: "6px" }}>
          {viewMode === "yearly" ? "Yearly" : "Monthly"} Recurring
        </div>
        
        {displaySavings > 0 && (
          <div style={{ marginTop: "14px", fontSize: "16px", color: "#16a34a", fontWeight: "600" }}>
            You can save ${displaySavings.toFixed(2)}
          </div>
        )}
      </div>

      {/* Toggle */}
      <div style={{ display: "flex", backgroundColor: card, borderRadius: "14px", padding: "5px", marginBottom: "24px", border: `1px solid ${border}` }}>
        <button onClick={() => setViewMode("monthly")} style={{ flex: 1, padding: "12px", borderRadius: "11px", border: "none", background: viewMode === "monthly" ? "#2563eb" : "transparent", color: viewMode === "monthly" ? "white" : text, fontWeight: "600", fontSize: "15px" }}>Monthly</button>
        <button onClick={() => setViewMode("yearly")} style={{ flex: 1, padding: "12px", borderRadius: "11px", border: "none", background: viewMode === "yearly" ? "#2563eb" : "transparent", color: viewMode === "yearly" ? "white" : text, fontWeight: "600", fontSize: "15px" }}>Yearly</button>
      </div>

      {/* Simulator */}
      {subscriptions.length > 0 && (
        <div style={{ backgroundColor: card, borderRadius: "16px", padding: "18px", marginBottom: "24px", border: `1px solid ${border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600" }}>What if I cancel these?</h3>
            {simulatorSelected.length > 0 && (
              <button onClick={clearSimulator} style={{ fontSize: "13px", color: muted, background: "none", border: "none" }}>Clear</button>
            )}
          </div>
          
          {simulatorSelected.length === 0 ? (
            <p style={{ fontSize: "14px", color: muted, margin: 0 }}>
              Select subscriptions below to see potential savings
            </p>
          ) : (
            <div>
              <div style={{ fontSize: "14px", color: muted, marginBottom: "4px" }}>
                {simulatorSelected.length} selected
              </div>
              <div style={{ fontSize: "20px", fontWeight: "700", color: "#16a34a" }}>
                Save ${simulatorMonthly.toFixed(2)}/mo
              </div>
              <div style={{ fontSize: "14px", color: muted, marginBottom: "14px" }}>
                ${simulatorYearly.toFixed(2)} per year
              </div>
              <button 
                onClick={cancelSelected}
                style={{ 
                  width: "100%", 
                  padding: "12px", 
                  backgroundColor: "#dc2626", 
                  color: "white", 
                  border: "none", 
                  borderRadius: "10px", 
                  fontWeight: "600",
                  fontSize: "14px"
                }}
              >
                Mark Selected as Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Primary Actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
        <label style={{ display: "block", textAlign: "center", padding: "15px", backgroundColor: "#2563eb", color: "white", borderRadius: "14px", fontWeight: "600", fontSize: "15px" }}>
          Upload CSV
          <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: "none" }} />
        </label>
        <button
          onClick={() => {
            if (plaidStatus === "ready" && ready) open();
            else if (["idle", "error", "success"].includes(plaidStatus)) createLinkToken();
          }}
          disabled={plaidStatus === "preparing" || plaidStatus === "connecting"}
          style={{
            padding: "15px",
            backgroundColor: plaidStatus === "success" ? "#16a34a" : card,
            color: plaidStatus === "success" ? "white" : text,
            border: `1px solid ${border}`,
            borderRadius: "14px",
            fontWeight: "600",
            fontSize: "15px",
            opacity: plaidStatus === "preparing" || plaidStatus === "connecting" ? 0.7 : 1
          }}
        >
          {plaidStatus === "preparing" && "Preparing..."}
          {plaidStatus === "ready" && "Connect Bank"}
          {plaidStatus === "connecting" && "Connecting..."}
          {plaidStatus === "success" && "Connected ✓"}
          {plaidStatus === "error" && "Try Again"}
          {plaidStatus === "idle" && "Connect Bank"}
        </button>
      </div>

      <button onClick={() => setShowMoreActions(!showMoreActions)} style={{ width: "100%", padding: "12px", marginBottom: "24px", background: "none", border: "none", color: muted, fontSize: "14px" }}>
        {showMoreActions ? "Hide more actions ▲" : "More actions ▼"}
      </button>

      {showMoreActions && (
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <button onClick={() => exportData(false)} style={{ padding: "13px", backgroundColor: card, color: text, border: `1px solid ${border}`, borderRadius: "12px", fontWeight: "500", fontSize: "14px" }}>Export All</button>
            <button onClick={clearAllData} style={{ padding: "13px", backgroundColor: darkMode ? "#450a0a" : "#fef2f2", color: "#dc2626", border: "none", borderRadius: "12px", fontWeight: "500", fontSize: "14px" }}>Clear Data</button>
          </div>
          {reviewedCount > 0 && (
            <button onClick={clearAllReviewed} style={{ width: "100%", padding: "13px", backgroundColor: darkMode ? "#0c4a6e" : "#e0f2fe", color: darkMode ? "#7dd3fc" : "#0369a1", border: "none", borderRadius: "12px", fontWeight: "500", fontSize: "14px" }}>
              Clear Reviewed ({reviewedCount})
            </button>
          )}
        </div>
      )}

      {message && <p style={{ textAlign: "center", color: "#2563eb", fontSize: "14px", marginBottom: "16px" }}>{message}</p>}

      {/* Search & Filters */}
      {subscriptions.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "100%", padding: "13px 16px", marginBottom: "12px", borderRadius: "12px", border: `1px solid ${border}`, background: card, color: text, boxSizing: "border-box", fontSize: "15px" }}
          />
          
          <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
            <button onClick={() => setFilterCategory("All")} style={{ padding: "7px 16px", borderRadius: "20px", border: "none", background: filterCategory === "All" ? "#2563eb" : card, color: filterCategory === "All" ? "white" : text, fontSize: "13px", whiteSpace: "nowrap" }}>All</button>
            {categories.map(cat => (
              <button key={cat} onClick={() => setFilterCategory(cat)} style={{ padding: "7px 16px", borderRadius: "20px", border: "none", background: filterCategory === cat ? "#2563eb" : card, color: filterCategory === cat ? "white" : text, fontSize: "13px", whiteSpace: "nowrap" }}>{cat}</button>
            ))}
          </div>
        </div>
      )}

      {/* Subscriptions List */}
      {filteredSubs.length > 0 ? (
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600" }}>Your Subscriptions</h3>
            <span style={{ fontSize: "13px", color: muted }}>{filteredSubs.length}</span>
          </div>

          {filteredSubs.map((sub) => {
            const isHighCost = sub.amount >= highCostThreshold;
            const isSelected = simulatorSelected.includes(sub.id);
            return (
              <div key={sub.id} style={{ 
                backgroundColor: card,
                borderRadius: "16px",
                padding: "16px",
                marginBottom: "12px",
                border: `1px solid ${isSelected ? "#2563eb" : border}`,
                opacity: sub.reviewed ? 0.7 : 1
              }}>
                {editingId === sub.id ? (
                  <div>
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} style={{ width: "100%", padding: "11px", marginBottom: "8px", borderRadius: "10px", border: `1px solid ${border}`, background: inputBg, color: text, boxSizing: "border-box" }} />
                    <input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} style={{ width: "100%", padding: "11px", marginBottom: "8px", borderRadius: "10px", border: `1px solid ${border}`, background: inputBg, color: text, boxSizing: "border-box" }} />
                    <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} style={{ width: "100%", padding: "11px", marginBottom: "8px", borderRadius: "10px", border: `1px solid ${border}`, background: inputBg, color: text }}>
                      {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    <input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Notes" style={{ width: "100%", padding: "11px", marginBottom: "10px", borderRadius: "10px", border: `1px solid ${border}`, background: inputBg, color: text, boxSizing: "border-box" }} />
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={saveEdit} style={{ flex: 1, padding: "11px", background: "#16a34a", color: "white", border: "none", borderRadius: "10px", fontWeight: "600" }}>Save</button>
                      <button onClick={() => setEditingId(null)} style={{ flex: 1, padding: "11px", background: border, color: text, border: "none", borderRadius: "10px" }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSimulator(sub.id)}
                        style={{ marginTop: "4px", width: "18px", height: "18px" }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <div style={{ fontWeight: "600", fontSize: "16px" }}>{sub.name}</div>
                            <div style={{ fontSize: "13px", color: muted, marginTop: "3px" }}>
                              {sub.category}
                              {isHighCost && " · High"}
                              {sub.reviewed && " · Reviewed"}
                              {sub.status === "cancel" && " · Cancel"}
                              {sub.notes && ` · ${sub.notes}`}
                            </div>
                          </div>
                          <div style={{ fontWeight: "700", fontSize: "16px" }}>
                            ${(viewMode === "yearly" ? sub.amount * 12 : sub.amount).toFixed(2)}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: "7px", marginTop: "14px", flexWrap: "wrap" }}>
                          <button onClick={() => updateStatus(sub.id, "keep")} style={{ padding: "6px 12px", fontSize: "13px", backgroundColor: sub.status === "keep" ? "#16a34a" : border, color: sub.status === "keep" ? "white" : text, border: "none", borderRadius: "8px" }}>Keep</button>
                          <button onClick={() => updateStatus(sub.id, "cancel")} style={{ padding: "6px 12px", fontSize: "13px", backgroundColor: sub.status === "cancel" ? "#dc2626" : border, color: sub.status === "cancel" ? "white" : text, border: "none", borderRadius: "8px" }}>Cancel</button>
                          <button onClick={() => toggleReviewed(sub.id)} style={{ padding: "6px 12px", fontSize: "13px", backgroundColor: sub.reviewed ? "#0ea5e9" : border, color: sub.reviewed ? "white" : text, border: "none", borderRadius: "8px" }}>
                            {sub.reviewed ? "Reviewed" : "Review"}
                          </button>
                          <button onClick={() => startEdit(sub)} style={{ padding: "6px 12px", fontSize: "13px", backgroundColor: border, color: text, border: "none", borderRadius: "8px" }}>Edit</button>
                          <button onClick={() => deleteSubscription(sub.id)} style={{ padding: "6px 12px", fontSize: "13px", backgroundColor: darkMode ? "#450a0a" : "#fee2e2", color: "#ef4444", border: "none", borderRadius: "8px" }}>Delete</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ backgroundColor: card, borderRadius: "16px", padding: "48px 20px", marginBottom: "28px", textAlign: "center", color: muted, border: `1px solid ${border}` }}>
          <div style={{ fontSize: "17px", marginBottom: "8px", fontWeight: "500" }}>No subscriptions yet</div>
          <div style={{ fontSize: "14px", lineHeight: "1.5" }}>
            Upload a CSV or connect your bank to get started
          </div>
        </div>
      )}

      {/* Add Subscription */}
      <div style={{ backgroundColor: card, borderRadius: "16px", padding: "18px", marginBottom: "24px", border: `1px solid ${border}` }}>
        <h3 style={{ margin: "0 0 14px 0", fontSize: "16px", fontWeight: "600" }}>Add Subscription</h3>
        <input type="text" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ width: "100%", padding: "13px", marginBottom: "10px", borderRadius: "10px", border: `1px solid ${border}`, background: inputBg, color: text, boxSizing: "border-box" }} />
        <input type="number" placeholder="Amount" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} style={{ width: "100%", padding: "13px", marginBottom: "10px", borderRadius: "10px", border: `1px solid ${border}`, background: inputBg, color: text, boxSizing: "border-box" }} />
        <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} style={{ width: "100%", padding: "13px", marginBottom: "10px", borderRadius: "10px", border: `1px solid ${border}`, background: inputBg, color: text }}>
          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <input type="text" placeholder="Notes (optional)" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} style={{ width: "100%", padding: "13px", marginBottom: "14px", borderRadius: "10px", border: `1px solid ${border}`, background: inputBg, color: text, boxSizing: "border-box" }} />
        <button onClick={addManualSubscription} style={{ width: "100%", padding: "13px", backgroundColor: "#0f172a", color: "white", border: "none", borderRadius: "10px", fontWeight: "600", fontSize: "15px" }}>Add</button>
      </div>

      {/* Cost of Living */}
      <div style={{ backgroundColor: card, borderRadius: "16px", padding: "18px", marginBottom: "24px", border: `1px solid ${border}` }}>
        <div onClick={() => setShowCostOfLiving(!showCostOfLiving)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600" }}>Cost of Living</h3>
          <span style={{ fontSize: "14px", color: muted }}>{showCostOfLiving ? "Hide" : "Show"}</span>
        </div>

        {showCostOfLiving && (
          <div style={{ marginTop: "18px" }}>
            {["housing", "food", "transport", "utilities", "other"].map((field) => (
              <div key={field} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <label style={{ textTransform: "capitalize", fontSize: "15px" }}>{field}</label>
                <input type="number" value={costOfLiving[field]} onChange={(e) => updateCostOfLiving(field, e.target.value)} style={{ width: "110px", padding: "10px", border: `1px solid ${border}`, borderRadius: "8px", textAlign: "right", background: inputBg, color: text }} />
              </div>
            ))}
            <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: `1px solid ${border}`, display: "flex", justifyContent: "space-between", fontWeight: "600", fontSize: "15px" }}>
              <span>Total ({viewMode})</span>
              <span>${displayCOL.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ textAlign: "center", paddingBottom: "40px", fontSize: "13px", color: muted }}>
        <a href="/privacy" style={{ color: muted, marginRight: "18px" }}>Privacy</a>
        <a href="/terms" style={{ color: muted }}>Terms</a>
      </div>
    </div>
  );
}
