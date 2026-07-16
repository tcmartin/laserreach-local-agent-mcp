import { URL } from "node:url";

import { requireLaserreachEnv } from "./config.js";

function normalizePath(path) {
  const raw = String(path || "").trim();
  if (!raw) throw new Error("path is required");
  if (/^https?:\/\//i.test(raw)) return raw;
  return raw.startsWith("/") ? raw : `/${raw}`;
}

export class LaserreachClient {
  constructor(options = {}) {
    const env = options.token && options.orgId ? options : requireLaserreachEnv(options.env || process.env);
    this.apiBase = String(options.apiBase || env.apiBase || "https://api.laserreach.com").replace(/\/+$/, "");
    this.orgId = String(options.orgId || env.orgId || "").trim();
    this.token = String(options.token || env.token || "").trim();
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
    if (!this.fetchImpl) throw new Error("global fetch is required; use Node.js 20+");
  }

  buildUrl(path, query = undefined) {
    const normalized = normalizePath(path);
    const url = new URL(/^https?:\/\//i.test(normalized) ? normalized : `${this.apiBase}${normalized}`);
    for (const [key, value] of Object.entries(query || {})) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
    return url;
  }

  async request({ method = "GET", path, query, body, headers } = {}) {
    const cleanMethod = String(method || "GET").toUpperCase();
    const url = this.buildUrl(path, query);
    const requestHeaders = {
      Authorization: `Bearer ${this.token}`,
      "X-Org-ID": this.orgId,
      Accept: "application/json",
      ...(headers || {}),
    };
    const init = { method: cleanMethod, headers: requestHeaders };
    if (body !== undefined && body !== null && cleanMethod !== "GET" && cleanMethod !== "HEAD") {
      requestHeaders["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    const response = await this.fetchImpl(url, init);
    const text = await response.text();
    let data = text;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = text;
    }
    if (!response.ok) {
      const err = new Error(`Laserreach API request failed: ${response.status}`);
      err.status = response.status;
      err.body = data;
      err.path = url.toString();
      throw err;
    }
    return data;
  }

  capabilities() {
    return this.request({ method: "GET", path: "/api/abm/agent/capabilities" });
  }

  listSources(query = {}) {
    return this.request({ method: "GET", path: "/api/abm/sources", query });
  }

  collectSource(sourceId, body = {}) {
    return this.request({ method: "POST", path: `/api/abm/sources/${encodeURIComponent(sourceId)}/collect`, body });
  }

  listSignals(query = {}) {
    return this.request({ method: "GET", path: "/api/abm/signals", query });
  }

  scorePendingSignals(body = {}) {
    return this.request({ method: "POST", path: "/api/abm/signals/score-pending", body });
  }

  processSignals(body = {}) {
    return this.request({ method: "POST", path: "/api/abm/process/signals", body });
  }

  approveSignal(signalId, body = {}) {
    return this.request({ method: "POST", path: `/api/abm/signals/${encodeURIComponent(signalId)}/approve`, body });
  }

  dismissSignal(signalId, body = {}) {
    return this.request({ method: "POST", path: `/api/abm/signals/${encodeURIComponent(signalId)}/dismiss`, body });
  }

  listTargets(kind = "companies", query = {}) {
    const cleanKind = kind === "people" ? "people" : "companies";
    return this.request({ method: "GET", path: `/api/abm/${cleanKind}`, query });
  }

  listSenders(kind = "all", query = {}) {
    if (kind === "linkedin") return this.request({ method: "GET", path: "/api/abm/linkedin-accounts", query });
    if (kind === "email") return this.request({ method: "GET", path: "/api/abm/email-senders", query });
    return Promise.all([
      this.request({ method: "GET", path: "/api/abm/linkedin-accounts", query }),
      this.request({ method: "GET", path: "/api/abm/email-senders", query }),
    ]).then(([linkedin, email]) => ({ linkedin, email }));
  }

  prepareMessages(body = {}) {
    return this.request({ method: "POST", path: "/api/abm/sequences/prepare-messages", body });
  }

  syncHubspotOutreach(body = {}) {
    return this.request({ method: "POST", path: "/api/abm/crm/hubspot/outreach-sync", body });
  }
}
