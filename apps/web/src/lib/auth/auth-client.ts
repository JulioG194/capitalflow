import type {
  ForgotPasswordInput,
  LoginInput,
  LoginResponseDto,
  RegisterInput,
  ResetPasswordInput,
  UpdateProfileInput,
  UserDto,
} from "@capitalflow/shared-types";
import { apiFetch, authFetch } from "./api-client";
import { ApiError } from "./errors";
import { setAccessToken } from "./token-store";

const GENERIC_ERROR_MESSAGE = "An unexpected error occurred. Please try again.";

interface ErrorBody {
  message?: unknown;
  code?: unknown;
}

/**
 * Parses a JSON body and throws `ApiError` on a non-2xx response. The API
 * (per spec 002 AC32) never leaks raw Prisma/stack-trace detail, so it's
 * safe to surface `body.message` for most flows; `LoginForm` still overrides
 * this with its own fixed copy on 401 as an extra guarantee (AC38).
 */
async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const errorBody = (body ?? {}) as ErrorBody;
    const message =
      typeof errorBody.message === "string" ? errorBody.message : GENERIC_ERROR_MESSAGE;
    const code = typeof errorBody.code === "string" ? errorBody.code : undefined;
    throw new ApiError(response.status, message, code);
  }

  return body as T;
}

function postJson(path: string, body: unknown): Promise<Response> {
  return authFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** AC1/AC36: creates a new account. No token is issued by this endpoint. */
export function registerRequest(input: RegisterInput): Promise<UserDto> {
  return postJson("/auth/register", input).then((res) => parseJsonOrThrow<UserDto>(res));
}

/**
 * AC6/AC41: logs in and stores the returned access token in memory
 * (`token-store`) — never in localStorage/sessionStorage/a readable cookie.
 * The refresh token itself never appears in this response; the API sets it
 * as an HttpOnly cookie the browser handles automatically.
 */
export async function loginRequest(input: LoginInput): Promise<LoginResponseDto> {
  const response = await postJson("/auth/login", input);
  const data = await parseJsonOrThrow<LoginResponseDto>(response);
  setAccessToken(data.accessToken);
  return data;
}

/**
 * AC42: always clears local session state regardless of the network
 * outcome — logout must be effectively idempotent from the UI's point of
 * view (mirrors the API's AC19 idempotency).
 */
export async function logoutRequest(): Promise<void> {
  try {
    await authFetch("/auth/logout", { method: "POST" });
  } finally {
    setAccessToken(null);
  }
}

/** AC26/AC40: fetches the authenticated user's profile. */
export function getMe(): Promise<UserDto> {
  return apiFetch("/auth/me").then((res) => parseJsonOrThrow<UserDto>(res));
}

/** AC28/AC40: updates the authenticated user's editable `name` field. */
export function updateMe(input: UpdateProfileInput): Promise<UserDto> {
  return apiFetch("/auth/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then((res) => parseJsonOrThrow<UserDto>(res));
}

/** AC20/AC21 + spec 006 AC28: generic message always; optional resetLink in non-prod. */
export function forgotPasswordRequest(
  input: ForgotPasswordInput,
): Promise<{ message: string; resetLink?: string }> {
  return postJson("/auth/forgot-password", input).then((res) =>
    parseJsonOrThrow<{ message: string; resetLink?: string }>(res),
  );
}

/** AC22/AC23/AC24: consumes a reset token to set a new password. */
export function resetPasswordRequest(
  input: ResetPasswordInput,
): Promise<{ message: string }> {
  return postJson("/auth/reset-password", input).then((res) =>
    parseJsonOrThrow<{ message: string }>(res),
  );
}

export { ApiError };
