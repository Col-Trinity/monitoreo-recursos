import { Resend } from "resend";
import { env } from "@watchdog/env";

let _resend: Resend | undefined;

export function resend(): Resend {
  _resend ??= new Resend(env.RESEND_API_KEY);
  return _resend;
}

export async function sendVerificationEmail(email: string, token: string) {
  const verifyUrl = `${env.NEXT_PUBLIC_APP_URL}/api/auth/verify/${token}`;

  let result: Awaited<ReturnType<Resend["emails"]["send"]>>;
  try {
    result = await resend().emails.send({
      from: "Watch-Dog <onboarding@resend.dev>",
      to: email,
      subject: "Verificá tu email — Watch-Dog",
      html: `
        <h1>Verificá tu email</h1>
        <p>Hacé click en el link para verificar tu cuenta:</p>
        <a href="${verifyUrl}">Verificar email</a>
        <p>Este link expira en 24 horas.</p>
        <p>Si no creaste una cuenta, ignorá este email.</p>
      `,
    });
  } catch (cause) {
    throw new Error(`Resend network error: ${String(cause)}`);
  }

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }
}
