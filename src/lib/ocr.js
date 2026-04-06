const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_CLOUD_API_KEY

/**
 * 이미지 파일을 Google Cloud Vision API로 OCR 처리
 * @param {File} imageFile - 영수증 이미지 파일
 * @returns {string} 추출된 텍스트
 */
export async function extractTextFromImage(imageFile) {
  const base64 = await fileToBase64(imageFile)

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64 },
            features: [{ type: 'TEXT_DETECTION' }],
          },
        ],
      }),
    }
  )

  const data = await response.json()

  if (data.responses?.[0]?.error) {
    throw new Error(data.responses[0].error.message)
  }

  return data.responses?.[0]?.fullTextAnnotation?.text || ''
}

/**
 * File 객체를 base64 문자열로 변환 (data:... 접두사 제거)
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
