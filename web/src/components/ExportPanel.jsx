import React from 'react';
import { exportJSON, exportCSV, exportMSProjectXML, downloadFile } from '../utils/exporters.js';

export default function ExportPanel({ project }) {
  const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const exports = [
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
      lines.push(`- **${task.wbsCode}** ${task.name} — ${task.duration}d — ${task.startDate} → ${task.endDate}${critical}${deps}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
