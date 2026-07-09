import { useEffect, useState, useRef } from 'react'

/* ─── Animated counter hook ─── */
function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    if (target == null || typeof target !== 'number') { setValue(target); return }
    const start = 0
    const startTime = performance.now()

    function tick(now) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setValue(Math.round(start + (target - start) * eased))
      if (progress < 1) ref.current = requestAnimationFrame(tick)
    }

    ref.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(ref.current)
  }, [target, duration])

  return value
}

/* ─── Readability ring ─── */
function ReadabilityRing({ score }) {
  const radius = 30
  const circumference = 2 * Math.PI * radius
  const safeScore = score ?? 0
  const pct = Math.max(0, Math.min(100, safeScore)) / 100
  const offset = circumference * (1 - pct)
  const animatedScore = useCountUp(safeScore, 1000)

  let color, level, desc
  if (safeScore >= 60) {
    color = '#34d399'; level = 'Easy'; desc = 'Clear and accessible to most readers'
  } else if (safeScore >= 40) {
    color = '#f59e0b'; level = 'Moderate'; desc = 'May challenge some readers'
  } else {
    color = '#ef4444'; level = 'Difficult'; desc = 'Consider simplifying for broader reach'
  }

  return (
    <div className="glass-panel readability-card">
      <div className="readability-ring-wrapper">
        <svg className="readability-ring" viewBox="0 0 68 68">
          <circle className="readability-ring-bg" cx="34" cy="34" r={radius} />
          <circle
            className="readability-ring-fill"
            cx="34" cy="34" r={radius}
            stroke={color}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="readability-ring-value">{animatedScore}</div>
      </div>
      <div className="readability-info">
        <span className="panel-label panel-label--sky">
          <span className="panel-label-icon">📊</span> Readability
        </span>
        <span className="readability-level" style={{ color }}>{level}</span>
        <span className="readability-desc">{desc}</span>
      </div>
    </div>
  )
}

/* ─── Platform fit bars ─── */
const PLATFORM_DISPLAY = {
  twitter: { icon: '𝕏', label: 'Twitter / X' },
  instagram: { icon: '📸', label: 'Instagram' },
  linkedin: { icon: '💼', label: 'LinkedIn' },
  facebook: { icon: '📘', label: 'Facebook' },
}

function PlatformFit({ platformFit, charCount }) {
  return (
    <div className="glass-panel">
      <div className="panel-header">
        <span className="panel-label panel-label--pink">
          <span className="panel-label-icon">📱</span> Platform Fit
        </span>
      </div>
      <div className="platform-section">
        {Object.entries(platformFit).map(([platform, data]) => {
          const pct = Math.min((charCount / data.limit) * 100, 100)
          const ratio = charCount / data.limit
          let fillClass, statusClass, statusText
          if (ratio <= 0.8) {
            fillClass = 'platform-fill--good'
            statusClass = 'platform-status--good'
            statusText = '✓ Good'
          } else if (ratio <= 1) {
            fillClass = 'platform-fill--ok'
            statusClass = 'platform-status--ok'
            statusText = '⚠ Tight'
          } else {
            fillClass = 'platform-fill--over'
            statusClass = 'platform-status--over'
            statusText = '✕ Over'
          }
          const display = PLATFORM_DISPLAY[platform] || { icon: '🌐', label: platform }

          return (
            <div className="platform-bar" key={platform}>
              <span className="platform-name">{display.icon} {display.label}</span>
              <div className="platform-track">
                <div className={`platform-fill ${fillClass}`} style={{ width: `${pct}%` }} />
              </div>
              <span className={`platform-status ${statusClass}`}>{statusText}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Skeleton loader ─── */
function SkeletonPanel() {
  return (
    <div className="glass-panel panel-loading">
      <div className="skeleton-group">
        <div className="skeleton-line" />
        <div className="skeleton-line" />
        <div className="skeleton-line" />
      </div>
    </div>
  )
}

/* ─── Main ResultsPanel ─── */
export default function ResultsPanel({ extraction, analysis, stage }) {
  const rb = analysis?.rule_based
  const ai = analysis?.ai

  const wordCount = useCountUp(rb?.word_count, 700)
  const charCount = useCountUp(rb?.char_count, 700)
  const hashtagCount = useCountUp(rb?.hashtag_count, 500)
  const emojiCount = useCountUp(rb?.emoji_count, 500)

  return (
    <section className="results">
      {/* Extracted text panel */}
      <div className="glass-panel">
        <div className="panel-header">
          <span className="panel-label panel-label--violet">
            <span className="panel-label-icon">📝</span> Extracted Text
          </span>
          <span className="panel-meta">
            {extraction.method === 'ocr' ? '🔍 via OCR' : '📄 direct extraction'} · {extraction.page_count} page{extraction.page_count === 1 ? '' : 's'}
          </span>
        </div>
        <pre className="extracted-text">{extraction.text}</pre>
      </div>

      {/* Loading state */}
      {stage === 'analyzing' && <SkeletonPanel />}

      {/* Results */}
      {stage === 'done' && rb && (
        <>
          {/* Metrics grid */}
          <div className="metrics-grid">
            <Metric label="Words" value={wordCount} />
            <Metric label="Characters" value={charCount} />
            <Metric label="Hashtags" value={hashtagCount} icon="🏷️" />
            <Metric label="Emojis" value={emojiCount} icon="😊" />
            <Metric
              label="Has CTA"
              value={rb.has_call_to_action ? 'Yes' : 'No'}
              accent={rb.has_call_to_action}
              icon={rb.has_call_to_action ? '✓' : '✗'}
            />
            <Metric
              label="Hashtags Found"
              value={rb.hashtags_found?.length || 0}
              icon="#"
            />
          </div>

          {/* Readability ring */}
          {rb.readability_score != null && (
            <ReadabilityRing score={rb.readability_score} />
          )}

          {/* Platform fit */}
          {rb.platform_fit && (
            <PlatformFit platformFit={rb.platform_fit} charCount={rb.char_count} />
          )}

          {/* Quick tips */}
          <div className="glass-panel">
            <div className="panel-header">
              <span className="panel-label panel-label--amber">
                <span className="panel-label-icon">💡</span> Quick Tips
              </span>
            </div>
            <ul className="tip-list">
              {rb.rule_based_tips.length === 0 && (
                <li className="tip-item tip-good">Looks solid — no immediate issues found.</li>
              )}
              {rb.rule_based_tips.map((tip, i) => (
                <li key={i} className="tip-item">{tip}</li>
              ))}
            </ul>
          </div>

          {/* AI suggestions */}
          <div className="glass-panel">
            <div className="panel-header">
              <span className="panel-label panel-label--coral">
                <span className="panel-label-icon">✦</span> AI Suggestions
              </span>
            </div>
            {!ai?.available && (
              <p className="ai-unavailable">{ai?.message || 'AI suggestions unavailable.'}</p>
            )}
            {ai?.available && (
              <div className="ai-content">
                <div className="ai-row">
                  <span className="ai-row-label">Detected Tone</span>
                  <span className="ai-tone">{ai.tone}</span>
                </div>

                {ai.rewritten_hook && (
                  <div className="ai-row">
                    <span className="ai-row-label">Suggested Hook</span>
                    <div className="ai-hook">"{ai.rewritten_hook}"</div>
                  </div>
                )}

                {ai.suggested_hashtags?.length > 0 && (
                  <div className="ai-row">
                    <span className="ai-row-label">Suggested Hashtags</span>
                    <div className="hashtag-chips">
                      {ai.suggested_hashtags.map((h, i) => (
                        <span key={i} className="hashtag-chip">#{h}</span>
                      ))}
                    </div>
                  </div>
                )}

                {ai.improvement_suggestions?.length > 0 && (
                  <div className="ai-row">
                    <span className="ai-row-label">Improvement Ideas</span>
                    <ul className="tip-list">
                      {ai.improvement_suggestions.map((s, i) => (
                        <li key={i} className="tip-item tip-ai">{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}

/* ─── Metric card ─── */
function Metric({ label, value, accent, icon }) {
  const isText = typeof value === 'string'
  return (
    <div className={`metric-card ${accent ? 'metric-accent' : ''}`}>
      {icon && <div style={{ fontSize: '18px', marginBottom: '4px' }}>{icon}</div>}
      <div 
        className={`metric-value ${accent ? 'metric-value--gradient' : ''}`}
        style={isText ? { fontSize: '22px', letterSpacing: '0.02em', marginTop: icon ? '0' : '8px' } : {}}
      >
        {value}
      </div>
      <div className="metric-label">{label}</div>
    </div>
  )
}
