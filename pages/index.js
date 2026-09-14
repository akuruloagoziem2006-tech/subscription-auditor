import { useState, useEffect } from "react";

export default function Home() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [viewMode, setViewMode] = useState("monthly");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [simulatorSelected, setSimulatorSelected] = useState([]);
  const [highCostThreshold, setHighCostThreshold] = useState(15);
  const [costOfLiving, setCostOfLiving] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("subscriptions");
    const savedDark = localStorage.getItem("darkMode");
    const savedThreshold = localStorage.getItem("highCostThreshold");
    const savedCOL = localStorage.getItem("costOfLiving");

    if (saved) {
      try {
        setSubscriptions(JSON.parse(saved));
      } catch (e) {}
    }
    if (savedDark) setDarkMode(savedDark === "true");
    if (savedThreshold) setHighCostThreshold(Number(savedThreshold));
    if (savedCOL) setCostOfLiving(savedCOL);
  }, []);

  useEffect(() => {
    localStorage.setItem("subscriptions", JSON.stringify(subscriptions));
  }, [subscriptions]);

  useEffect(() => {
    localStorage.setItem("darkMode", String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem("highCostThreshold", String(highCostThreshold));
  }, [highCostThreshold]);

  useEffect(() => {
    localStorage.setItem("costOfLiving", costOfLiving);
  }, [costOfLiving]);

  function loadDemoData() {
    const demo = [
      { id: 1, name: "Netflix", amount: 15.99, category: "Entertainment", status: "keep", reviewed: false },
      { id: 2, name: "Spotify", amount: 10.99, category: "Music", status: "keep", reviewed: false },
      { id: 3, name: "Gym Membership", amount: 30.0, category: "Health", status: "cancel", reviewed: false },
      { id: 4, name: "iCloud", amount: 2.99, category: "Cloud Storage", status: "keep", reviewed: true },
      { id: 5, name: "Adobe CC", amount: 54.99, category: "Productivity", status: "cancel", reviewed: false }
    ];
    setSubscriptions(demo);
    setSimulatorSelected([]);
  }

  function addSubscription() {
    const name = prompt("Subscription name:");
    if (!name) return;
    const amount = Number(prompt("Monthly amount:") || 0);
    setSubscriptions([
      ...subscriptions,
      {
        id: Date.now(),
        name,
        amount,
        category: "Other",
        status: "keep",
        reviewed: false
      }
    ]);
  }

  function updateStatus(id, status) {
    setSubscriptions(prev =>
      prev.map(sub => (sub.id === id ? { ...sub, status } : sub))
    );
  }

  function toggleReviewed(id) {
    setSubscriptions(prev =>
      prev.map(sub => (sub.id === id ? { ...sub, reviewed: !sub.reviewed } : sub))
    );
  }

  function deleteSubscription(id) {
    if (!confirm("Delete this subscription?")) return;
    setSubscriptions(prev => prev.filter(sub => sub.id !== id));
    setSimulatorSelected(prev => prev.filter(x => x !== id));
  }

  function toggleSimulator(id) {
    setSimulatorSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
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

  const filtered = subscriptions.filter(sub => {
    const matchesSearch = sub.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ? true :
      statusFilter === "reviewed" ? sub.reviewed :
      statusFilter === "unreviewed" ? !sub.reviewed :
      sub.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const monthlyTotal = subscriptions.reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const displayTotal = viewMode === "monthly" ? monthlyTotal : monthlyTotal * 12;

  const cancelTotal = subscriptions
    .filter(s => s.status === "cancel")
    .reduce((sum, s) => sum + Number(s.amount || 0), 0);

  const simulatorTotal = subscriptions
    .filter(s => simulatorSelected.includes(s.id))
    .reduce((sum, s) => sum + Number(s.amount || 0), 0);

  const highCostCount = subscriptions.filter(s => Number(s.amount) >= highCostThreshold).length;
  const unreviewedCount = subscriptions.filter(s => !s.reviewed).length;
  const cancelCount = subscriptions.filter(s => s.status === "cancel").length;

  let forgottenScore = 0;
  if (subscriptions.length > 0) {
    const unreviewedRatio = unreviewedCount / subscriptions.length;
    const highCostRatio = highCostCount / subscriptions.length;
    const cancelRatio = cancelCount / subscriptions.length;
    forgottenScore = Math.round(unreviewedRatio * 40 + highCostRatio * 35 + cancelRatio * 25);
    if (forgottenScore > 100) forgottenScore = 100;
  }

  const bg = darkMode ? "#0b1220" : "#f8fafc";
  const card = darkMode ? "#111827" : "#ffffff";
  const text = darkMode ? "#f8fafc" : "#0f172a";
  const muted = darkMode ? "#94a3b8" : "#64748b";
  const border = darkMode ? "#1f2937" : "#e2e8f0";

  // EMPTY STATE
  if (subscriptions.length === 0) {
    return (
      <div style={{
        minHeight: "100vh",
        background: bg,
        color: text,
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: "24px 16px"
      }}>
        <div style={{ maxWidth: "680px", margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <h1 style={{ margin: 0, fontSize: "24px" }}>Subscription Auditor</h1>
            <button
              onClick={() => setDarkMode(!darkMode)}
              style={{
                padding: "8px 14px",
                borderRadius: "999px",
                border: `1px solid ${border}`,
                background: card,
                color: text,
                cursor: "pointer"
              }}
            >
              {darkMode ? "Light" : "Dark"}
            </button>
          </div>

          <div style={{
            background: card,
            border: `1px solid ${border}`,
            borderRadius: "18px",
            padding: "28px",
            textAlign: "center"
          }}>
            <h2 style={{ marginTop: 0, fontSize: "26px" }}>Find forgotten subscriptions</h2>
            <p style={{ color: muted, lineHeight: 1.6, marginBottom: "22px" }}>
              See what you’re still paying for, highlight expensive ones, and calculate how much you could save by cancelling what you don’t need.
            </p>

            <div style={{
              display: "grid",
              gap: "10px",
              marginBottom: "22px",
              textAlign: "left"
            }}>
              <Feature text="Detect recurring payments" muted={muted} textColor={text} card={card} border={border} />
              <Feature text="Get a Forgotten Money Score" muted={muted} textColor={text} card={card} border={border} />
              <Feature text="Simulate savings before you cancel" muted={muted} textColor={text} card={card} border={border} />
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={loadDemoData} style={btnPrimary}>
                Try with demo data
              </button>
              <button onClick={addSubscription} style={{
                ...btnSecondary,
                background: darkMode ? "#1e293b" : "#f1f5f9",
                color: text,
                border: `1px solid ${border}`
              }}>
                Add manually
              </button>
            </div>

            <p style={{ marginTop: "18px", color: muted, fontSize: "13px" }}>
              You can also upload a CSV later or connect a bank when ready.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // MAIN APP
  return (
    <div style={{
      minHeight: "100vh",
      background: bg,
      color: text,
      fontFamily: "system-ui, -apple-system, sans-serif",
      padding: "20px 16px"
    }}>
      <div style={{ maxWidth: "680px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
          <h1 style={{ margin: 0, fontSize: "24px" }}>Subscription Auditor</h1>
          <button
            onClick={() => setDarkMode(!darkMode)}
            style={{
              padding: "8px 14px",
              borderRadius: "999px",
              border: `1px solid ${border}`,
              background: card,
              color: text,
              cursor: "pointer"
            }}
          >
            {darkMode ? "Light" : "Dark"}
          </button>
        </div>

        {/* Summary */}
        <div style={{
          background: card,
          border: `1px solid ${border}`,
          borderRadius: "18px",
          padding: "20px",
          marginBottom: "16px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <div style={{ color: muted, fontSize: "13px" }}>{viewMode === "monthly" ? "Monthly total" : "Yearly total"}</div>
              <div style={{ fontSize: "32px", fontWeight: 700 }}>
                ${displayTotal.toFixed(2)}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: muted, fontSize: "13px" }}>Forgotten Money Score</div>
              <div style={{ fontSize: "32px", fontWeight: 700 }}>{forgottenScore}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", marginTop: "14px", flexWrap: "wrap" }}>
            <button onClick={() => setViewMode("monthly")} style={chip(viewMode === "monthly", border, card, text)}>Monthly</button>
            <button onClick={() => setViewMode("yearly")} style={chip(viewMode === "yearly", border, card, text)}>Yearly</button>
            <button onClick={addSubscription} style={btnPrimary}>Add</button>
            <button onClick={loadDemoData} style={{...btnSecondary, background: darkMode ? "#1e293b" : "#f8fafc", color: text, border: `1px solid ${border}`}}>
              Load Demo
            </button>
          </div>
        </div>

        {/* Simulator */}
        <div style={{
          background: card,
          border: `1px solid ${border}`,
          borderRadius: "18px",
          padding: "16px",
          marginBottom: "16px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
            <div>
              <strong>What if I cancel these?</strong>
              <div style={{ color: muted, fontSize: "13px", marginTop: "4px" }}>
                Selected savings: \( {simulatorTotal.toFixed(2)} / month ( \){(simulatorTotal * 12).toFixed(2)} / year)
              </div>
            </div>
            <button onClick={cancelSelected} style={btnSuccess}>Cancel Selected</button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            style={{
              flex: 1,
              minWidth: "140px",
              padding: "10px",
              borderRadius: "10px",
              border: `1px solid ${border}`,
              background: card,
              color: text
            }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: "10px",
              borderRadius: "10px",
              border: `1px solid ${border}`,
              background: card,
              color: text
            }}
          >
            <option value="all">All</option>
            <option value="keep">Keep</option>
            <option value="cancel">Cancel</option>
            <option value="reviewed">Reviewed</option>
            <option value="unreviewed">Unreviewed</option>
          </select>
        </div>

        {/* List */}
        <div style={{ display: "grid", gap: "10px" }}>
          {filtered.map(sub => {
            const highCost = Number(sub.amount) >= highCostThreshold;
            return (
              <div key={sub.id} style={{
                background: card,
                border: `1px solid ${border}`,
                borderRadius: "14px",
                padding: "14px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>
                      {sub.name}{" "}
                      {highCost && <span style={{ color: "#dc2626", fontSize: "12px" }}>High cost</span>}
                    </div>
                    <div style={{ color: muted, fontSize: "13px" }}>
                      {sub.category} • ${Number(sub.amount).toFixed(2)}/mo
                    </div>
                  </div>
                  <div style={{ fontWeight: 700 }}>${Number(sub.amount).toFixed(2)}</div>
                </div>

                <div style={{ display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
                  <button onClick={() => updateStatus(sub.id, "keep")} style={chip(sub.status === "keep", border, card, text)}>Keep</button>
                  <button onClick={() => updateStatus(sub.id, "cancel")} style={chip(sub.status === "cancel", border, card, text)}>Cancel</button>
                  <button onClick={() => toggleReviewed(sub.id)} style={chip(sub.reviewed, border, card, text)}>
                    {sub.reviewed ? "Reviewed" : "Mark reviewed"}
                  </button>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
                    <input
                      type="checkbox"
                      checked={simulatorSelected.includes(sub.id)}
                      onChange={() => toggleSimulator(sub.id)}
                    />
                    Simulate
                  </label>
                  <button onClick={() => deleteSubscription(sub.id)} style={{...btnDanger, padding: "6px 10px"}}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Insight */}
        <div style={{
          marginTop: "16px",
          background: card,
          border: `1px solid ${border}`,
          borderRadius: "14px",
          padding: "14px"
        }}>
          <strong>Personal Insight</strong>
          <p style={{ margin: "8px 0 0 0", color: muted, lineHeight: 1.5 }}>
            {cancelTotal > 0
              ? `You could free up \[ {cancelTotal.toFixed(2)}/month ( \]{(cancelTotal * 12).toFixed(2)}/year) by cancelling marked subscriptions.`
              : `You have ${unreviewedCount} unreviewed subscription(s). Review them to improve your Forgotten Money Score.`}
          </p>
        </div>
      </div>
    </div>
  );
}

function Feature({ text, muted, textColor, card, border }) {
  return (
    <div style={{
      padding: "12px 14px",
      borderRadius: "12px",
      border: `1px solid ${border}`,
      background: card,
      color: textColor
    }}>
      <span style={{ color: muted, marginRight: "8px" }}>✓</span>{text}
    </div>
  );
}

function chip(active, border, card, text) {
  return {
    padding: "7px 12px",
    borderRadius: "999px",
    border: `1px solid ${border}`,
    background: active ? "#2563eb" : card,
    color: active ? "white" : text,
    cursor: "pointer"
  };
}

const btnPrimary = {
  padding: "10px 16px",
  backgroundColor: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: "10px",
  fontWeight: "600",
  cursor: "pointer"
};

const btnSecondary = {
  padding: "10px 16px",
  borderRadius: "10px",
  fontWeight: "500",
  cursor: "pointer"
};

const btnSuccess = {
  padding: "10px 16px",
  backgroundColor: "#16a34a",
  color: "white",
  border: "none",
  borderRadius: "10px",
  fontWeight: "600",
  cursor: "pointer"
};

const btnDanger = {
  padding: "10px 16px",
  backgroundColor: "#fef2f2",
  color: "#dc2626",
  border: "none",
  borderRadius: "10px",
  cursor: "pointer"
};
