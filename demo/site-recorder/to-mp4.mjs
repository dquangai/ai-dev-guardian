// Convert mọi file .webm trong output/ sang .mp4 (H.264 + yuv420p để mở được trên mọi app
// chat/email — .webm thuần không phải chỗ nào cũng preview tốt). Dùng binary ffmpeg tĩnh từ
// @ffmpeg-installer/ffmpeg, không cần ffmpeg cài sẵn ở hệ thống / không cần sudo.
import ffmpegPath from '@ffmpeg-installer/ffmpeg'
import { spawn } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = path.join(__dirname, 'output')

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath.path, args, { stdio: 'inherit' })
    proc.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}`))))
    proc.on('error', reject)
  })
}

async function main() {
  const files = (await readdir(OUTPUT_DIR)).filter((f) => f.endsWith('.webm'))
  if (files.length === 0) {
    console.warn('[to-mp4] Không có file .webm nào trong output/ — chạy `npm run record` trước.')
    return
  }

  for (const file of files) {
    const inputPath = path.join(OUTPUT_DIR, file)
    const outputPath = path.join(OUTPUT_DIR, file.replace(/\.webm$/, '.mp4'))
    console.log(`[to-mp4] ${file} -> ${path.basename(outputPath)}`)
    await runFfmpeg(['-y', '-i', inputPath, '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outputPath])
  }

  console.log('[to-mp4] Xong.')
}

main().catch((err) => {
  console.error('[to-mp4] Lỗi:', err)
  process.exit(1)
})
