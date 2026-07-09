import { useState, useCallback, useEffect } from 'react'
import axios from 'axios'
import FileUpload from './components/FileUpload.jsx'
import ResultsPanel from './components/ResultsPanel.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

const STEPS = [
  { key: 'upload', label: 'Upload', icon: '↑' },
  { key: 'extract', label: 'Extract', icon: '⎘' },
  { key: 'analyze', label: 'Analyze', icon: '◈' },
  { key: 'done', label: 'Done', icon: '✓' },
]

function getStepState(stage, stepKey) {
  const order = ['upload', 'extract', 'analyze', 'done']
  const stageMap = { idle: -1, extracting: 1, analyzing: 2, done: 3, error: -1 }
  const currentIdx = stageMap[stage] ?? -1
  const stepIdx = order.indexOf(stepKey)
  if (stepIdx < currentIdx) return 'done'
  if (stepIdx === currentIdx) return 'active'
  return 'pending'
}

/* ─── Theme hook ─── */
function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved) return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggle = () => setTheme(t => t === 'light' ? 'dark' : 'light')
  return { theme, toggle }
}

export default function App() {
  const { theme, toggle: toggleTheme } = useTheme()
  const [stage, setStage] = useState('idle')
  const [fileName, setFileName] = useState('')
  const [extraction, setExtraction] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [error, setError] = useState('')

  const reset = () => {
    setStage('idle')
    setFileName('')
    setExtraction(null)
    setAnalysis(null)
    setError('')
  }

  const handleFile = useCallback(async (file) => {
    reset()
    setFileName(file.name)
    setStage('extracting')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const extractRes = await axios.post(`${API_BASE}/extract`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setExtraction(extractRes.data)
      setStage('analyzing')

      const analyzeRes = await axios.post(`${API_BASE}/analyze`, {
        text: extractRes.data.text,
      })
      setAnalysis(analyzeRes.data)
      setStage('done')
    } catch (err) {
      const message = err?.response?.data?.detail || err.message || 'Something went wrong.'
      setError(message)
      setStage('error')
    }
  }, [])

  const handleUrl = useCallback(async (url) => {
    reset()
    setFileName(url.split('/').pop()?.split('?')[0] || 'Cloud file')
    setStage('extracting')

    try {
      const extractRes = await axios.post(`${API_BASE}/extract-url`, { url })
      setExtraction(extractRes.data)
      setStage('analyzing')

      const analyzeRes = await axios.post(`${API_BASE}/analyze`, {
        text: extractRes.data.text,
      })
      setAnalysis(analyzeRes.data)
      setStage('done')
    } catch (err) {
      const message = err?.response?.data?.detail || err.message || 'Something went wrong.'
      setError(message)
      setStage('error')
    }
  }, [])

  const showPipeline = stage !== 'idle'

  return (
    <>
      {/* Theme toggle */}
      <button
        className="theme-toggle"
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      >
        {theme === 'light' ? '🌙' : '☀️'}
      </button>

      {/* Animated background */}
      <div className="bg-layer" aria-hidden="true">
        <div className="bg-grid" />
        <div className="bg-orb bg-orb--1" />
        <div className="bg-orb bg-orb--2" />
        <div className="bg-orb bg-orb--3" />
      </div>

      <div className="app">
        <header className="header">
          <div className="header-badge">
            <span className="header-badge-dot" />
            AI-Powered Document Analysis
          </div>
          <h1 className="header-title">Social Media Content Analyzer</h1>
          <p className="header-sub">
            Upload a post as a PDF or image — get the text extracted and
            engagement-ready suggestions, instantly.
          </p>
        </header>

        {showPipeline && (
          <nav className="pipeline" aria-label="Processing steps">
            {STEPS.map((step, i) => {
              const state = getStepState(stage, step.key)
              return (
                <div key={step.key} style={{ display: 'flex', alignItems: 'center' }}>
                  {i > 0 && (
                    <div
                      className={`pipeline-connector ${
                        state === 'done' || state === 'active' ? 'pipeline-connector--active' : ''
                      }`}
                    />
                  )}
                  <div className={`pipeline-step pipeline-step--${state}`}>
                    <div className="pipeline-step-icon">{step.icon}</div>
                    <span>{step.label}</span>
                  </div>
                </div>
              )
            })}
          </nav>
        )}

        <main className="main">
          <FileUpload
            onFile={handleFile}
            onUrl={handleUrl}
            stage={stage}
            fileName={fileName}
            onReset={reset}
          />

          {stage === 'error' && (
            <div className="error-banner" role="alert">
              <span className="error-banner-label">✕ Extraction failed</span>
              <span>{error}</span>
            </div>
          )}

          {(stage === 'analyzing' || stage === 'done') && extraction && (
            <ResultsPanel extraction={extraction} analysis={analysis} stage={stage} />
          )}
        </main>

      </div>
    </>
  )
}
