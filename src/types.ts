/**
 * DTOs mirrored from the verified Deepy tool-layer contract
 * (`dev/deepy-tools-contract.md`). These are intentionally permissive
 * (optional fields, index signatures) because the backend — not this
 * adapter — owns the schema. We forward and surface; we do not validate
 * business rules here.
 */

export type GenerationStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface ModelSummaryResponse {
  modelName: string;
  in?: string;
  out?: string;
  generationType?: string;
  supportsReferences?: boolean;
  [key: string]: unknown;
}

export interface ModelDetailResponse {
  modelName: string;
  family?: string;
  group?: string;
  generationType?: string;
  parameters?: Record<string, unknown>;
  referenceLimits?: unknown[];
  maxPromptLength?: number;
  [key: string]: unknown;
}

export interface EstimateResponse {
  /** Integer token cost. Money is integer-only — never computed locally. */
  tokens: number;
  /** Integer resulting balance as reported by the backend. */
  userBalanceAfter: number;
  [key: string]: unknown;
}

export interface ResultRef {
  /**
   * NOTE: this is emitted by the backend as a *studio* path and must NOT be
   * used by an API-key client. Use `deepy_get_result` instead — the server
   * fetches the bytes with the key and returns them inline.
   */
  url?: string;
  [key: string]: unknown;
}

export interface GenerationResponse {
  publicId: string;
  status: GenerationStatus;
  modelName?: string;
  generationType?: string;
  prompt?: string;
  parameters?: Record<string, unknown>;
  referenceFileIds?: string[];
  referenceMediaTypes?: string[];
  tokensReserved?: number;
  tokensSpent?: number;
  createdAt?: string;
  completedAt?: string;
  results?: ResultRef[];
  errorCode?: string;
  errorMessage?: string;
  [key: string]: unknown;
}

export interface ImprovePromptResponse {
  data?: {
    prompt?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * The exact request body shared by BOTH `/generations/estimate` and
 * `/generations`. Building it in one place guarantees `quote == charge`
 * (byte-identical params between estimate and create).
 */
export interface GenerationBody {
  modelName: string;
  prompt: string;
  parameters: Record<string, unknown>;
  referenceFiles: string[];
}
