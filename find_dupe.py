import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('www/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Find both dmModal occurrences
first = text.find('id="dmModal"')
second = text.find('id="dmModal"', first + 1)

print(f'First dmModal at char {first}')
print(f'Second dmModal at char {second}')

# Show context around each
print('\n=== First dmModal context ===')
print(text[max(0,first-50):first+200])
print('\n=== Second dmModal context ===')
print(text[max(0,second-50):second+200])

# Find which one to keep - the one before </body> is the one we just inserted (good)
# The other one is the old broken one
body_pos = text.find('</body>')
print(f'\n</body> at char {body_pos}')
print(f'First dmModal before body: {first < body_pos}')
print(f'Second dmModal before body: {second < body_pos}')
