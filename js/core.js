// js/core.js
// Helper inti OjekX, dipakai oleh driver, customer, merchant, owner.
// Jangan pakai import/export, cukup tempel ke window biar gampang dipanggil dari HTML.

(function (window) {
  const API_BASE = "http://localhost:3000"; // ganti kalau backend jalan di IP lain

  // Key token per role
  const STORAGE_KEYS = {
    driver: "ojekx_token_driver",
    customer: "ojekx_token_customer",
    merchant: "ojekx_token_merchant",
    owner: "ojekx_token_owner",
  };

  function formatRupiah(n) {
    if (!n || isNaN(n)) return "Rp 0";
    return "Rp " + Number(n).toLocaleString("id-ID");
  }

  function saveToken(role, token) {
    const key = STORAGE_KEYS[role];
    if (!key) return;
    try {
      localStorage.setItem(key, token);
    } catch (e) {
      console.warn("Gagal menyimpan token:", e);
    }
  }

  function loadToken(role) {
    const key = STORAGE_KEYS[role];
    if (!key) return null;
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn("Gagal membaca token:", e);
      return null;
    }
  }

  function clearToken(role) {
    const key = STORAGE_KEYS[role];
    if (!key) return;
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn("Gagal menghapus token:", e);
    }
  }

  /**
   * Pemanggil API generik.
   * Contoh:
   *   api("/login", { method: "POST", body: { email, password } })
   *   api("/orders", { token: driverToken })
   */
  async function api(path, options = {}) {
    const {
      method = "GET",
      body = null,
      token = null,
      raw = false, // kalau mau balikin text mentah
    } = options;

    const headers = {};

    if (body) {
      headers["Content-Type"] = "application/json";
    }
    if (token) {
      headers["Authorization"] = "Bearer " + token;
    }

    const res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (e) {
      // kalau bukan JSON, ya sudah biarin text
      data = text;
    }

    if (!res.ok) {
      const msg =
        data && typeof data === "object" && data.message
          ? data.message
          : text || "Request gagal";
      const err = new Error(msg);
      err.status = res.status;
      err.raw = data;
      throw err;
    }

    // kalau caller minta raw, balikin text / apa adanya
    if (raw) return text;
    return data;
  }

  // Export ke global
  window.OjekXCore = {
    API_BASE,
    STORAGE_KEYS,
    formatRupiah,
    api,
    saveToken,
    loadToken,
    clearToken,
  };
})(window);
