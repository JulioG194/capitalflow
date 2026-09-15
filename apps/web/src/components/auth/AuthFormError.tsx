type AuthFormErrorProps = {
  message: string | null;
};

/**
 * The single place the "something went wrong" banner for auth forms is
 * rendered, so every form shows exactly one generic message and never raw
 * API response text (spec 002 AC38).
 */
export function AuthFormError({ message }: AuthFormErrorProps) {
  if (!message) {
    return null;
  }

  return (
    <p
      role="alert"
      className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {message}
    </p>
  );
}
