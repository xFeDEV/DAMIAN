export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024
export const ACCEPTED_RECEIPT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']

const MAX_IMAGE_DIMENSION = 1600
const JPEG_QUALITY = 0.8

export function formatFileSize(bytes: number) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / Math.pow(1024, index)
  return `${value.toFixed(index === 0 ? 0 : 1).replace('.', ',')} ${units[index]}`
}

export function isAcceptedReceipt(file: File) {
  return ACCEPTED_RECEIPT_TYPES.includes(file.type)
}

export function isPdf(file: File | { type: string }) {
  return file.type === 'application/pdf'
}

// Reduce el peso de las imágenes (máx 1600px, JPEG ~80%) antes de subirlas.
// Los PDF y archivos no-imagen se devuelven sin cambios.
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('No se pudo leer la imagen'))
      element.src = url
    })
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight))
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(image, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' })
  } catch {
    return file
  } finally {
    URL.revokeObjectURL(url)
  }
}
