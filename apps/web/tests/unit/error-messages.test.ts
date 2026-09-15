import { describe, expect, it } from "vitest";
import { translateFieldError } from "@/lib/auth/error-messages";

describe("translateFieldError", () => {
  it("translates known passwordSchema messages to Spanish", () => {
    expect(translateFieldError("Password must be at least 10 characters")).toBe(
      "La contraseña debe tener al menos 10 caracteres.",
    );
    expect(translateFieldError("Password must include a letter")).toBe(
      "La contraseña debe incluir al menos una letra.",
    );
    expect(translateFieldError("Password must include a number")).toBe(
      "La contraseña debe incluir al menos un número.",
    );
  });

  it("translates the default zod email/min/max messages", () => {
    expect(translateFieldError("Invalid email address")).toBe("Correo electrónico inválido.");
    expect(
      translateFieldError("Too small: expected string to have >=1 characters"),
    ).toBe("Este campo es obligatorio.");
    expect(
      translateFieldError("Too big: expected string to have <=100 characters"),
    ).toBe("Este campo es demasiado largo (máximo 100 caracteres).");
  });

  it("returns unknown messages unchanged", () => {
    expect(translateFieldError("Some future validation message")).toBe(
      "Some future validation message",
    );
  });

  it("passes through undefined", () => {
    expect(translateFieldError(undefined)).toBeUndefined();
  });
});
