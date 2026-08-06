import { esImagenValida, pesoDeDataUrl } from './saneador'

/**
 * Preparación de las imágenes que se pegan o se arrastran a un apunte.
 *
 * El contenido de un apunte viaja a GitHub como un único JSON, y la imagen va
 * incrustada dentro como data URL (ver el nodo Imagen en extensiones.ts). Eso
 * hace que el tamaño del archivo sea el tamaño de las imágenes, y que cada
 * guardado vuelva a subirlas todas. Una captura de pantalla de un portátil
 * moderno ronda los 3 MB y en base64 crece otro tercio: dos o tres pegadas sin
 * tocar convertirían una nota en un archivo de 12 MB que se resube cada vez que
 * se escribe una palabra.
 *
 * Por eso aquí no se guarda nunca el archivo original: se redibuja a un tamaño
 * razonable para leerlo en pantalla y se recomprime.
 */

/** Lado mayor, en píxeles, al que se reduce una imagen pegada. */
const LADO_MAXIMO = 1600

/** Compromiso habitual entre nitidez y peso para capturas y fotos. */
const CALIDAD = 0.82

/**
 * Tope del resultado ya reescalado. Es una red de seguridad para casos raros
 * (una imagen enorme de puro ruido que no comprime): mejor avisar que dejar el
 * apunte en un tamaño que luego falle al sincronizar.
 */
const TOPE_BYTES = 2 * 1024 * 1024

/**
 * Tope del archivo de origen, antes de decodificarlo.
 *
 * Se comprueba antes que cualquier otra cosa porque createImageBitmap reserva
 * memoria para el mapa de bits descomprimido: unos 4 bytes por píxel, así que una
 * foto de 50 megapíxeles pide 200 MB de golpe. Comprobar solo el resultado, ya
 * comprimido, llegaba tarde y en un móvil se lleva la pestaña por delante.
 */
const TOPE_ORIGEN = 40 * 1024 * 1024

/**
 * Un GIF por debajo de este tamaño se guarda tal cual, sin pasar por el lienzo.
 *
 * Redibujar un GIF lo deja en su primer fotograma, es decir, pierde la animación
 * sin avisar. Como lo que se gana reescalando no compensa perder el contenido, un
 * GIF pequeño entra intacto y uno grande se rechaza.
 */
const TOPE_GIF = 1024 * 1024

export class ImagenDemasiadoGrande extends Error {
  constructor() {
    super('La imagen es demasiado grande, incluso después de reducirla.')
    this.name = 'ImagenDemasiadoGrande'
  }
}

/** ¿Este archivo es una imagen que sabemos incrustar? */
export function esArchivoDeImagen(archivo: File): boolean {
  // SVG se descarta ya aquí, además de en el saneador: es XML y puede traer
  // scripts dentro.
  return archivo.type.startsWith('image/') && archivo.type !== 'image/svg+xml'
}

/** Lee un archivo como data URL, sin tocar su contenido. */
function leerComoDataUrl(archivo: File): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader()
    lector.onload = () => resolver(String(lector.result))
    lector.onerror = () => rechazar(lector.error ?? new Error('No se pudo leer la imagen'))
    lector.readAsDataURL(archivo)
  })
}

/**
 * Convierte un archivo de imagen en una data URL lista para incrustar.
 *
 * Devuelve WebP si el navegador sabe producirlo y JPEG en caso contrario. El
 * formato de origen no se conserva a propósito: un PNG de captura de pantalla
 * pesa varias veces lo que el mismo contenido en WebP.
 */
export async function prepararImagen(archivo: File): Promise<string> {
  // Antes de decodificar nada: ver TOPE_ORIGEN.
  if (archivo.size > TOPE_ORIGEN) throw new ImagenDemasiadoGrande()

  // Un GIF se conserva entero para no perder la animación.
  if (archivo.type === 'image/gif') {
    if (archivo.size > TOPE_GIF) throw new ImagenDemasiadoGrande()
    const datos = await leerComoDataUrl(archivo)
    if (!esImagenValida(datos)) throw new Error('El formato de la imagen no es utilizable')
    return datos
  }

  const mapa = await createImageBitmap(archivo, {
    // Respeta la orientación EXIF: sin esto, las fotos hechas con el móvil de
    // lado aparecen giradas.
    imageOrientation: 'from-image',
  })

  try {
    const escala = Math.min(1, LADO_MAXIMO / Math.max(mapa.width, mapa.height))
    const ancho = Math.max(1, Math.round(mapa.width * escala))
    const alto = Math.max(1, Math.round(mapa.height * escala))

    const lienzo = document.createElement('canvas')
    lienzo.width = ancho
    lienzo.height = alto

    const contexto = lienzo.getContext('2d')
    if (!contexto) throw new Error('No se pudo preparar el lienzo de la imagen')

    // Fondo blanco: al pasar a JPEG o WebP sin canal alfa, lo transparente de un
    // PNG se volvería negro.
    contexto.fillStyle = '#ffffff'
    contexto.fillRect(0, 0, ancho, alto)
    contexto.drawImage(mapa, 0, 0, ancho, alto)

    let datos = lienzo.toDataURL('image/webp', CALIDAD)
    // Un navegador que no sepa exportar WebP devuelve PNG sin avisar.
    if (!datos.startsWith('data:image/webp')) {
      datos = lienzo.toDataURL('image/jpeg', CALIDAD)
    }

    if (!esImagenValida(datos)) throw new Error('El formato de la imagen no es utilizable')
    if (pesoDeDataUrl(datos) > TOPE_BYTES) throw new ImagenDemasiadoGrande()

    return datos
  } finally {
    // El mapa de bits ocupa memoria fuera del recolector de basura.
    mapa.close()
  }
}


/**
 * Tope de imágenes acumuladas en un mismo cuadro.
 *
 * El tope por imagen no basta. El documento entero se sube a GitHub en cada
 * ráfaga de guardado, así que diez capturas de una clase serían un archivo de
 * varios megas reenviado cada pocos segundos, con un historial de git que crece
 * para siempre y sin forma de podarlo desde la aplicación.
 *
 * Avisar aquí, en el momento de pegar, permite al usuario decidir. La alternativa
 * era enterarse mucho después, cuando la subida empezara a fallar con un 422 que
 * no explica nada.
 */
const TOPE_POR_CUADRO = 6 * 1024 * 1024

export class CuadroDemasiadoPesado extends Error {
  constructor() {
    super('Este cuadro ya tiene demasiadas imágenes.')
    this.name = 'CuadroDemasiadoPesado'
  }
}

/**
 * ¿Cabe una imagen más en este contenido?
 *
 * Se mide sobre el HTML que se va a guardar, que es lo que de verdad viaja, en
 * lugar de llevar la cuenta de las imágenes insertadas: así también cuentan las
 * que ya venían en el documento al abrirlo.
 */
export function cabeOtraImagen(htmlActual: string, datos: string): boolean {
  return htmlActual.length + datos.length <= TOPE_POR_CUADRO
}
