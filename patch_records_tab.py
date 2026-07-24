import re

def main():
    # 1. Update app.js
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # Remove the appendChild logic for recordsTab
    js = js.replace("""          const box = document.getElementById('comboInner-social-records');
          const tab = document.getElementById('recordsTab');
          if (box && tab) {
            box.appendChild(tab);
            tab.classList.remove('hidden');
          }""", "")
          
    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)
        
    # 2. Update index.html
    with open('www/index.html', 'r', encoding='utf-8') as f:
        html = f.read()
        
    # Extract the recordsTab section
    records_tab_match = re.search(r'(      <!-- RECORDS TAB -->\s*<div id="recordsTab" class="screen tab-screen hidden">.*?\s*</div>)', html, re.DOTALL)
    if records_tab_match:
        records_tab_html = records_tab_match.group(1)
        
        # Remove it from its current location
        html = html.replace(records_tab_html, "")
        
        # Strip the top-level <div id="recordsTab" class="screen tab-screen hidden"> and closing div
        # Actually, we can just remove `class="screen tab-screen hidden"` so it renders normally inside the combo.
        inner_html = records_tab_html.replace('class="screen tab-screen hidden"', '')
        
        # Insert it into comboInner-social-records
        target = '<div id="comboInner-social-records" style="display:none"></div>'
        replacement = f'<div id="comboInner-social-records" style="display:none">\n{inner_html}\n        </div>'
        html = html.replace(target, replacement)
        
        with open('www/index.html', 'w', encoding='utf-8') as f:
            f.write(html)
            
        print("HTML and JS patched successfully.")
    else:
        print("Error: Could not find recordsTab in index.html")

if __name__ == '__main__':
    main()
