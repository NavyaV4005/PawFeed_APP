import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('www/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Find the first dmModal block and remove it
first_start = text.find('<!-- DIRECT MESSAGES MODAL -->')
if first_start == -1:
    first_start = text.find('<div id="dmModal"')

if first_start != -1:
    # Find the end of this modal block by counting div nesting
    # Start from the <div id="dmModal"
    div_start = text.find('<div id="dmModal"', first_start)
    depth = 0
    i = div_start
    block_end = -1
    while i < len(text):
        if text[i:i+4] == '<div':
            depth += 1
        elif text[i:i+6] == '</div>':
            depth -= 1
            if depth == 0:
                block_end = i + 6
                break
        i += 1
    
    if block_end != -1:
        # Also include the comment before it
        actual_start = first_start if text[first_start:first_start+4] == '<!--' else div_start
        removed = text[actual_start:block_end]
        text = text[:actual_start] + text[block_end:]
        
        # Verify we still have the second dmModal
        if 'id="dmModal"' in text:
            with open('www/index.html', 'w', encoding='utf-8') as f:
                f.write(text)
            print(f'Removed first (old) dmModal block ({len(removed)} chars)')
        else:
            print('ERROR: Would remove all dmModals! Aborting.')
    else:
        print('Could not find end of first dmModal block')
else:
    print('Could not find first dmModal')
