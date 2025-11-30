// driver-app.js
const { useState, useEffect } = React;

// GANTI IP INI dengan IP Termux server kalau pakai 2 HP
// contoh: const API_BASE = "http://192.168.1.7:3000";
const API_BASE = "http://localhost:3000";

function formatRupiah(n) {
  if (!n || isNaN(n)) return "Rp 0";
  return "Rp " + Number(n).toLocaleString("id-ID");
}

// STEP STATUS UNTUK DRIVER (toleran 'assigned' / 'pending')
function getDriverStep(order) {
  const type = order.serviceType || "bike";
  const s = order.status || "pending";

  const isFirstStep =
    s === "driver_on_the_way" ||
    s === "driver_to_restaurant" ||
    s === "assigned" ||
    s === "pending";

  // RIDE (bike / car)
  if (type === "bike" || type === "car") {
    if (isFirstStep) {
      return {
        label: "1/4 • Menuju lokasi customer",
        nextLabel: "Saya sudah sampai di titik jemput",
        nextStatus: "driver_arrived",
        stepText: "Driver dalam perjalanan ke lokasi penjemputan",
      };
    }

    if (s === "driver_arrived") {
      return {
        label: "2/4 • Sudah di titik jemput",
        nextLabel: "Customer sudah naik, mulai perjalanan",
        nextStatus: "on_trip",
        stepText: "Driver sudah sampai di titik penjemputan",
      };
    }

    if (s === "on_trip") {
      return {
        label: "3/4 • Perjalanan berjalan",
        nextLabel: "Perjalanan selesai, sudah sampai",
        nextStatus: "completed",
        stepText: "Driver bersama customer menuju lokasi tujuan",
      };
    }

    if (s === "completed") {
      return {
        label: "4/4 • Selesai",
        nextLabel: null,
        nextStatus: null,
        stepText: "Perjalanan selesai",
      };
    }
  }

  // FOOD
  if (type === "food") {
    if (isFirstStep) {
      return {
        label: "1/4 • Menuju resto",
        nextLabel: "Saya sudah sampai di resto",
        nextStatus: "at_restaurant",
        stepText: "Driver menuju restoran untuk mengambil pesanan",
      };
    }

    if (s === "at_restaurant") {
      return {
        label: "2/4 • Di resto / upload struk",
        nextLabel: "Pesanan sudah diambil, antar ke customer",
        nextStatus: "delivering_food",
        stepText: "Driver di restoran, sedang memproses pesanan",
      };
    }

    if (s === "delivering_food") {
      return {
        label: "3/4 • Mengantar pesanan",
        nextLabel: "Pesanan sudah sampai ke customer",
        nextStatus: "completed",
        stepText: "Driver mengantar pesanan ke alamat customer",
      };
    }

    if (s === "completed") {
      return {
        label: "4/4 • Pesanan selesai",
        nextLabel: null,
        nextStatus: null,
        stepText: "Pesanan telah diterima customer",
      };
    }
  }

  return {
    label: s,
    nextLabel: null,
    nextStatus: null,
    stepText: "Status: " + s,
  };
}

function DriverApp() {
  const [screen, setScreen] = useState("landing");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [isOnline, setIsOnline] = useState(false);

  const [openOrders, setOpenOrders] = useState([]);
  const [myOrders, setMyOrders] = useState([]);

  const [targetIncome, setTargetIncome] = useState(200000);
  const [targetInput, setTargetInput] = useState("200000");

  const [activeTab, setActiveTab] = useState("orders");

  const [driverMap, setDriverMap] = useState(null);
  const [driverMarker, setDriverMarker] = useState(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("ojekx_token");
    if (savedToken) {
      setToken(savedToken);
      fetchProfile(savedToken);
      fetchMyOrders(savedToken);
      fetchOpenOrders(savedToken);
    }
    const savedStatus = localStorage.getItem("ojekx_driver_status");
    if (savedStatus === "online") {
      setIsOnline(true);
    }

    const savedTarget = localStorage.getItem("ojekx_target_income");
    if (savedTarget) {
      const num = Number(savedTarget);
      if (!isNaN(num) && num > 0) {
        setTargetIncome(num);
        setTargetInput(String(num));
      }
    }
  }, []);

  useEffect(() => {
    if (
      screen === "dashboard" &&
      !driverMap &&
      window.L &&
      document.getElementById("driver-map")
    ) {
      const m = L.map("driver-map").setView([-6.2, 106.8], 13);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(m);

      setDriverMap(m);

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            m.setView([lat, lng], 16);
            const marker = L.marker([lat, lng]).addTo(m);
            marker.bindPopup("Posisi saya");
            setDriverMarker(marker);
          },
          (err) => {
            console.log("GPS error", err);
          }
        );
      }
    }
  }, [screen, driverMap]);

  function showMessage(type, text) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 2500);
  }

  async function fetchProfile(currentToken) {
    try {
      const usedToken = currentToken || token;
      if (!usedToken) return;
      setLoading(true);
      const res = await fetch(API_BASE + "/profile", {
        headers: { Authorization: "Bearer " + usedToken },
      });
      if (!res.ok) {
        showMessage("error", "Gagal ambil profile. Coba login ulang.");
        setProfile(null);
        return;
      }
      const data = await res.json();
      setProfile(data);
      setScreen("dashboard");
    } catch (err) {
      showMessage("error", "Error koneksi ke backend.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchMyOrders(currentToken) {
    try {
      const usedToken = currentToken || token;
      if (!usedToken) return;
      const res = await fetch(API_BASE + "/orders", {
        headers: { Authorization: "Bearer " + usedToken },
      });
      if (!res.ok) return;
      const data = await res.json();
      setMyOrders(data.orders || []);
    } catch (err) {
      console.log("fetchMyOrders error", err);
    }
  }

  async function fetchOpenOrders(currentToken) {
    try {
      const usedToken = currentToken || token;
      if (!usedToken) return;
      const res = await fetch(API_BASE + "/orders/open", {
        headers: { Authorization: "Bearer " + usedToken },
      });
      if (!res.ok) return;
      const data = await res.json();
      setOpenOrders(data.orders || []);
    } catch (err) {
      console.log("fetchOpenOrders error", err);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(API_BASE + "/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          role: "driver",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showMessage("error", data.message || "Register gagal");
        return;
      }
      showMessage("success", "Register driver berhasil, silakan login.");
      setScreen("login");
    } catch (err) {
      showMessage("error", "Error koneksi ke backend.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(API_BASE + "/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        showMessage("error", data.message || "Login gagal");
        return;
      }
      showMessage("success", "Login driver berhasil.");
      setToken(data.token);
      localStorage.setItem("ojekx_token", data.token);
      fetchProfile(data.token);
      fetchMyOrders(data.token);
      fetchOpenOrders(data.token);
    } catch (err) {
      showMessage("error", "Error koneksi ke backend.");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    setToken(null);
    setProfile(null);
    localStorage.removeItem("ojekx_token");
    setIsOnline(false);
    localStorage.setItem("ojekx_driver_status", "offline");
    setMyOrders([]);
    setOpenOrders([]);
    setScreen("landing");
    showMessage("success", "Logout driver berhasil.");
  }

  function toggleOnlineStatus() {
    const next = !isOnline;
    setIsOnline(next);
    localStorage.setItem("ojekx_driver_status", next ? "online" : "offline");
    showMessage(
      "success",
      next
        ? "Status: ONLINE (siap terima order)"
        : "Status: OFFLINE (tidak terima order)"
    );
  }

  async function handleAcceptOrder(orderId) {
    if (!token) {
      showMessage("error", "Harus login sebagai driver.");
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(API_BASE + "/orders/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showMessage("error", data.message || "Gagal ambil order");
        return;
      }
      // PASTIKAN di backend /orders/accept ubah status ke driver_on_the_way / driver_to_restaurant
      showMessage("success", "Order berhasil diambil.");
      fetchMyOrders(token);
      fetchOpenOrders(token);
    } catch (err) {
      showMessage("error", "Error koneksi saat ambil order.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateStatus(order, nextStatus) {
    if (!token) {
      showMessage("error", "Harus login sebagai driver.");
      return;
    }
    if (!nextStatus) return;

    try {
      setLoading(true);
      const res = await fetch(API_BASE + "/orders/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ orderId: order.id, status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        showMessage("error", data.message || "Gagal update status");
        return;
      }
      showMessage("success", "Status order diperbarui.");
      fetchMyOrders(token);
    } catch (e) {
      showMessage("error", "Error koneksi saat update status.");
    } finally {
      setLoading(false);
    }
  }

  function handleSaveTarget(e) {
    e.preventDefault();
    const num = Number(targetInput);
    if (isNaN(num) || num <= 0) {
      showMessage("error", "Target harus angka > 0.");
      return;
    }
    setTargetIncome(num);
    localStorage.setItem("ojekx_target_income", String(num));
    showMessage("success", "Target pendapatan disimpan.");
  }

  const totalIncome = myOrders.reduce(
    (sum, o) => sum + Number(o.feeDriver || 0),
    0
  );
  const progress =
    targetIncome > 0
      ? Math.max(
          0,
          Math.min(100, Math.round((totalIncome / targetIncome) * 100))
        )
      : 0;
  const bonusActive = totalIncome >= targetIncome;
  const bonusEstimate = Math.round(totalIncome * 0.1);

  // ==== RENDER UI ====

  function renderLanding() {
    return (
      <section className="card">
        {message && (
          <div
            className={
              "alert " +
              (message.type === "error" ? "alert-error" : "alert-success")
            }
          >
            {message.text}
          </div>
        )}

        <div className="hero-row">
          <div>
            <div className="hero-title">
              OjekX <span className="hero-highlight">Driver</span>
            </div>
            <p className="hero-sub">
              Panel khusus driver. Siap terima order, pantau pendapatan, dan
              kelola akunmu.
            </p>
          </div>
        </div>

        <div style={{ marginTop: "0.6rem" }}>
          <button
            className="btn btn-primary btn-block"
            onClick={() => setScreen("login")}
          >
            Masuk Driver
          </button>
          <button
            className="btn btn-outline btn-block"
            style={{ marginTop: "0.5rem" }}
            onClick={() => setScreen("register")}
          >
            Daftar Driver
          </button>
        </div>

        <p className="small-text" style={{ marginTop: "0.8rem" }}>
          Mode demo • cocok untuk dijadikan APK (WebView). Order berasal dari
          panel customer.
        </p>
      </section>
    );
  }

  function renderRegister() {
    return (
      <section className="card">
        {message && (
          <div
            className={
              "alert " +
              (message.type === "error" ? "alert-error" : "alert-success")
            }
          >
            {message.text}
          </div>
        )}

        <div className="hero-row">
          <div>
            <div className="hero-title" style={{ fontSize: "1.3rem" }}>
              Daftar <span className="hero-highlight">Driver</span>
            </div>
            <p className="hero-sub">
              Isi data singkat di bawah. Akun driver tersimpan di{" "}
              <code>users.json</code>.
            </p>
          </div>
        </div>

        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label>Nama Lengkap</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="contoh: Dika Pratama"
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="driver1@test.com"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="minimal 6 karakter"
            />
          </div>
          <button
            className="btn btn-primary btn-block"
            type="submit"
            disabled={loading}
          >
            {loading ? "Mendaftar..." : "Daftar Driver"}
          </button>
        </form>

        <p className="small-text" style={{ marginTop: "0.8rem" }}>
          Sudah punya akun?{" "}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setScreen("login");
            }}
          >
            Masuk di sini
          </a>
        </p>
      </section>
    );
  }

  function renderLogin() {
    return (
      <section className="card">
        {message && (
          <div
            className={
              "alert " +
              (message.type === "error" ? "alert-error" : "alert-success")
            }
          >
            {message.text}
          </div>
        )}

        <div className="hero-row">
          <div>
            <div className="hero-title" style={{ fontSize: "1.3rem" }}>
              Masuk <span className="hero-highlight">Driver</span>
            </div>
            <p className="hero-sub">
              Login untuk mulai menerima order dan melihat aktivitas.
            </p>
          </div>
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="driver1@test.com"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button
            className="btn btn-primary btn-block"
            type="submit"
            disabled={loading}
          >
            {loading ? "Masuk..." : "Masuk"}
          </button>
        </form>

        <p className="small-text" style={{ marginTop: "0.8rem" }}>
          Belum punya akun?{" "}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setScreen("register");
            }}
          >
            Daftar driver dulu
          </a>
        </p>
      </section>
    );
  }

  function renderDashboard() {
    const statusLabel = isOnline ? "ONLINE" : "OFFLINE";
    const statusColor = isOnline ? "#22c55e" : "#f97316";
    const statusBg = isOnline
      ? "rgba(34,197,94,0.18)"
      : "rgba(248,113,113,0.16)";

    return (
      <section className="card">
        {message && (
          <div
            className={
              "alert " +
              (message.type === "error" ? "alert-error" : "alert-success")
            }
          >
            {message.text}
          </div>
        )}

        <div className="hero-row">
          <div style={{ flex: 1 }}>
            <div className="hero-title" style={{ fontSize: "1.3rem" }}>
              Halo,{" "}
              <span className="hero-highlight">
                {profile ? profile.name : "Driver"}
              </span>
            </div>
            <p className="hero-sub" style={{ marginBottom: 0 }}>
              Tampilan utama fokus untuk menerima dan memantau order.
            </p>
          </div>
          <div className="avatar-wrapper">
            <div className="avatar-placeholder">
              {profile && profile.name
                ? profile.name
                    .split(" ")
                    .slice(0, 2)
                    .map((n) => n[0]?.toUpperCase())
                    .join("")
                : "DX"}
            </div>
          </div>
        </div>

        <div className="tab-row">
          <button
            type="button"
            className={"tab-pill " + (activeTab === "orders" ? "active" : "")}
            onClick={() => setActiveTab("orders")}
          >
            <span className="tab-dot" />
            <span>Order</span>
          </button>
          <button
            type="button"
            className={"tab-pill " + (activeTab === "income" ? "active" : "")}
            onClick={() => setActiveTab("income")}
          >
            <span>Rp</span>
            <span>Pendapatan</span>
          </button>
          <button
            type="button"
            className={"tab-pill " + (activeTab === "profile" ? "active" : "")}
            onClick={() => setActiveTab("profile")}
          >
            <span>👤</span>
            <span>Profil</span>
          </button>
        </div>

        {/* TAB ORDER */}
        {activeTab === "orders" && (
          <>
            {/* Status driver */}
            <div style={{ marginBottom: "0.8rem" }}>
              <div className="section-title">Status driver</div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  marginTop: "0.45rem",
                  flexWrap: "wrap",
                }}
              >
                <div
                  className="status-pill"
                  style={{
                    background: statusBg,
                    borderColor: statusColor,
                    color: statusColor,
                  }}
                >
                  <span
                    className="status-dot"
                    style={{
                      background: statusColor,
                      boxShadow: `0 0 8px ${statusColor}`,
                    }}
                  />
                  <span>{statusLabel}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ minWidth: "130px" }}
                  onClick={toggleOnlineStatus}
                >
                  {isOnline ? "Set Offline" : "Mulai Online"}
                </button>
              </div>
            </div>

            {/* Map driver */}
            <div style={{ marginBottom: "0.9rem" }}>
              <div className="section-title">Posisi saya</div>
              <div id="driver-map"></div>
              <p className="small-text" style={{ marginTop: "0.35rem" }}>
                Izinkan akses lokasi di browser supaya titik driver tampil di peta.
              </p>
            </div>

            {/* Order tersedia */}
            <div style={{ marginBottom: "0.9rem" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "0.35rem",
                }}
              >
                <div className="section-title">Order tersedia</div>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{
                    padding: "0.3rem 0.7rem",
                    fontSize: "0.75rem",
                  }}
                  onClick={() => {
                    fetchOpenOrders();
                    fetchMyOrders();
                    showMessage("success", "Order diperbarui.");
                  }}
                >
                  Refresh
                </button>
              </div>

              {openOrders.length === 0 ? (
                <p className="small-text">
                  Belum ada order pending. Buat order dari panel customer lalu
                  tekan <b>Refresh</b>.
                </p>
              ) : (
                <div className="orders-list">
                  {openOrders
                    .slice()
                    .reverse()
                    .map((order) => {
                      const jenis = order.serviceType || "bike";
                      const tarif = formatRupiah(order.price || 0);
                      const feeDriver = formatRupiah(order.feeDriver || 0);
                      const feeOwner = formatRupiah(order.feeOwner || 0);

                      return (
                        <div key={order.id} className="order-card">
                          <div className="order-title">
                            [{jenis.toUpperCase()}] {order.pickup} →{" "}
                            {order.destination}
                          </div>
                          <div className="order-meta">
                            Customer: {order.customerEmail}
                            <br />
                            {new Date(order.createdAt).toLocaleString("id-ID", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                          <div className="order-price">
                            Tarif: <b>{tarif}</b> • Fee driver:{" "}
                            <b>{feeDriver}</b>
                            <br />
                            <span style={{ opacity: 0.7 }}>
                              Fee aplikator: {feeOwner}
                            </span>
                          </div>
                          <button
                            className="btn btn-primary btn-block"
                            style={{ marginTop: "0.35rem" }}
                            onClick={() => handleAcceptOrder(order.id)}
                            disabled={loading}
                          >
                            Ambil Order
                          </button>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Order saya */}
            <div style={{ marginBottom: "0.5rem" }}>
              <div className="section-title">Order saya</div>
              {myOrders.length === 0 ? (
                <p className="small-text">
                  Belum ada order yang kamu ambil.
                </p>
              ) : (
                <div className="orders-list">
                  {myOrders
                    .slice()
                    .reverse()
                    .map((order) => {
                      const jenis = order.serviceType || "bike";
                      const tarif = formatRupiah(order.price || 0);
                      const feeDriver = formatRupiah(order.feeDriver || 0);
                      const feeOwner = formatRupiah(order.feeOwner || 0);
                      const stepInfo = getDriverStep(order);

                      return (
                        <div key={order.id} className="order-card">
                          <div className="order-title">
                            [{jenis.toUpperCase()}] {order.pickup} →{" "}
                            {order.destination}
                          </div>
                          <div className="order-meta">
                            Status: {stepInfo.label}
                            <br />
                            Customer: {order.customerEmail}
                            <br />
                            Dibuat:{" "}
                            {new Date(order.createdAt).toLocaleString("id-ID", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                          <div className="order-price">
                            Tarif: <b>{tarif}</b> • Fee driver:{" "}
                            <b>{feeDriver}</b>
                            <br />
                            <span style={{ opacity: 0.7 }}>
                              Fee aplikator: {feeOwner}
                            </span>
                          </div>
                          <p
                            className="small-text"
                            style={{ marginTop: "0.25rem" }}
                          >
                            {stepInfo.stepText}
                          </p>

                          {stepInfo.nextStatus ? (
                            <button
                              className="btn btn-primary btn-block"
                              style={{ marginTop: "0.4rem" }}
                              disabled={loading}
                              onClick={() =>
                                handleUpdateStatus(order, stepInfo.nextStatus)
                              }
                            >
                              {stepInfo.nextLabel}
                            </button>
                          ) : (
                            <p
                              className="small-text"
                              style={{
                                marginTop: "0.35rem",
                                color: "#bbf7d0",
                              }}
                            >
                              Order sudah selesai.
                            </p>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </>
        )}

        {/* TAB PENDAPATAN */}
        {activeTab === "income" && (
          <div style={{ marginTop: "0.3rem" }}>
            <div className="section-title">Pendapatan & target</div>
            <div
              style={{
                marginTop: "0.45rem",
                padding: "0.65rem 0.7rem",
                borderRadius: 12,
                border: "1px solid rgba(55,65,81,0.9)",
                background:
                  "radial-gradient(circle at top, #020617 0, #020617 65%)",
                fontSize: "0.8rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "0.7rem",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.72rem", color: "#9ca3af" }}>
                    Pendapatan total (fee driver)
                  </div>
                  <div
                    style={{
                      fontSize: "0.98rem",
                      fontWeight: 700,
                      marginTop: "0.1rem",
                    }}
                  >
                    {formatRupiah(totalIncome)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.72rem", color: "#9ca3af" }}>
                    Target kamu
                  </div>
                  <div
                    style={{
                      fontSize: "0.98rem",
                      fontWeight: 700,
                      marginTop: "0.1rem",
                    }}
                  >
                    {formatRupiah(targetIncome)}
                  </div>
                </div>
              </div>

              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: progress + "%" }}
                />
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "#9ca3af",
                  marginTop: "0.2rem",
                }}
              >
                Progress: <b>{progress}%</b>{" "}
                {bonusActive && (
                  <span style={{ color: "#bbf7d0" }}>
                    • Target tercapai! Bonus estimasi{" "}
                    {formatRupiah(bonusEstimate)}
                  </span>
                )}
              </div>

              <form
                onSubmit={handleSaveTarget}
                style={{
                  marginTop: "0.45rem",
                  display: "flex",
                  gap: "0.35rem",
                  flexWrap: "wrap",
                }}
              >
                <input
                  type="number"
                  min="0"
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  placeholder="Target (contoh: 200000)"
                  style={{
                    flex: 1,
                    minWidth: "130px",
                    background: "#020617",
                  }}
                />
                <button
                  type="submit"
                  className="btn btn-outline"
                  style={{ paddingInline: "0.8rem" }}
                >
                  Simpan target
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB PROFIL */}
        {activeTab === "profile" && (
          <div style={{ marginTop: "0.3rem" }}>
            <div className="section-title">Profil driver</div>
            <div
              style={{
                marginTop: "0.45rem",
                display: "flex",
                gap: "0.8rem",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div className="avatar-wrapper">
                <div className="avatar-placeholder">
                  {profile && profile.name
                    ? profile.name
                        .split(" ")
                        .slice(0, 2)
                        .map((n) => n[0]?.toUpperCase())
                        .join("")
                    : "DX"}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: "150px" }}>
                <p className="small-text">
                  Nama: <b>{profile ? profile.name : "-"}</b>
                  <br />
                  Email: <b>{profile ? profile.email : "-"}</b>
                  <br />
                  Role: <b>{profile ? profile.role : "-"}</b>
                </p>
              </div>
            </div>

            <div style={{ marginTop: "0.9rem" }}>
              <button
                className="btn btn-outline btn-block"
                onClick={handleLogout}
              >
                Logout driver
              </button>
            </div>
          </div>
        )}
      </section>
    );
  }

  if (screen === "landing") return renderLanding();
  if (screen === "register") return renderRegister();
  if (screen === "login") return renderLogin();
  return renderDashboard();
}

function AppShell() {
  return (
    <div className="app-root">
      <div className="app-shell">
        <header className="app-header">
          <div>
            <div className="app-title">OjekX • Driver</div>
            <div className="app-subtitle">
              UI mobile • siap dibungkus jadi APK
            </div>
          </div>
          <div className="logo-dot">DX</div>
        </header>

        <main className="main-area">
          <DriverApp />
        </main>

        <footer>© 2025 OjekX • Driver App</footer>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<AppShell />);
