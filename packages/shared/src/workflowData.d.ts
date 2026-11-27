export type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
export type JsonObject = { [key: string]: JsonValue };
export interface WorkflowItem { json: JsonObject }

export function isJsonObject(value: unknown): value is JsonObject;
export function normalizeItems(value: JsonValue): WorkflowItem[];
export function validateWorkflowItems(value: unknown, maxItems?: number): value is WorkflowItem[];
export function toDisplayItems(items: WorkflowItem[]): JsonObject[];
export function isInitialItems(value: unknown): value is JsonObject | JsonObject[];
