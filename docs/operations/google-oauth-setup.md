# Configuración de Google OAuth

## Requisitos previos
- Cuenta de Google
- Acceso al archivo `.env` del proyecto

---

## 1. Crear proyecto en Google Cloud Console

1. Ir a [Google Cloud Console](https://console.cloud.google.com)
2. Crear un proyecto nuevo con el nombre del proyecto
3. Ir a **APIs y servicios** → **Google Auth Platform** → **Comenzar**
4. Seleccionar **Usuarios externos** → **Siguiente**

---

## 2. Crear credenciales OAuth

1. Ir a **Clientes** → **Crear cliente de OAuth**
2. Tipo de aplicación: **Aplicación web**
3. Nombre: `Watchdog Dev` (o `Watchdog Prod` para producción)
4. Agregar en **Orígenes autorizados de JavaScript**:
http://localhost:3000
5. Agregar en **URIs de redireccionamiento autorizados**:
http://localhost:3000/api/auth/callback/google
6. Hacer click en **Crear** y guardar las credenciales en formato JSON

---

## 3. Configurar variables de entorno

Agregar las credenciales al `.env` de la raíz:
AUTH_GOOGLE_ID=tu_client_id
AUTH_GOOGLE_SECRET=tu_client_secret

---

## Notas

- Para producción crear un cliente OAuth separado con las URLs del dominio real
- Las credenciales del `.env` nunca se commitean al repositorio