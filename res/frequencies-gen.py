import re
from wordfreq import zipf_frequency

with open('res/accepted.js', 'r') as f:
    content = f.read()

words = re.findall(r'"([a-z]+)"', content)

print('module.exports = {')
for i, word in enumerate(words):
    freq = zipf_frequency(word, 'en')
    comma = ',' if i < len(words) - 1 else ''
    print(f'  "{word}": {freq}{comma}')
print('};')
