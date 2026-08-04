/**
 * Base64 con UTF-8 correcto.
 *
 * `btoa()` lanza InvalidCharacterError con cualquier carácter fuera de Latin-1,
 * así que aplicado directamente a JSON en español rompería en la primera "ñ",
 * tilde o "¿". La API de GitHub exige base64 para el contenido de los archivos,
 * de modo que este paso está en el camino crítico de todo guardado.
 */

// Se trocea porque String.fromCharCode(...bytes) con miles de argumentos
// desborda la pila, y un cuaderno grande son cientos de miles de bytes.
const TAMANO_TROZO = 8192

export function bytesABase64(bytes: Uint8Array): string {
  let binario = ''
  for (let i = 0; i < bytes.length; i += TAMANO_TROZO) {
    binario += String.fromCharCode(...bytes.subarray(i, i + TAMANO_TROZO))
  }
  return btoa(binario)
}

/*
 * El tipo se fija a Uint8Array<ArrayBuffer> y no al genérico Uint8Array porque
 * desde TypeScript 5.7 este último incluye SharedArrayBuffer, que no satisface
 * el BufferSource que exige la WebCrypto API.
 */
export function base64ABytes(base64: string): Uint8Array<ArrayBuffer> {
  // GitHub devuelve el base64 partido en líneas; hay que limpiarlo antes.
  const limpio = base64.replace(/\s+/g, '')
  const binario = atob(limpio)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i += 1) {
    bytes[i] = binario.charCodeAt(i)
  }
  return bytes
}

export function textoABase64(texto: string): string {
  return bytesABase64(new TextEncoder().encode(texto))
}

export function base64ATexto(base64: string): string {
  return new TextDecoder().decode(base64ABytes(base64))
}
