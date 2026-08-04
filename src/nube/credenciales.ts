import { base64ABytes, bytesABase64, base64ATexto, textoABase64 } from './base64'

/**
 * Cifrado del token de GitHub con la contraseña del usuario.
 *
 * Qué protege y qué no, dicho claro: protege el token guardado en el navegador
 * frente a alguien que lea el almacenamiento sin conocer la contraseña. No lo
 * protege mientras la app está abierta, porque para llamar a la API el token
 * tiene que estar descifrado en memoria. Por eso la mitigación que más vale es
 * que el token sea fine-grained y limitado al repositorio de datos.
 */

const VERSION = 1

/**
 * 600.000 iteraciones es la recomendación de OWASP para PBKDF2-HMAC-SHA256.
 * Se guarda dentro del blob para poder subirla en el futuro sin invalidar las
 * credenciales ya cifradas con un valor anterior.
 */
export const ITERACIONES_ACTUALES = 600_000

export const LONGITUD_MINIMA_CONTRASENA = 8

export type CredencialCifrada = {
  version: number
  iteraciones: number
  sal: string
  iv: string
  secreto: string
}

/** Contraseña incorrecta, o datos manipulados: AES-GCM no distingue entre ambos. */
export class ErrorContrasena extends Error {
  constructor() {
    super('La contraseña no es correcta.')
    this.name = 'ErrorContrasena'
  }
}

function derivarClave(
  contrasena: string,
  sal: Uint8Array<ArrayBuffer>,
  iteraciones: number,
): Promise<CryptoKey> {
  return crypto.subtle
    .importKey('raw', new TextEncoder().encode(contrasena), 'PBKDF2', false, ['deriveKey'])
    .then((material) =>
      crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: sal, iterations: iteraciones, hash: 'SHA-256' },
        material,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      ),
    )
}

export async function cifrarToken(
  token: string,
  contrasena: string,
): Promise<CredencialCifrada> {
  const sal = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const clave = await derivarClave(contrasena, sal, ITERACIONES_ACTUALES)

  const cifrado = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    clave,
    new TextEncoder().encode(token),
  )

  return {
    version: VERSION,
    iteraciones: ITERACIONES_ACTUALES,
    sal: bytesABase64(sal),
    iv: bytesABase64(iv),
    secreto: bytesABase64(new Uint8Array(cifrado)),
  }
}

export async function descifrarToken(
  credencial: CredencialCifrada,
  contrasena: string,
): Promise<string> {
  const clave = await derivarClave(
    contrasena,
    base64ABytes(credencial.sal),
    credencial.iteraciones || ITERACIONES_ACTUALES,
  )

  try {
    const plano = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ABytes(credencial.iv) },
      clave,
      base64ABytes(credencial.secreto),
    )
    return new TextDecoder().decode(plano)
  } catch {
    // AES-GCM falla la verificación de integridad: contraseña mala o blob roto.
    throw new ErrorContrasena()
  }
}

/* ------------------------------------------------------------------ */
/* Dónde se guarda el blob cifrado                                     */
/* ------------------------------------------------------------------ */

const CLAVE_ALMACEN = 'cuadernos:credencial'

/**
 * En equipos compartidos (los del SENA) la opción por defecto es
 * 'solo-esta-sesion': el blob va a sessionStorage y desaparece al cerrar el
 * navegador, así que no queda nada durable en una máquina ajena. Aun así
 * sobrevive a un F5, para no tener que pegar el token en cada recarga.
 */
export type DondeGuardar = 'dispositivo' | 'solo-esta-sesion'

export function guardarCredencial(credencial: CredencialCifrada, donde: DondeGuardar): void {
  const texto = JSON.stringify(credencial)
  olvidarCredencial()
  if (donde === 'dispositivo') {
    localStorage.setItem(CLAVE_ALMACEN, texto)
  } else {
    sessionStorage.setItem(CLAVE_ALMACEN, texto)
  }
}

export function leerCredencial(): { credencial: CredencialCifrada; donde: DondeGuardar } | null {
  const candidatos: Array<[DondeGuardar, string | null]> = [
    ['dispositivo', localStorage.getItem(CLAVE_ALMACEN)],
    ['solo-esta-sesion', sessionStorage.getItem(CLAVE_ALMACEN)],
  ]

  for (const [donde, crudo] of candidatos) {
    if (!crudo) continue
    try {
      const credencial = JSON.parse(crudo) as CredencialCifrada
      if (credencial?.sal && credencial?.iv && credencial?.secreto) {
        return { credencial, donde }
      }
    } catch {
      // Blob corrupto: se ignora para que la app no quede bloqueada.
    }
  }
  return null
}

export function olvidarCredencial(): void {
  localStorage.removeItem(CLAVE_ALMACEN)
  sessionStorage.removeItem(CLAVE_ALMACEN)
}

/** Comprobación de forma del token, para avisar antes de gastar una llamada. */
export function pareceTokenValido(token: string): boolean {
  const limpio = token.trim()
  // Los fine-grained empiezan por github_pat_; los clásicos por ghp_.
  return /^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(limpio)
}

export function esTokenClasico(token: string): boolean {
  return token.trim().startsWith('ghp_')
}

/** Solo para las pruebas del formato base64 desde la consola del navegador. */
export const _internos = { textoABase64, base64ATexto }
