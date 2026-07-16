import React from 'react';

/**
 * Parses markdown context text, identifies markdown table syntax (lines starting/ending with |),
 * and renders them as beautiful React HTML tables. Non-table lines are rendered as paragraphs.
 */
export function renderContextWithTables(text) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let currentTable = [];
  let keyIdx = 0;

  const flushTable = () => {
    if (currentTable.length === 0) return;

    // Filter out separator rows (like |---|---| or | :--- |)
    const dataRows = currentTable.filter(row => {
      const cleaned = row.replace(/[\s|:-]/g, '');
      return cleaned.length > 0;
    });

    if (dataRows.length > 0) {
      const parsedRows = dataRows.map(row => {
        const cells = row.split('|')
          .map(c => c.trim())
          .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        return cells;
      });

      const headers = parsedRows[0] || [];
      const bodies = parsedRows.slice(1);

      elements.push(
        <div key={`table-${keyIdx++}`} style={{ overflowX: 'auto', margin: '1rem 0', borderRadius: '0.5rem', border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-tertiary)', borderBottom: '2px solid var(--border-color)' }}>
                {headers.map((h, i) => (
                  <th key={i} style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodies.map((row, rIdx) => (
                <tr 
                  key={rIdx} 
                  style={{ 
                    borderBottom: '1px solid var(--border-color)',
                    backgroundColor: rIdx % 2 === 0 ? 'var(--bg-secondary)' : 'transparent'
                  }}
                >
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    currentTable = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      currentTable.push(line);
    } else {
      if (currentTable.length > 0) {
        flushTable();
      }
      if (trimmed) {
        elements.push(
          <p key={`text-${keyIdx++}`} style={{ marginBottom: '0.75rem', lineHeight: '1.6' }}>
            {line}
          </p>
        );
      } else {
        elements.push(<div key={`space-${keyIdx++}`} style={{ height: '0.5rem' }} />);
      }
    }
  }

  if (currentTable.length > 0) {
    flushTable();
  }

  return elements;
}
