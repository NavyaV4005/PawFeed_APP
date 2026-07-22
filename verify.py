import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('www/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

checks = [
    ('addMarketItemModal', text.count('id="addMarketItemModal"')),
    ('dmModal', text.count('id="dmModal"')),
    ('marketSearch', text.count('id="marketSearch"')),
    ('miName', text.count('id="miName"')),
    ('dmChatList', text.count('id="dmChatList"')),
    ('dmInput', text.count('id="dmInput"')),
    ('body close', text.count('</body>')),
    ('html close', text.count('</html>')),
]

for name, count in checks:
    status = 'OK' if count == 1 else 'PROBLEM'
    print(f'{status}: {name} = {count}')
