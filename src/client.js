import { URL } from "node:url";

import { requireLaserreachEnv } from "./config.js";

function normalizePath(path) {
  const raw = String(path || "").trim();
  if (!raw) throw new Error("path is required");
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) || raw.startsWith("//")) {
    throw new Error("path must be relative to LASERREACH_API_BASE");
  }
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
    const url = new URL(`${this.apiBase}${normalized}`);
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

  siteTools({ includeInstructions = false } = {}) {
    return this.request({
      method: "GET",
      path: "/api/abm/agent/tools",
      query: { include_instructions: includeInstructions ? "true" : "false" },
    });
  }

  invokeSiteTool(toolName, args = {}) {
    return this.request({
      method: "POST",
      path: `/api/abm/agent/tools/${encodeURIComponent(toolName)}/invoke`,
      body: { arguments: args },
    });
  }

  listSources(query = {}) {
    return this.request({ method: "GET", path: "/api/abm/sources", query });
  }

  collectSource(sourceId, body = {}) {
    return this.request({
      method: "POST",
      path: `/api/abm/sources/${encodeURIComponent(sourceId)}/collect`,
      body: { ...body, processing_mode: "local" },
    });
  }

  listSignals(query = {}) {
    return this.request({ method: "GET", path: "/api/abm/signals", query });
  }

  assessSignal(signalId, body = {}) {
    return this.request({
      method: "PATCH",
      path: `/api/abm/signals/${encodeURIComponent(signalId)}/assessment`,
      body,
    });
  }

  resolveSignalContact(signalId, personId) {
    return this.request({
      method: "PATCH",
      path: `/api/abm/signals/${encodeURIComponent(signalId)}/contact`,
      body: { person_id: personId },
    });
  }

  listIcps(query = {}) {
    return this.request({ method: "GET", path: "/api/abm/icps", query });
  }

  createIcp(body = {}) {
    return this.request({ method: "POST", path: "/api/abm/icps", body });
  }

  updateIcp(icpId, body = {}) {
    return this.request({
      method: "PATCH",
      path: `/api/abm/icps/${encodeURIComponent(icpId)}`,
      body,
    });
  }

  deleteIcp(icpId) {
    return this.request({
      method: "DELETE",
      path: `/api/abm/icps/${encodeURIComponent(icpId)}`,
    });
  }

  refreshIcps(body = {}, icpId = "") {
    const suffix = icpId ? `/${encodeURIComponent(icpId)}` : "";
    return this.request({
      method: "POST",
      path: `/api/abm/icps${suffix}/refresh`,
      body,
    });
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

  prepareMessages(sequenceId, body = {}) {
    if (!String(sequenceId || "").trim()) throw new Error("sequenceId is required");
    return this.request({
      method: "POST",
      path: `/api/abm/sequences/${encodeURIComponent(sequenceId)}/prepare-messages`,
      body,
    });
  }

  createLocalSequence(body = {}) {
    const steps = Array.isArray(body.steps)
      ? body.steps.map((step) => ({ ...step, use_ai: false }))
      : [];
    return this.request({
      method: "POST",
      path: "/api/abm/sequences",
      body: { ...body, steps },
    });
  }

  startSequence(sequenceId, body = {}) {
    return this.request({
      method: "POST",
      path: `/api/abm/sequences/${encodeURIComponent(sequenceId)}/start`,
      body,
    });
  }

  launchCampaignSegment(body = {}) {
    return this.request({
      method: "POST",
      path: "/api/abm/campaigns/launch-segment",
      body,
    });
  }

  sendPipelineMessage(pipelineId, text) {
    return this.request({
      method: "POST",
      path: `/api/abm/pipelines/${encodeURIComponent(pipelineId)}/messages/send`,
      body: { text },
    });
  }

  sendLinkedinMessage(body = {}) {
    return this.request({
      method: "POST",
      path: "/api/abm/linkedin/messages/send",
      body,
    });
  }

  publishContent(body = {}) {
    return this.request({
      method: "POST",
      path: "/api/abm/content/publish",
      body,
    });
  }

  sendNewsletter(newsletterId, body = {}) {
    return this.request({
      method: "POST",
      path: `/api/abm/newsletters/${encodeURIComponent(newsletterId)}/send`,
      body,
    });
  }

  revokeSelf() {
    return this.request({ method: "DELETE", path: "/api/abm/agent/token" });
  }

  syncHubspotOutreach(body = {}) {
    return this.request({ method: "POST", path: "/api/abm/crm/hubspot/outreach-sync", body });
  }

  claimLocalDraftJob(body = {}) {
    return this.request({
      method: "POST",
      path: "/api/abm/local-draft-jobs/claim",
      body,
    });
  }

  submitLocalDraft(jobId, body = {}, idempotencyKey = "") {
    return this.request({
      method: "POST",
      path: `/api/abm/local-draft-jobs/${encodeURIComponent(jobId)}/drafts`,
      body,
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
    });
  }

  sendLocalReply(jobId) {
    return this.request({
      method: "POST",
      path: `/api/abm/local-draft-jobs/${encodeURIComponent(jobId)}/send`,
      body: {},
    });
  }

  cancelLocalDraftJob(jobId) {
    return this.request({
      method: "POST",
      path: `/api/abm/local-draft-jobs/${encodeURIComponent(jobId)}/cancel`,
      body: {},
    });
  }
}
