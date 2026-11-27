export function isJsonObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeItems(value) {
  const entries = Array.isArray(value) ? value : [value];
  return entries.map(entry => ({
    json: structuredClone(isJsonObject(entry) ? entry : { value: entry }),
  }));
}

export function validateWorkflowItems(value, maxItems = Infinity) {
  return Array.isArray(value) && value.length <= maxItems
    && value.every(item => isJsonObject(item) && isJsonObject(item.json));
}

export function toDisplayItems(items) {
  return items.map(item => item.json);
}

export function isInitialItems(value) {
  return isJsonObject(value) || (Array.isArray(value) && value.every(isJsonObject));
}
