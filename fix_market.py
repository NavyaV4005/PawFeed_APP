import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('www/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Add marketplace button and search bar before marketProductsBox
target = '<div id="marketProductsBox"></div>'
replacement = '''<button class="primary-btn" style="margin-bottom:12px" onclick="openAddMarketItemModal()">+ Add New Item</button>
          <input id="marketSearch" type="text" placeholder="Search items..." oninput="renderMarketplace()" style="margin-bottom:10px">
          <div id="marketProductsBox"></div>'''

if target in text:
    text = text.replace(target, replacement)
    with open('www/index.html', 'w', encoding='utf-8') as f:
        f.write(text)
    print('Added marketplace button and search bar')
else:
    print('Could not find marketProductsBox target')
