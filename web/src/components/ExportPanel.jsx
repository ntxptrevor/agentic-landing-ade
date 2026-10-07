import React, { useState } from 'react';
import { exportJSON, exportCSV, exportMSProjectXML, downloadFile } from '../utils/exporters.js';
import { buildSourceRef } from '../utils/procurementAudit.js';

const PAGE_SIZES = [
  { label: 'Letter (8.5 x 11 in)', value: 'letter', css: '8.5in 11in portrait' },
  { label: 'Legal (8.5 x 14 in)', value: 'legal', css: '8.5in 14in portrait' },
  { label: 'Tabloid (11 x 17 in)', value: 'tabloid', css: '11in 17in landscape' },
  { label: 'A4 (210 x 297 mm)', value: 'a4', css: '210mm 297mm portrait' },
];

export default function ExportPanel({ project }) {
  const [pageSize, setPageSize] = useState('letter');
  const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const handlePrintPDF = () => {
    const selected = PAGE_SIZES.find(p => p.value === pageSize);
    const style = document.createElement('style');
    style.id = 'print-page-override';
    style.textContent = `@page { size: ${selected.css}; }`;
    document.head.appendChild(style);

    const printView = document.getElementById('print-schedule-view');
    if (printView) printView.style.display = 'block';

    const header = document.createElement('div');
    header.className = 'print-header';
    header.innerHTML = `<h1>WBS Schedule: ${project.name}</h1><div class="subtitle">${project.startDate} to ${project.endDate} | ${project.workingDuration || '—'} working days | Generated ${new Date().toLocaleDateString()}</div>`;
    document.body.prepend(header);

    window.print();

    header.remove();
    style.remove();
    if (printView) printView.style.display = 'none';
  };

  const exports = [
    {
      format: 'Print / PDF',
      desc: 'Print or save as editable PDF with vector elements',
      icon: 'PDF',
      action: handlePrintPDF,
    },
    {
      format: 'JSON',
      desc: 'Re-importable BidForge schedule data',
      icon: '{ }',
      action: () => downloadFile(exportJSON(project), `${slug}-schedule.json`, 'application/json'),
    },
    {
      format: 'CSV',
      desc: 'Spreadsheet-compatible flat table',
      icon: 'CSV',
      action: () => downloadFile(exportCSV(project), `${slug}-schedule.csv`, 'text/csv'),
    },
    {
      format: 'MS Project XML',
      desc: 'Import into Microsoft Project',
      icon: 'XML',
      action: () => downloadFile(exportMSProjectXML(project), `${slug}-schedule.xml`, 'application/xml'),
    },
    {
      format: 'Markdown',
      desc: 'Readable schedule document',
      icon: 'MD',
      action: () => {
        const md = generateMarkdown(project);
        downloadFile(md, `${slug}-schedule.md`, 'text/markdown');
      },
    },
  ];

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>Export Schedule</h3>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Document Size</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PAGE_SIZES.map(ps => (
            <button
              key={ps.value}
              className={`btn ${pageSize === ps.value ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPageSize(ps.value)}
              style={{ fontSize: '0.75rem' }}
            >
              {ps.label}
            </button>
          ))}
        </div>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: 8 }}>
          Print/PDF uses browser print dialog. Text, tables, bars, and fields export as separate editable vector elements.
        </p>
      </div>

      <div className="export-grid">
        {exports.map(exp => (
          <div key={exp.format} className="export-card" onClick={exp.action}>
            <div className="icon" style={{ fontFamily: 'var(--font)', fontWeight: 700 }}>
              {exp.icon}
            </div>
            <div className="format">{exp.format}</div>
            <div className="desc">{exp.desc}</div>
          </div>
        ))}
      </div>

      <div id="print-schedule-view" style={{ display: 'none' }}>
        <PrintableSchedule project={project} />
      </div>
    </div>
  );
}

function PrintableSchedule({ project }) {
  return (
    <div className="list-view">
      {project.wbs.map(phase => (
        <div key={phase.id} className="list-phase">
          <div className="list-phase-header">
            {phase.wbsCode}. {phase.name}
            <span className="list-phase-dates">{phase.startDate || '—'} — {phase.endDate || '—'}</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '4px 8px', width: 60 }}>WBS</th>
                <th style={{ textAlign: 'left', padding: '4px 8px' }}>Task</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', width: 50 }}>Dur</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', width: 90 }}>Start</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', width: 90 }}>End</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', width: 70 }}>Category</th>
              </tr>
            </thead>
            <tbody>
              {(phase.children || []).map(task => {
                const catStyle = task.category === 'deliverable' ? { color: 'var(--deliverable)', fontWeight: 700 }
                  : task.category === 'delivery' ? { color: 'var(--delivery)', fontWeight: 700 }
                  : task.category === 'procurement' ? { color: 'var(--procurement)', fontWeight: 700 }
                  : {};
                return (
                  <tr key={task.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '3px 8px', color: 'var(--text-dim)' }}>{task.wbsCode}</td>
                    <td style={{ padding: '3px 8px', ...catStyle }}>{task.name}{task.isCritical ? ' *' : ''}</td>
                    <td style={{ padding: '3px 8px' }}>{task.duration}d</td>
                    <td style={{ padding: '3px 8px', color: 'var(--text-dim)' }}>{task.startDate || '—'}</td>
                    <td style={{ padding: '3px 8px', color: 'var(--text-dim)' }}>{task.endDate || '—'}</td>
                    <td style={{ padding: '3px 8px', ...catStyle, fontSize: '0.7rem' }}>{task.category || 'activity'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function generateMarkdown(project) {
  const lines = [];
  lines.push(`# WBS Schedule: ${project.name}`);
  lines.push(`**Start:** ${project.startDate} | **End:** ${project.endDate} | **Duration:** ${project.workingDuration} working days\n`);

  for (const phase of project.wbs) {
    lines.push(`## ${phase.wbsCode}. ${phase.name}`);
    lines.push(`**Start:** ${phase.startDate || '—'} | **End:** ${phase.endDate || '—'}\n`);

    for (const task of phase.children || []) {
      const critical = task.isCritical ? ' [CRITICAL]' : '';
      const deps = task.predecessors?.length > 0 ? ` (dep: ${task.predecessors.join(', ')})` : '';
      const cat = task.category && task.category !== 'activity' ? ` [${task.category.toUpperCase()}]` : '';
      const refStr = buildSourceRef(task);
      const refOut = refStr ? ` (${refStr})` : '';
      lines.push(`- **${task.wbsCode}** ${task.name} — ${task.duration}d — ${task.startDate} → ${task.endDate}${critical}${cat}${deps}${refOut}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
