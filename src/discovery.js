function toolsFromManifest(manifest) {
  return Array.isArray(manifest?.tools) ? manifest.tools : [];
}

function toolFunction(tool) {
  return tool && typeof tool === "object" && tool.function && typeof tool.function === "object"
    ? tool.function
    : {};
}

export function findManifestTool(manifest, toolName) {
  const cleanName = String(toolName || "").trim();
  if (!cleanName) throw new Error("tool name is required");
  const tool = toolsFromManifest(manifest).find(
    (entry) => String(toolFunction(entry).name || "").trim() === cleanName,
  );
  if (!tool) throw new Error(`Tool is not available to this token: ${cleanName}`);
  return tool;
}

export function isMutatingTool(tool) {
  const access = tool?.["x-laserreach-access"] || {};
  return String(access.mutation || "write").toLowerCase() !== "read";
}

export function assertMutationConfirmed(tool, confirmed = false) {
  if (isMutatingTool(tool) && !confirmed) {
    throw new Error(
      `Tool ${toolFunction(tool).name} is mutating; rerun with --confirm-mutation after explicit user authorization`,
    );
  }
  return tool;
}

export function selectManifestTools(manifest, { filter = "", includeSchemas = false } = {}) {
  const term = String(filter || "").trim().toLowerCase();
  return toolsFromManifest(manifest)
    .filter((tool) => {
      const fn = toolFunction(tool);
      const access = tool?.["x-laserreach-access"] || {};
      if (!term) return true;
      return [fn.name, fn.description, access.mutation, ...(access.required_scopes || [])]
        .some((value) => String(value || "").toLowerCase().includes(term));
    })
    .map((tool) => {
      const fn = toolFunction(tool);
      const access = tool?.["x-laserreach-access"] || {};
      const selected = {
        name: fn.name,
        description: fn.description || "",
        access,
      };
      if (includeSchemas) selected.inputSchema = fn.parameters || {};
      return selected;
    });
}
