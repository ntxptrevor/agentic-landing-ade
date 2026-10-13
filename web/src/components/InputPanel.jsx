import React, { useState, useRef, useCallback } from 'react';
import { WORKFLOWS, classifyInput, extractActions, jevDecisionTree } from '../utils/jevEngine.js';
import { processFileText, parseMeetingTranscript, parseEmail, parseSubQuote, parseScopeDescription, parseDailyReport, parseChangeOrder, parseGeneral } from '../utils/inputProcessors.js';

const PROCESSORS = {
  meeting_transcript: parseMeetingTranscript,
  email: parseEmail,
  sub_quote: parseSubQuote,
  scope_description: parseScopeDescription,
  daily_report: parseDailyReport,
  change_order: parseChangeOrder,
  rfi: parseChangeOrder,
  general: parseGeneral,
  note: parseGeneral,
  text_message: parseGeneral,
  inspection: parseDailyReport,
  submittal: parseGeneral,
  schedule_update: parseGeneral,
};

export default function InputPanel({ project, onApplyProposals }) {
  const [textInput, setTextInput] = useState('');
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [proposals, setProposals] = useState([]);
  const [accepted, setAccepted] = useState(new Set());
  const [processLog, setProcessLog] = useState([]);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef(null);

  const addLog = (msg) => setProcessLog(prev => [...prev, { time: new Date().toLocaleTimeString(), msg }]);

  const processInput = useCallback(async (text, inputType) => {
    setProcessing(true);
    setProposals([]);
    setAccepted(new Set());
    setProcessLog([]);

    addLog(`Classifying input... detected: ${inputType || 'auto'}`);

    const resolvedType = inputType || classifyInput(text);
    addLog(`Input type: ${resolvedType}`);

    const processor = PROCESSORS[resolvedType] || parseGeneral;
    const { lines, metadata } = processor(text);
    addLog(`Parsed ${lines.length} actionable lines`);

    if (metadata.vendor) addLog(`Vendor: ${metadata.vendor}`);
    if (metadata.from) addLog(`From: ${metadata.from}`);
    if (metadata.subject) addLog(`Subject: ${metadata.subject}`);

    const actions = extractActions(lines.join('\n'), resolvedType);
    addLog(`Extracted ${actions.length} potential actions`);

    const props = jevDecisionTree(actions, project.wbs);
    addLog(`JEV decision tree produced ${props.length} proposals`);

    const critCount = props.filter(p => p.isCriticalPath).length;
    if (critCount > 0) addLog(`*** ${critCount} proposals affect critical path — review required`);

    setProposals(props);
    setProcessing(false);
  }, [project.wbs]);

  const handleTextSubmit = () => {
    if (!textInput.trim()) return;
    processInput(textInput.trim(), selectedWorkflow?.inputType);
  };

  const handleFileDrop = async (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await processFileText(file);
      processInput(text, selectedWorkflow?.inputType);
    } catch {
      addLog('Error reading file');
      setProcessing(false);
    }
  };

  const toggleAccept = (idx) => {
    setAccepted(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const acceptAll = () => setAccepted(new Set(proposals.map((_, i) => i)));

  const applyAccepted = () => {
    const toApply = proposals.filter((_, i) => accepted.has(i));
    onApplyProposals(toApply);
    addLog(`Applied ${toApply.length} changes to schedule`);
    setProposals([]);
    setAccepted(new Set());
  };

  const severityColor = (sev) => {
    if (sev === 'high') return 'var(--critical)';
    if (sev === 'medium') return 'var(--warning)';
    if (sev === 'info') return 'var(--accent)';
    return 'var(--text-dim)';
  };

  return (
    <div className="input-panel">
      {/* Workflow selector */}
      <div className="input-section">
        <h3>Prebuilt Workflows</h3>
        <p className="input-hint">Select a workflow to optimize parsing, or let the engine auto-detect.</p>
        <div className="workflow-grid">
          {WORKFLOWS.map(wf => (
            <button
              key={wf.id}
              className={`workflow-card ${selectedWorkflow?.id === wf.id ? 'active' : ''}`}
              onClick={() => setSelectedWorkflow(selectedWorkflow?.id === wf.id ? null : wf)}
            >
              <div className="workflow-icon">{wf.icon}</div>
              <div className="workflow-name">{wf.name}</div>
              <div className="workflow-desc">{wf.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* File upload */}
      <div className="input-section">
        <h3>File Upload</h3>
        <div
          className={`drop-zone ${dragActive ? 'active' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleFileDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,.csv,.pdf,.eml,.docx"
            style={{ display: 'none' }}
            onChange={handleFileDrop}
          />
          <div className="drop-icon">{dragActive ? 'DROP' : 'FILE'}</div>
          <div className="drop-text">
            {fileName || 'Drag & drop a file here, or click to browse'}
          </div>
          <div className="drop-formats">
            Supported: .txt, .md, .csv, .eml
            {selectedWorkflow && ` (optimized for ${selectedWorkflow.name})`}
          </div>
        </div>
      </div>

      {/* Text input */}
      <div className="input-section">
        <h3>Semantic Text Input</h3>
        <p className="input-hint">Paste or type project data — meeting notes, emails, scope descriptions, field updates, or any construction data.</p>
        <textarea
          className="text-input"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder={selectedWorkflow
            ? `Paste ${selectedWorkflow.name.toLowerCase()} content here...`
            : 'Paste any project data — the JEV engine will auto-classify and process it...'}
          rows={8}
        />
        <div className="input-actions">
          <button
            className="btn btn-primary"
            onClick={handleTextSubmit}
            disabled={!textInput.trim() || processing}
          >
            {processing ? 'Processing...' : 'Process Input'}
          </button>
          {textInput && (
            <button className="btn btn-secondary" onClick={() => { setTextInput(''); setSelectedWorkflow(null); }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Processing log */}
      {processLog.length > 0 && (
        <div className="input-section">
          <h3>JEV Processing Log</h3>
          <div className="process-log">
            {processLog.map((entry, i) => (
              <div key={i} className={`log-entry ${entry.msg.startsWith('***') ? 'warning' : ''}`}>
                <span className="log-time">{entry.time}</span>
                <span className="log-msg">{entry.msg}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Proposals */}
      {proposals.length > 0 && (
        <div className="input-section">
          <h3>Schedule Modification Proposals</h3>
          <div className="proposal-actions">
            <button className="btn btn-secondary btn-sm" onClick={acceptAll}>Select All</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setAccepted(new Set())}>Clear Selection</button>
            {accepted.size > 0 && (
              <button className="btn btn-primary btn-sm" onClick={applyAccepted}>
                Apply {accepted.size} Change{accepted.size !== 1 ? 's' : ''}
              </button>
            )}
          </div>

          <div className="proposal-list">
            {proposals.map((p, i) => (
              <div
                key={i}
                className={`proposal-card ${accepted.has(i) ? 'accepted' : ''} ${p.requiresConfirmation ? 'critical-warning' : ''}`}
                onClick={() => toggleAccept(i)}
              >
                <div className="proposal-header">
                  <span className="proposal-check">{accepted.has(i) ? '☑' : '☐'}</span>
                  <span className="proposal-action" style={{ color: severityColor(p.severity) }}>
                    {p.action.toUpperCase()}
                  </span>
                  {p.isCriticalPath && <span className="proposal-badge critical">CRITICAL PATH</span>}
                  {p.requiresConfirmation && <span className="proposal-badge warning">REQUIRES REVIEW</span>}
                  <span className="proposal-confidence">{Math.round((p.confidence || 0) * 100)}%</span>
                </div>
                <div className="proposal-body">
                  {p.taskName && <div><strong>Task:</strong> {p.taskName}</div>}
                  {p.field && <div><strong>Change:</strong> {p.field} {p.oldValue} &rarr; {p.newValue}</div>}
                  {p.phase && <div><strong>Phase:</strong> {p.phase}</div>}
                  {p.trade && <div><strong>Trade:</strong> {p.trade}</div>}
                  <div className="proposal-reason">{p.reason}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {proposals.length === 0 && processLog.length > 0 && !processing && (
        <div className="input-section">
          <div className="empty-state" style={{ padding: '24px 0' }}>
            <p>No actionable schedule modifications detected. Try providing more specific project data.</p>
          </div>
        </div>
      )}
    </div>
  );
}
