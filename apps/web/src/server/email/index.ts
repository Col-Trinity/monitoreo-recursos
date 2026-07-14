import { Resend } from "resend";
import { env } from "@watchdog/env";

let _resend: Resend | undefined;

export function resend(): Resend {
  _resend ??= new Resend(env.RESEND_API_KEY);
  return _resend;
}

export async function sendVerificationEmail(email: string, token: string) {
  if (process.env.RESEND_SKIP_SEND === "true") {
    console.log(`[test] skipping verification email to ${email}`);
    return;
  }
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

export async function sendPasswordResetEmail(email: string, token: string) {
  if (process.env.RESEND_SKIP_SEND === "true") {
    console.log(`[test] skipping reset email to ${email}`);
    return;
  }
  const resetUrl = `${env.NEXT_PUBLIC_APP_URL}/auth/reset/${token}`;
  const cancelUrl = `${env.NEXT_PUBLIC_APP_URL}/api/auth/cancel-reset/${token}`; // reste token 

  let result: Awaited<ReturnType<Resend["emails"]["send"]>>;
  try {
    result = await resend().emails.send({
      from: "Watch-Dog <onboarding@resend.dev>",
      to: email,
      subject: "Restablecé tu contraseña — Watch-Dog",
      html: `
  <h1>Restablecé tu contraseña</h1>
  <p>Recibiste este email porque alguien solicitó restablecer la contraseña de tu cuenta.</p>
  <a href="${resetUrl}">Restablecer contraseña</a>
  <p>Este link expira en 1 hora.</p>
  <hr />
  <p>Si no fuiste vos, cancelá el pedido inmediatamente:</p>
  <a href="${cancelUrl}">No fui yo — Cancelar reset</a>
  <p style="color: #666; font-size: 12px;">
    Al cancelar, el link de arriba quedará inválido.
  </p>
`,
    });
  } catch (cause) {
    throw new Error(`Resend network error: ${String(cause)}`);
  }

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }
}


export async function sendInvitationEmail(email: string, token:string ){
  if (process.env.RESEND_SKIP_SEND === "true") {
    console.log(`[test] skipping invitation email to ${email}`);
    return;
  }
const invitationUrl = `${env.NEXT_PUBLIC_APP_URL}/invite/${token}`;
  let result: Awaited<ReturnType<Resend["emails"]["send"]>>;
  try{

  result = await resend().emails.send({
      from: "Watch-Dog <onboarding@resend.dev>",
      to: email,
      subject: "Te invitaron a un workspace — Watch-Dog",
      html: `
        <h1>Fuiste invitado a Watch-Dog</h1>
        <p>Alguien te invitó a unirte a un workspace en Watch-Dog.</p>
        <a href="${invitationUrl}">Aceptar invitación</a>
        <p>Este link expira en 7 días.</p>
        <p>Si no esperabas esta invitación, podés ignorar este email.</p>
      `,
    });  }catch(cause){
    throw new Error(`Resend network error: ${String(cause)}`);
  }
}