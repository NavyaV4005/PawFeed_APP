import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('www/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Extract the addMarketItemModal that's after </html>
modal_start = text.find('<div id="addMarketItemModal"')
if modal_start != -1:
    # Find the closing - count div nesting
    depth = 0
    i = modal_start
    modal_end = -1
    while i < len(text):
        if text[i:i+4] == '<div':
            depth += 1
        elif text[i:i+6] == '</div>':
            depth -= 1
            if depth == 0:
                modal_end = i + 6
                break
        i += 1
    
    if modal_end != -1:
        modal_html = text[modal_start:modal_end].strip()
        text = text[:modal_start] + text[modal_end:]
        print(f'Extracted addMarketItemModal ({len(modal_html)} chars)')
    else:
        modal_html = None
        print('Could not find modal end')
else:
    modal_html = None
    print('addMarketItemModal not found - will create fresh')

# 2. Clean up trailing whitespace after </html>
html_end = text.find('</html>')
if html_end != -1:
    text = text[:html_end + len('</html>')].rstrip() + '\n'

# 3. Build fresh modal HTML
add_market_modal = '''
    <div id="addMarketItemModal" class="modal-overlay hidden" style="z-index: 10001;" onclick="closeAddMarketItemModal()">
      <div class="modal-box" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h2 style="font-size:20px;font-weight:900;color:var(--dark)">Add Market Item</h2>
          <div class="modal-close" onclick="closeAddMarketItemModal()">&#10006;</div>
        </div>
        <label>Name</label>
        <input id="miName" type="text" placeholder="e.g. Premium Kibble">
        <label>Description</label>
        <input id="miDesc" type="text" placeholder="e.g. Protein-rich daily food">
        <label>Price (&#8377;)</label>
        <input id="miPrice" type="number" placeholder="e.g. 499">
        <label>Pet Type</label>
        <select id="miPetType">
          <option value="All">All</option>
          <option value="Dog">Dog</option>
          <option value="Cat">Cat</option>
          <option value="Bird">Bird</option>
          <option value="Rabbit">Rabbit</option>
          <option value="Fish">Fish</option>
        </select>
        <button class="primary-btn" onclick="submitMarketItem()">Save Item</button>
      </div>
    </div>'''

dm_modal = '''
    <div id="dmModal" class="modal-overlay hidden" style="z-index:10001" onclick="closeDMModal()">
      <div class="modal-box" onclick="event.stopPropagation()" style="max-height:80vh;display:flex;flex-direction:column">
        <div id="dmInboxView">
          <div class="modal-header">
            <h2 style="font-size:20px;font-weight:900">Direct Messages</h2>
            <div class="modal-close" onclick="closeDMModal()">&#10006;</div>
          </div>
          <div id="dmChatList" style="min-height:200px;overflow-y:auto"></div>
          <button class="primary-btn" onclick="showNewDMView()" style="margin-top:12px">+ New Message</button>
        </div>
        <div id="dmSearchView" class="hidden">
          <div class="modal-header">
            <button class="secondary-btn" onclick="backToInbox()" style="padding:6px 10px;font-size:12px">Back</button>
            <h2 style="font-size:18px;font-weight:900">New Message</h2>
          </div>
          <input id="dmSearchInput" placeholder="Enter username..." oninput="searchUsers()">
          <div id="dmSearchList"></div>
        </div>
        <div id="dmChatView" class="hidden" style="flex-direction:column;flex:1">
          <div class="modal-header">
            <button class="secondary-btn" onclick="backToInbox()" style="padding:6px 10px;font-size:12px">Back</button>
            <h2 id="dmChatRecipientName" style="font-size:18px;font-weight:900"></h2>
          </div>
          <div id="dmMessageList" style="flex:1;overflow-y:auto;min-height:200px;display:flex;flex-direction:column;gap:8px;padding:10px"></div>
          <div style="display:flex;gap:8px;margin-top:8px">
            <input id="dmInput" placeholder="Type a message..." style="flex:1" onkeydown="if(event.key==='Enter') sendDM()">
            <button class="primary-btn" onclick="sendDM()" style="padding:8px 16px">Send</button>
          </div>
        </div>
      </div>
    </div>'''

# 4. Insert before </body>
body_end = text.find('</body>')
if body_end != -1:
    insert_block = add_market_modal + '\n' + dm_modal + '\n'
    text = text[:body_end] + insert_block + '\n' + text[body_end:]

with open('www/index.html', 'w', encoding='utf-8') as f:
    f.write(text)

print('Successfully fixed index.html!')
