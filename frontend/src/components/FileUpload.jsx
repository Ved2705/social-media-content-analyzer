import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'

const ACCEPTED = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
}

function getFileIcon(name) {
  if (!name) return '📄'
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return '📑'
  if (['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext)) return '🖼️'
  return '📄'
}

export default function FileUpload({ onFile, onUrl, stage, fileName, onReset }) {
  const [rejectMsg, setRejectMsg] = useState('')
  const [urlValue, setUrlValue] = useState('')

  const onDrop = useCallback((accepted, rejected) => {
    setRejectMsg('')
    if (rejected?.length) {
      setRejectMsg('Unsupported file. Upload a PDF, PNG, JPG, or WEBP.')
      return
    }
    if (accepted?.length) {
      onFile(accepted[0])
    }
  }, [onFile])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    multiple: false,
    maxSize: 15 * 1024 * 1024,
  })

  const busy = stage === 'extracting' || stage === 'analyzing'

  const statusClass =
    stage === 'extracting' ? 'dropzone-file-status--extracting' :
    stage === 'analyzing' ? 'dropzone-file-status--analyzing' :
    stage === 'done' ? 'dropzone-file-status--done' :
    stage === 'error' ? 'dropzone-file-status--error' : ''

  const handleUrlSubmit = (e) => {
    e.preventDefault()
    if (!urlValue.trim()) return
    onUrl(urlValue.trim())
    setUrlValue('')
  }

  return (
    <section className="upload-section">
      {/* Drag & drop zone */}
      <div
        {...getRootProps()}
        className={`dropzone ${isDragActive ? 'dropzone-active' : ''} ${busy ? 'dropzone-busy' : ''}`}
      >
        <input {...getInputProps()} />

        {busy && <div className="scan-line" aria-hidden="true" />}

        {!fileName && (
          <>
            <div className="dropzone-icon-wrapper">
              <span role="img" aria-label="Upload">⇪</span>
            </div>
            <p className="dropzone-title">
              {isDragActive ? 'Drop it here' : 'Drag & drop a PDF or image'}
            </p>
            <p className="dropzone-sub">
              or click to browse <span>·</span> PDF, PNG, JPG, WEBP <span>·</span> up to 15 MB
            </p>
          </>
        )}

        {fileName && (
          <div className="dropzone-file">
            <div style={{ fontSize: '28px', marginBottom: '10px' }}>{getFileIcon(fileName)}</div>
            <div className="dropzone-file-name">{fileName}</div>
            <div className={`dropzone-file-status ${statusClass}`}>
              {stage === 'extracting' && '⟳ Extracting text…'}
              {stage === 'analyzing' && '◈ Extraction done — analyzing engagement…'}
              {stage === 'done' && '✓ Analysis complete'}
              {stage === 'error' && '✕ Failed'}
            </div>
          </div>
        )}
      </div>

      {/* URL import section */}
      {!fileName && (
        <>
          <div className="upload-divider">or import from a link</div>
          <form className="url-import" onSubmit={handleUrlSubmit}>
            <input
              type="url"
              className="url-input"
              placeholder="Paste a Google Drive, Dropbox, or direct file URL…"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              disabled={busy}
            />
            <button type="submit" className="url-submit" disabled={busy || !urlValue.trim()}>
              Import
            </button>
          </form>
          <div className="url-hint">
            <span className="url-hint-icon">☁️</span>
            Google Drive · Dropbox · OneDrive · any direct file link
          </div>
        </>
      )}

      {rejectMsg && <p className="upload-reject">{rejectMsg}</p>}

      {fileName && !busy && (
        <button className="reset-btn" onClick={onReset}>
          ↻ Analyze another file
        </button>
      )}
    </section>
  )
}
