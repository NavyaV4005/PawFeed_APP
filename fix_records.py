import re

def main():
    with open('www/index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    target = """      <!-- RECORDS TAB -->
      <div id="recordsTab" >
        <h2 style="font-weight:900;color:var(--dark)">🏥 Pet Records</h2>
        <p class="subtitle">Manage your pet's medical history, vet appointments, and upload health reports.</p>
        
        <div class="combo-sub-tabs" style="margin-top: 15px;">
          <div class="combo-sub-tab active" id="rsub-history" onclick="switchRecordsSub('history')">📝 History</div>
        </div>
      </div>"""
      
    replacement = """      <!-- RECORDS TAB -->
      <div id="recordsTab" style="padding: 10px;">
        <h2 style="font-weight:900;color:var(--dark)">🏥 Pet Records</h2>
        <p class="subtitle">Manage your pet's medical history, vet appointments, and upload health reports.</p>
        
        <div class="combo-sub-tabs" style="margin-top: 15px;">
          <div class="combo-sub-tab active" id="rsub-history" onclick="switchRecordsSub('history')">📝 History</div>
          <div class="combo-sub-tab" id="rsub-reports" onclick="switchRecordsSub('reports')">📄 Reports</div>
        </div>
        
        <!-- Medical History Sub-tab -->
        <div id="rinner-history">
            <button class="btn btn-primary" style="width:100%;margin-bottom:15px;" onclick="openMedicalRecordModal()">+ Add Record</button>
            <div id="medicalRecordsBox"></div>
        </div>
        
        <!-- Medical Reports Sub-tab -->
        <div id="rinner-reports" style="display:none;">
            <button class="btn btn-primary" style="width:100%;margin-bottom:15px;" onclick="openMedicalReportModal()">+ Upload Report</button>
            <div id="medicalReportsBox"></div>
        </div>
      </div>
    </div>"""

    if target in html:
        html = html.replace(target, replacement)
        
        # Also clean up the orphaned fragment left earlier in the file if any exists
        # Wait, the earlier fragment was completely removed by python because it replaced records_tab_html which ended at the first </div>
        # So we just need to delete the rest of the old fragment if it's there. Let's see what's between lines 757 and 780.
        
        with open('www/index.html', 'w', encoding='utf-8') as f:
            f.write(html)
        print("Restored recordsTab!")
    else:
        print("Could not find target!")

if __name__ == '__main__':
    main()
