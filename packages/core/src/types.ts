// SPDX-License-Identifier: Apache-2.0

/**
 * Structured error from DSL validation.
 */
export interface ValidationError {
  line: number;
  column: number;
  message: string;
}

/**
 * Current model state.
 */
export interface ModelData {
  dsl: string;
  json: object | null;
  errors: ValidationError[];
}

/**
 * A single authorization model version summary.
 */
export interface AuthorizationModelSummary {
  id: string;
  createdAt: string;
}

/**
 * A single assertion to be checked.
 */
export interface AssertionData {
  user: string;
  relation: string;
  object: string;
  expectation: boolean;
}

/**
 * The result of running an assertion.
 */
export interface AssertionResult {
  allowed: boolean | null;
  error: string | null;
  status: 'pass' | 'fail' | 'error' | 'pending';
}

/**
 * Sample store entry from the openfga/sample-stores repo.
 */
export interface SampleStore {
  name: string;
  path: string;
  downloadUrl: string;
}

/**
 * A captured API request/response for the dev console.
 */
export interface ApiLogEntry {
  /** Unique ID for this entry (monotonic counter). */
  id: number;
  /** When the request was initiated (ms since epoch). */
  timestamp: number;
  /** HTTP method (GET, POST, PUT, DELETE). */
  method: string;
  /** OpenFGA API path, e.g. /stores/{id}/check. */
  path: string;
  /** Query string (without leading ?), or empty. */
  query: string;
  /** Request body (parsed JSON), or null for bodyless methods. */
  requestBody: unknown;
  /** HTTP response status code, or 0 if the request failed. */
  statusCode: number;
  /** Response body (parsed JSON), or null. */
  responseBody: unknown;
  /** Round-trip time in milliseconds. */
  durationMs: number;
  /** Subset of request headers worth showing. */
  requestHeaders: Record<string, string>;
  /** Subset of response headers worth showing. */
  responseHeaders: Record<string, string>;
}
