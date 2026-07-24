import re

def append_css():
    css = """
/* Pet Records Premium Styles */
.med-record-card {
    background: linear-gradient(145deg, var(--card) 0%, var(--bg) 100%);
    border-radius: 16px;
    padding: 16px;
    margin-bottom: 14px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    border: 1px solid var(--border);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    cursor: pointer;
    position: relative;
    overflow: hidden;
}

.med-record-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.08);
}

.med-record-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; width: 4px; height: 100%;
    background: linear-gradient(to bottom, var(--primary), var(--blue));
}

.med-report-card {
    background: rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(10px);
    border-radius: 16px;
    padding: 16px;
    margin-bottom: 14px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.8);
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: all 0.2s ease;
}

body.dark-mode .med-report-card {
    background: rgba(40, 40, 40, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.med-report-card:hover {
    transform: scale(1.02);
    box-shadow: 0 6px 14px rgba(0, 0, 0, 0.1);
}

.med-icon-box {
    font-size: 1.8rem;
    background: linear-gradient(135deg, var(--pill-bg) 0%, var(--bg) 100%);
    padding: 10px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: inset 0 2px 4px rgba(255,255,255,0.5);
    border: 1px solid var(--border);
}

body.dark-mode .med-icon-box {
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
}
"""
    with open('www/styles.css', 'a', encoding='utf-8') as f:
        f.write(css)

def patch_app_js():
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    record_html_old = """        html += `
        <div class="stat-card" style="margin-bottom:12px; cursor:pointer; position:relative;" onclick="editMedicalRecord(${r.id})">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <div style="font-size:1.5rem; background:var(--pill-bg); padding:8px; border-radius:12px;">${icon}</div>
                    <div>
                        <h3 style="margin:0; font-size:1.1rem; color:var(--dark);">${r.vaccine_name || r.title || 'Record'}</h3>
                        <p style="margin:0; font-size:0.85rem; color:var(--muted);">${r.date}</p>
                    </div>
                </div>
                <div>${statusBadge}</div>
            </div>
            ${r.clinic_name ? `<p style="margin:4px 0; font-size:0.9rem; color:#555;"><b>🏥 Clinic:</b> ${r.clinic_name}</p>` : ''}
            ${r.notes ? `<p style="margin:4px 0; font-size:0.9rem; color:#555;"><b>📝 Notes:</b> ${r.notes}</p>` : ''}
            ${r.next_due_date ? `<div style="margin-top:8px; padding:6px; background:${isOverdue ? '#fff1f0' : 'var(--pill-bg)'}; border-radius:6px; font-size:0.85rem; color:${isOverdue ? '#cf1322' : 'var(--dark)'};">
                <b>🗓️ Next Due:</b> ${r.next_due_date} ${isOverdue ? '(OVERDUE)' : ''}
            </div>` : ''}
        </div>`;"""

    record_html_new = """        html += `
        <div class="med-record-card" onclick="editMedicalRecord(${r.id})">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div class="med-icon-box">${icon}</div>
                    <div>
                        <h3 style="margin:0; font-size:1.1rem; color:var(--dark); font-weight: 800;">${r.vaccine_name || r.title || 'Record'}</h3>
                        <p style="margin:0; font-size:0.85rem; color:var(--muted);">${r.date}</p>
                    </div>
                </div>
                <div>${statusBadge}</div>
            </div>
            ${r.clinic_name ? `<p style="margin:6px 0 0 0; font-size:0.9rem; color:var(--text);"><b>🏥 Clinic:</b> ${r.clinic_name}</p>` : ''}
            ${r.notes ? `<p style="margin:4px 0 0 0; font-size:0.9rem; color:var(--text);"><b>📝 Notes:</b> ${r.notes}</p>` : ''}
            ${r.next_due_date ? `<div style="margin-top:10px; padding:8px 10px; background:${isOverdue ? 'rgba(207,19,34,0.1)' : 'var(--pill-bg)'}; border-radius:8px; font-size:0.85rem; color:${isOverdue ? '#cf1322' : 'var(--dark)'}; font-weight: 600; display:flex; align-items:center; gap:6px;">
                <span>🗓️ Next Due:</span> <span>${r.next_due_date} ${isOverdue ? '(OVERDUE)' : ''}</span>
            </div>` : ''}
        </div>`;"""

    report_html_old = """        html += `
        <div class="stat-card" style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; padding:12px;">
            <div style="flex:1; display:flex; align-items:center; gap:10px; cursor:pointer;" onclick="window.open('${r.file_url}', '_blank')">
                <div style="font-size:2rem; background:var(--pill-bg); padding:10px; border-radius:12px; color:var(--primary);">${fileIcon}</div>
                <div>
                    <h3 style="margin:0; font-size:1.1rem; color:var(--dark);">${r.title || 'Document'}</h3>
                    <p style="margin:0; font-size:0.85rem; color:var(--muted);">${r.upload_date} • ${r.report_type}</p>
                    ${r.notes ? `<p style="margin:4px 0 0 0; font-size:0.85rem; color:#666;">${r.notes}</p>` : ''}
                </div>
            </div>
            <button class="btn" style="background:transparent; border:none; color:#ff4d4f; font-size:1.2rem; cursor:pointer;" onclick="deleteMedicalReport(${r.id}, '${r.file_url}')">🗑️</button>
        </div>`;"""

    report_html_new = """        html += `
        <div class="med-report-card">
            <div style="flex:1; display:flex; align-items:center; gap:14px; cursor:pointer;" onclick="window.open('${r.file_url}', '_blank')">
                <div class="med-icon-box" style="color:var(--primary);">${fileIcon}</div>
                <div>
                    <h3 style="margin:0; font-size:1.1rem; color:var(--dark); font-weight: 800;">${r.title || 'Document'}</h3>
                    <p style="margin:0; font-size:0.85rem; color:var(--muted);">${r.upload_date} • <span style="background:var(--pill-bg); color:var(--dark); padding:2px 6px; border-radius:6px; font-size:0.75rem;">${r.report_type}</span></p>
                    ${r.notes ? `<p style="margin:6px 0 0 0; font-size:0.85rem; color:var(--text);">${r.notes}</p>` : ''}
                </div>
            </div>
            <button class="btn" style="background:transparent; border:none; color:#ff4d4f; font-size:1.4rem; cursor:pointer; padding: 8px; transition: transform 0.2s ease;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'" onclick="deleteMedicalReport(${r.id}, '${r.file_url}')">🗑️</button>
        </div>`;"""

    js = js.replace(record_html_old, record_html_new)
    js = js.replace(report_html_old, report_html_new)

    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

if __name__ == '__main__':
    append_css()
    patch_app_js()
    print("Styling updated successfully.")
