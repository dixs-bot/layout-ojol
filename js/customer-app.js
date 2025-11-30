// customer-app.js
const { useState, useEffect } = React;

// GANTI jika pakai 2 HP:
// contoh: const API_BASE = "http://192.168.1.7:3000";
const API_BASE = "http://localhost:3000";
const STORAGE_KEY = "ojekx_token_customer";

function formatRupiah(n) {
  if (!n || isNaN(n)) return "Rp 0";
  return "Rp " + Number(n).toLocaleString("id-ID");
}

// STATUS STEP UNTUK CUSTOMER (sinkron sama driver)
function getCustomerStatusText(order) {
  const type = order.serviceType || "bike";
  const s = order.status || "pending";

  if (s === "pending") {
    return "Menunggu driver mengambil order";
  }

  if (s === "assigned") {
    return "Driver sudah menerima order, bersiap menuju lokasi";
  }

  if (type === "bike" || type === "car") {
    if (s === "driver_on_the_way")
      return "Driver menuju lokasi penjemputan";
    if (s === "driver_arrived")
      return "Driver sudah sampai di titik jemput";
    if (s === "on_trip")
      return "Sedang dalam perjalanan ke tujuan";
    if (s === "completed")
      return "Perjalanan selesai";
  }

  if (type === "food") {
    if (s === "driver_to_restaurant") return "Driver menuju restoran";
    if (s === "at_restaurant")
      return "Driver di restoran / memproses pesanan";
    if (s === "delivering_food")
      return "Pesanan sedang diantar ke alamat kamu";
    if (s === "completed") return "Pesanan selesai";
  }

  return "Status: " + s;
}

function CustomerApp() {
  const [screen, setScreen] = useState("landing");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(null);
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const [activeTab, setActiveTab] = useState("order");
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [serviceType, setServiceType] = useState("bike");
  const [orders, setOrders] = useState([]);

  const [customerMap, setCustomerMap] = useState(null);
  const [customerMarker, setCustomerMarker] = useState(null);

  useEffect(() => {
    const savedToken = localStorage.getItem(STORAGE_KEY);
    if (savedToken) {
      setToken(savedToken);
      fetchProfile(savedToken);
      fetchOrders(savedToken);
    }
  }, []);

  useEffect(() => {
    if (
      screen === "dashboard" &&
      !customerMap &&
      window.L &&
      document.getElementById("customer-map")
    ) {
      const m = L.map("customer-map").setView([-6.2, 106.8], 13);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(m);

      setCustomerMap(m);

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            m.setView([lat, lng], 16);
            const marker = L.marker([lat, lng]).addTo(m);
            marker.bindPopup("Posisi kamu di sini");
            setCustomerMarker(marker);
          },
          (err) => {
            console.log("GPS error", err);
          }
        );
      }
    }
  }, [screen, customerMap]);

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
        showMessage("error", "Gagal ambil profil. Silakan login ulang.");
        setProfile(null);
        return;
      }
      const data = await res.json();
      setProfile(data);
      setScreen("dashboard");
    } catch (e) {
      showMessage("error", "Error koneksi ke backend.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchOrders(currentToken) {
    try {
      const usedToken = currentToken || token;
      if (!usedToken) return;
      const res = await fetch(API_BASE + "/orders", {
        headers: { Authorization: "Bearer " + usedToken },
      });
      if (!res.ok) return;
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (e) {
      console.log("fetchOrders error", e);
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
          role: "customer",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showMessage("error", data.message || "Register gagal");
        return;
      }
      showMessage("success", "Register customer berhasil, silakan login.");
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
      showMessage("success", "Login customer berhasil.");
      setToken(data.token);
      localStorage.setItem(STORAGE_KEY, data.token);
      fetchProfile(data.token);
      fetchOrders(data.token);
    } catch (err) {
      showMessage("error", "Error koneksi ke backend.");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    setToken(null);
    setProfile(null);
    localStorage.removeItem(STORAGE_KEY);
    setScreen("landing");
    setOrders([]);
    showMessage("success", "Logout berhasil.");
  }

  async function handleCreateOrder(e) {
    e.preventDefault();
    if (!token) {
      showMessage("error", "Harus login sebagai customer.");
      return;
    }
    if (!pickup.trim() || !destination.trim()) {
      showMessage("error", "Isi lokasi jemput & tujuan.");
      return;
    }

    const base = { bike: 10000, car: 20000, food: 15000 };
    const price = base[serviceType] || 10000;

    try {
      setLoading(true);
      const res = await fetch(API_BASE + "/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          pickup: pickup.trim(),
          destination: destination.trim(),
          serviceType,
          price,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showMessage("error", data.message || "Gagal membuat order");
        return;
      }
      showMessage("success", "Order dibuat.");
      setPickup("");
      setDestination("");
      fetchOrders(token);
      setActiveTab("history");
    } catch (err) {
      showMessage("error", "Error koneksi saat membuat order.");
    } finally {
      setLoading(false);
    }
  }

  const estimatePrice = (() => {
    const base = { bike: 10000, car: 20000, food: 15000 };
    return base[serviceType] || 10000;
  })();

  // ====== RENDER UI ======

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
              OjekX <span className="hero-highlight">Customer</span>
            </div>
            <p className="hero-sub">
              Pesan ojek, mobil, atau makanan dengan tampilan simpel seperti
              aplikasi asli.
            </p>
          </div>
        </div>
        <div style={{ marginTop: "0.6rem" }}>
          <button
            className="btn btn-primary btn-block"
            onClick={() => setScreen("login")}
          >
            Masuk Customer
          </button>
          <button
            className="btn btn-outline btn-block"
            style={{ marginTop: "0.5rem" }}
            onClick={() => setScreen("register")}
          >
            Daftar Customer
          </button>
        </div>
        <p className="small-text" style={{ marginTop: "0.8rem" }}>
          Mode demo • backend Ruby di <code>http://localhost:3000</code>
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
              Daftar <span className="hero-highlight">Customer</span>
            </div>
            <p className="hero-sub">
              Akun customer akan tersimpan di <code>users.json</code> dengan
              role <b>customer</b>.
            </p>
          </div>
        </div>
        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label>Nama Lengkap</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="contoh: Rani Pratiwi"
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer1@test.com"
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
            {loading ? "Mendaftar..." : "Daftar Customer"}
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
              Masuk <span className="hero-highlight">Customer</span>
            </div>
            <p className="hero-sub">
              Login untuk membuat order dan melihat riwayat perjalanan.
            </p>
          </div>
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer1@test.com"
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
            Daftar dulu
          </a>
        </p>
      </section>
    );
  }

  function renderDashboard() {
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
              Hai,{" "}
              <span className="hero-highlight">
                {profile ? profile.name : "Customer"}
              </span>
            </div>
            <p className="hero-sub" style={{ marginBottom: 0 }}>
              Pesan perjalanan atau makanan dari satu panel.
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
                : "CX"}
            </div>
          </div>
        </div>

        <div className="tab-row">
          <button
            type="button"
            className={"tab-pill " + (activeTab === "order" ? "active" : "")}
            onClick={() => setActiveTab("order")}
          >
            <span>🛵</span>
            <span>Pesan</span>
          </button>
          <button
            type="button"
            className={"tab-pill " + (activeTab === "history" ? "active" : "")}
            onClick={() => setActiveTab("history")}
          >
            <span>📜</span>
            <span>Riwayat</span>
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

        {/* TAB PESAN */}
        {activeTab === "order" && (
          <div style={{ marginTop: "0.4rem" }}>
            <div className="section-title">Buat order</div>

            <div id="customer-map"></div>
            <p className="small-text" style={{ marginTop: "0.35rem" }}>
              Titik ini menunjukkan perkiraan posisi kamu. Aktifkan GPS dan
              izinkan akses lokasi di browser.
            </p>

            <form onSubmit={handleCreateOrder} style={{ marginTop: "0.5rem" }}>
              <div className="form-group">
                <label>Lokasi jemput</label>
                <input
                  value={pickup}
                  onChange={(e) => setPickup(e.target.value)}
                  placeholder="contoh: Rumah, Jl. Mawar No. 10"
                />
              </div>
              <div className="form-group">
                <label>Tujuan</label>
                <input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="contoh: Mall Central, Lobby Utama"
                />
              </div>
              <div className="form-group">
                <label>Layanan</label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                >
                  <option value="bike">Ojek Motor</option>
                  <option value="car">Mobil</option>
                  <option value="food">Food Delivery</option>
                </select>
              </div>

              <p className="small-text">
                Perkiraan tarif: <b>{formatRupiah(estimatePrice)}</b>
                <br />
                (Tarif ini demo tetap, belum pakai jarak realtime.)
              </p>

              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={loading}
              >
                {loading ? "Mengirim..." : "Buat Order"}
              </button>
            </form>
          </div>
        )}

        {/* TAB RIWAYAT */}
        {activeTab === "history" && (
          <div style={{ marginTop: "0.4rem" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "0.35rem",
              }}
            >
              <div className="section-title">Order saya</div>
              <button
                type="button"
                className="btn btn-outline"
                style={{ padding: "0.3rem 0.7rem", fontSize: "0.75rem" }}
                onClick={() => {
                  fetchOrders();
                  showMessage("success", "Riwayat diperbarui.");
                }}
              >
                Refresh
              </button>
            </div>

            {orders.length === 0 ? (
              <p className="small-text">
                Belum ada order. Coba buat order di tab <b>Pesan</b>.
              </p>
            ) : (
              <div className="orders-list">
                {orders
                  .slice()
                  .reverse()
                  .map((o) => (
                    <div key={o.id} className="order-card">
                      <div className="order-title">
                        {o.pickup} → {o.destination}
                      </div>
                      <div className="order-meta">
                        {o.serviceType.toUpperCase()} •{" "}
                        {new Date(o.createdAt).toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        <br />
                        Status: {getCustomerStatusText(o)}
                      </div>
                      <div
                        style={{
                          marginTop: "0.18rem",
                          fontSize: "0.76rem",
                          color: "#bae6fd",
                        }}
                      >
                        Tarif: <b>{formatRupiah(o.price || 0)}</b>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* TAB PROFIL */}
        {activeTab === "profile" && (
          <div style={{ marginTop: "0.4rem" }}>
            <div className="section-title">Profil customer</div>
            <p className="small-text" style={{ marginTop: "0.5rem" }}>
              Nama: <b>{profile ? profile.name : "-"}</b>
              <br />
              Email: <b>{profile ? profile.email : "-"}</b>
              <br />
              Role: <b>{profile ? profile.role : "-"}</b>
            </p>
            <button
              className="btn btn-outline btn-block"
              style={{ marginTop: "0.7rem" }}
              onClick={handleLogout}
            >
              Logout
            </button>
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
            <div className="app-title">OjekX • Customer</div>
            <div className="app-subtitle">
              UI mobile • mirip driver, siap jadi APK
            </div>
          </div>
          <div className="logo-dot">CX</div>
        </header>
        <main className="main-area">
          <CustomerApp />
        </main>
        <footer>© 2025 OjekX • Customer App</footer>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<AppShell />);
