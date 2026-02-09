function qs(selector, parent) {
  return (parent || document).querySelector(selector);
}

function qsa(selector, parent) {
  return Array.from((parent || document).querySelectorAll(selector));
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--:--:--";
  }
  return date.toLocaleTimeString("en-US", { hour12: false });
}

async function jsonRequest(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Request failed");
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

function initDashboard() {
  const searchInput = qs("#stream-search");
  const filterButtons = qsa("#category-filters .chip");
  const cards = qsa(".stream-card");

  const applyFilters = () => {
    const search = (searchInput.value || "").toLowerCase();
    const activeFilter = qs("#category-filters .chip.active").dataset.category;
    cards.forEach((card) => {
      const name = card.dataset.name || "";
      const description = card.dataset.description || "";
      const category = card.dataset.category || "";
      const matchSearch = name.includes(search) || description.includes(search);
      const matchFilter = activeFilter === "All" || category === activeFilter;
      card.style.display = matchSearch && matchFilter ? "" : "none";
    });
  };

  if (searchInput) {
    searchInput.addEventListener("input", applyFilters);
  }

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      filterButtons.forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      applyFilters();
    });
  });

  const form = qs("#create-stream-form");
  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      ["latitude", "longitude"].forEach((key) => {
        if (data[key] === "") {
          delete data[key];
        } else if (data[key]) {
          data[key] = Number(data[key]);
        }
      });
      if (!data.category) {
        data.category = "Police";
      }
      await jsonRequest("/api/streams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      window.location.reload();
    });
  }
}

async function toggleStream(button) {
  const streamId = button.dataset.id;
  const current = button.dataset.status || "inactive";
  const next = current === "active" ? "inactive" : "active";
  await jsonRequest(`/api/streams/${streamId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: next }),
  });
  window.location.reload();
}

async function deleteStream(button) {
  const streamId = button.dataset.id;
  await jsonRequest(`/api/streams/${streamId}`, { method: "DELETE" });
  window.location.href = "/";
}

function attachStreamActions() {
  qsa(".js-toggle").forEach((button) => {
    button.addEventListener("click", () => toggleStream(button));
  });

  qsa(".js-delete").forEach((button) => {
    button.addEventListener("click", () => {
      const ok = window.confirm("Delete this stream and its history?");
      if (ok) {
        deleteStream(button);
      }
    });
  });
}

function initStreamDetail() {
  const streamId = qs(".stream-hero").dataset.streamId;
  const log = qs("#transcription-log");
  const emptyState = qs(".log-empty");

  const renderEntry = (entry, prepend) => {
    if (emptyState) {
      emptyState.remove();
    }
    const row = document.createElement("div");
    row.className = "log-entry";
    row.innerHTML = `<time>${formatTime(entry.timestamp)}</time><div>${entry.content}</div>`;
    if (prepend) {
      log.prepend(row);
    } else {
      log.appendChild(row);
      log.scrollTop = log.scrollHeight;
    }
  };

  jsonRequest(`/api/streams/${streamId}/transcriptions?limit=100`).then((items) => {
    const ordered = items.slice().reverse();
    ordered.forEach((entry) => renderEntry(entry, false));
  });

  const socketUrl = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
  const socket = new WebSocket(socketUrl);
  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === "transcription" && message.payload.streamId == streamId) {
        renderEntry(message.payload, false);
      }
    } catch (err) {
      console.warn("ws parse error", err);
    }
  };
}

function initMap() {
  if (!window.L) {
    return;
  }
  const map = L.map("map").setView([39.8283, -98.5795], 4);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; CARTO",
  }).addTo(map);

  const colors = {
    Fire: "#ef4444",
    Medical: "#3b82f6",
    Crime: "#f59e0b",
    Traffic: "#22c55e",
    Emergency: "#dc2626",
    Dispatch: "#6366f1",
    Weather: "#8b5cf6",
    default: "#6cf6ff",
  };

  const markers = L.layerGroup().addTo(map);
  const legend = qs("#legend-items");
  const filterWrap = qs("#calltype-filters");

  const renderLegend = (types) => {
    legend.innerHTML = "";
    types.forEach((type) => {
      const color = colors[type] || colors.default;
      const row = document.createElement("div");
      row.className = "legend-item";
      row.innerHTML = `<span class="legend-dot" style="background:${color}"></span>${type}`;
      legend.appendChild(row);
    });
  };

  const renderFilters = (types) => {
    filterWrap.innerHTML = "";
    ["All", ...types].forEach((type, idx) => {
      const button = document.createElement("button");
      button.className = `chip${idx === 0 ? " active" : ""}`;
      button.dataset.calltype = type;
      button.textContent = type;
      button.addEventListener("click", () => {
        qsa("#calltype-filters .chip").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        refreshMarkers();
      });
      filterWrap.appendChild(button);
    });
  };

  let cachedTranscriptions = [];
  let cachedStreams = [];

  const refreshMarkers = () => {
    const active = qs("#calltype-filters .chip.active");
    const filter = active ? active.dataset.calltype : "All";
    markers.clearLayers();
    cachedTranscriptions.forEach((item) => {
      if (filter !== "All" && item.call_type !== filter) {
        return;
      }
      if (item.latitude == null || item.longitude == null) {
        return;
      }
      const type = item.call_type || "default";
      const color = colors[type] || colors.default;
      const icon = L.divIcon({
        className: "marker",
        html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid #fff;"></div>`,
      });
      const stream = cachedStreams.find((s) => s.id === item.stream_id);
      const popup = `
        <strong>${stream ? stream.name : "Stream " + item.stream_id}</strong><br />
        ${item.content}<br />
        <small>${formatTime(item.timestamp)}</small>
      `;
      L.marker([item.latitude, item.longitude], { icon }).bindPopup(popup).addTo(markers);
    });
  };

  const fetchData = async () => {
    cachedTranscriptions = await jsonRequest("/api/transcriptions?withLocation=true&limit=200");
    cachedStreams = await jsonRequest("/api/streams");
    const types = Array.from(
      new Set(cachedTranscriptions.map((item) => item.call_type).filter(Boolean))
    );
    renderLegend(types);
    renderFilters(types);
    refreshMarkers();
  };

  fetchData();
  setInterval(fetchData, 8000);
}

document.addEventListener("DOMContentLoaded", () => {
  attachStreamActions();
  const page = document.body.dataset.page;
  if (page === "dashboard") {
    initDashboard();
  }
  if (page === "stream") {
    initStreamDetail();
  }
  if (page === "map") {
    initMap();
  }
});
