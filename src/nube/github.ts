import { base64ABytes, base64ATexto, bytesABase64, textoABase64 } from './base64'
import { REPO_DATOS } from './configuracion'

const API = 'https://api.github.com'

export class ErrorGitHub extends Error {
  constructor(
    public estado: number,
    mensaje: string,
  ) {
    super(mensaje)
    this.name = 'ErrorGitHub'
  }
}

/** El token no sirve: caducado, revocado o mal copiado. */
export class ErrorAutenticacion extends ErrorGitHub {}

/** El archivo remoto cambió desde la última vez que lo leímos. */
export class ErrorConflicto extends ErrorGitHub {}

/** Sin red, o la petición no llegó a salir. */
export class ErrorRed extends ErrorGitHub {
  constructor(mensaje: string) {
    super(0, mensaje)
  }
}

export type ArchivoRemoto = {
  contenido: string
  sha: string
}

export class ClienteGitHub {
  constructor(private readonly token: string) {}

  private get base(): string {
    return `${API}/repos/${REPO_DATOS.propietario}/${REPO_DATOS.nombre}`
  }

  private cabeceras(extra: Record<string, string> = {}): HeadersInit {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...extra,
    }
  }

  private async pedir(url: string, init: RequestInit = {}): Promise<Response> {
    let respuesta: Response
    try {
      respuesta = await fetch(url, init)
    } catch (causa) {
      throw new ErrorRed(
        'No se pudo contactar con GitHub. Comprueba la conexión a internet.',
      )
    }

    if (respuesta.status === 401) {
      throw new ErrorAutenticacion(
        401,
        'GitHub rechazó el token. Puede estar caducado, revocado o mal copiado.',
      )
    }

    if (respuesta.status === 403 || respuesta.status === 429) {
      const restantes = respuesta.headers.get('x-ratelimit-remaining')
      if (restantes === '0') {
        const reinicio = respuesta.headers.get('x-ratelimit-reset')
        const cuando = reinicio
          ? new Date(Number(reinicio) * 1000).toLocaleTimeString('es')
          : 'en un rato'
        throw new ErrorGitHub(
          respuesta.status,
          `Se agotó el límite de peticiones de GitHub. Se restablece a las ${cuando}.`,
        )
      }
      throw new ErrorGitHub(
        respuesta.status,
        'El token no tiene permiso sobre este repositorio. Debe incluir "Contents: read and write".',
      )
    }

    // GitHub usa 409 y a veces 422 cuando el sha enviado ya no es el actual.
    if (respuesta.status === 409 || respuesta.status === 422) {
      throw new ErrorConflicto(
        respuesta.status,
        'El archivo cambió en la nube desde la última sincronización.',
      )
    }

    return respuesta
  }

  /** Comprueba pronto que el token sirve y que el repositorio existe. */
  async comprobarAcceso(): Promise<{ nombre: string; privado: boolean; puedeEscribir: boolean }> {
    const respuesta = await this.pedir(this.base, { headers: this.cabeceras() })

    if (respuesta.status === 404) {
      throw new ErrorGitHub(
        404,
        `No se encuentra ${REPO_DATOS.propietario}/${REPO_DATOS.nombre}. Si el repositorio es privado, el token debe tener acceso a él.`,
      )
    }
    if (!respuesta.ok) {
      throw new ErrorGitHub(respuesta.status, `GitHub respondió ${respuesta.status}.`)
    }

    const datos = (await respuesta.json()) as {
      full_name: string
      private: boolean
      permissions?: { push?: boolean }
    }

    return {
      nombre: datos.full_name,
      privado: Boolean(datos.private),
      // Con un token fine-grained puede no venir 'permissions'; se asume que sí
      // y el primer guardado lo confirmará con un error claro si no.
      puedeEscribir: datos.permissions?.push ?? true,
    }
  }

  /** Devuelve null si el archivo no existe todavía, que es un caso normal. */
  async leerArchivo(ruta: string): Promise<ArchivoRemoto | null> {
    const url = `${this.base}/contents/${encodeURI(ruta)}?ref=${REPO_DATOS.rama}`
    const respuesta = await this.pedir(url, { headers: this.cabeceras() })

    if (respuesta.status === 404) return null
    if (!respuesta.ok) {
      throw new ErrorGitHub(respuesta.status, `No se pudo leer ${ruta} (${respuesta.status}).`)
    }

    const datos = (await respuesta.json()) as {
      content?: string
      sha: string
      size: number
      encoding?: string
    }

    // El endpoint de contenidos deja 'content' vacío por encima de 1 MB. Un
    // cuaderno muy grande cae ahí, así que se recupera con el media type raw,
    // que sí sirve archivos de hasta 100 MB.
    if (!datos.content) {
      const bruto = await this.pedir(url, {
        headers: this.cabeceras({ Accept: 'application/vnd.github.raw' }),
      })
      if (!bruto.ok) {
        throw new ErrorGitHub(bruto.status, `No se pudo leer ${ruta} en bruto.`)
      }
      return { contenido: await bruto.text(), sha: datos.sha }
    }

    return { contenido: base64ATexto(datos.content), sha: datos.sha }
  }

  /**
   * Crea o actualiza un archivo. Si se pasa `sha`, GitHub solo acepta la
   * escritura cuando ese sha sigue siendo el actual: es lo que permite detectar
   * que otro dispositivo escribió antes en lugar de pisarlo en silencio.
   */
  async escribirArchivo(
    ruta: string,
    contenido: string,
    sha: string | undefined,
    mensaje: string,
  ): Promise<string> {
    const respuesta = await this.pedir(`${this.base}/contents/${encodeURI(ruta)}`, {
      method: 'PUT',
      headers: this.cabeceras({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        message: mensaje,
        content: textoABase64(contenido),
        branch: REPO_DATOS.rama,
        ...(sha ? { sha } : {}),
      }),
    })

    if (!respuesta.ok) {
      throw new ErrorGitHub(
        respuesta.status,
        `No se pudo guardar ${ruta} (${respuesta.status}).`,
      )
    }

    const datos = (await respuesta.json()) as { content?: { sha?: string } }
    const nuevoSha = datos.content?.sha
    if (!nuevoSha) {
      throw new ErrorGitHub(respuesta.status, `GitHub no devolvió el sha de ${ruta}.`)
    }
    return nuevoSha
  }

  /**
   * Lee un archivo BINARIO. Devuelve null si todavía no existe.
   *
   * Hace falta aparte de 'leerArchivo' y no es un capricho: esa función pasa lo
   * recibido por un decodificador UTF-8, en las dos ramas ('base64ATexto' abajo
   * de 1 MB y 'respuesta.text()' por encima). Un PDF no es texto UTF-8, así que
   * ese paso lo destroza. Y lo haría en silencio: la subida funcionaría, la
   * descarga funcionaría, y el archivo simplemente no abriría.
   */
  async leerBinario(
    ruta: string,
    // El tipo se fija a Uint8Array<ArrayBuffer> por el mismo motivo que en
    // base64.ts: el genérico incluye SharedArrayBuffer desde TypeScript 5.7 y no
    // satisface el BlobPart que hace falta para entregar la descarga.
  ): Promise<{ bytes: Uint8Array<ArrayBuffer>; sha: string } | null> {
    const url = `${this.base}/contents/${encodeURI(ruta)}?ref=${REPO_DATOS.rama}`
    const respuesta = await this.pedir(url, { headers: this.cabeceras() })

    if (respuesta.status === 404) return null
    if (!respuesta.ok) {
      throw new ErrorGitHub(respuesta.status, `No se pudo leer ${ruta} (${respuesta.status}).`)
    }

    const datos = (await respuesta.json()) as { content?: string; sha: string }

    // Igual que en 'leerArchivo': por encima de 1 MB el endpoint deja 'content'
    // vacío y hay que pedirlo en bruto. La diferencia está en cómo se recoge:
    // 'arrayBuffer()' y no 'text()', que es justo lo que preserva los bytes.
    if (!datos.content) {
      const bruto = await this.pedir(url, {
        headers: this.cabeceras({ Accept: 'application/vnd.github.raw' }),
      })
      if (!bruto.ok) {
        throw new ErrorGitHub(bruto.status, `No se pudo leer ${ruta} en bruto.`)
      }
      return { bytes: new Uint8Array(await bruto.arrayBuffer()), sha: datos.sha }
    }

    return { bytes: base64ABytes(datos.content), sha: datos.sha }
  }

  /**
   * Crea o actualiza un archivo binario.
   *
   * 'bytesABase64' recibe los bytes tal cual, sin pasarlos por TextEncoder: es
   * la mitad binaria de la pareja que ya usaba el cifrado del token.
   */
  async escribirBinario(
    ruta: string,
    bytes: Uint8Array,
    sha: string | undefined,
    mensaje: string,
  ): Promise<string> {
    const respuesta = await this.pedir(`${this.base}/contents/${encodeURI(ruta)}`, {
      method: 'PUT',
      headers: this.cabeceras({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        message: mensaje,
        content: bytesABase64(bytes),
        branch: REPO_DATOS.rama,
        ...(sha ? { sha } : {}),
      }),
    })

    if (!respuesta.ok) {
      throw new ErrorGitHub(respuesta.status, `No se pudo subir ${ruta} (${respuesta.status}).`)
    }

    const datos = (await respuesta.json()) as { content?: { sha?: string } }
    const nuevoSha = datos.content?.sha
    if (!nuevoSha) {
      throw new ErrorGitHub(respuesta.status, `GitHub no devolvió el sha de ${ruta}.`)
    }
    return nuevoSha
  }

  async eliminarArchivo(ruta: string, sha: string, mensaje: string): Promise<void> {
    const respuesta = await this.pedir(`${this.base}/contents/${encodeURI(ruta)}`, {
      method: 'DELETE',
      headers: this.cabeceras({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ message: mensaje, sha, branch: REPO_DATOS.rama }),
    })

    // Si ya no está, el objetivo se cumplió igual.
    if (respuesta.status === 404) return
    if (!respuesta.ok) {
      throw new ErrorGitHub(
        respuesta.status,
        `No se pudo eliminar ${ruta} (${respuesta.status}).`,
      )
    }
  }
}
