Web interface with a simple way to paste or drag in a wordle score
button to start processing
done locally in JS or webassembly

creates a graph

when the user clicks on a starting word it can only show the paths from that word
- for example, i know some people who use the same first word each time and this can help find a more probably path they took

show a warning that the parsed day wordle word will be spoiled!

do nothing if
- no hard mode enabled
- guess was made in a single attempt 1/6

make a twitter bot that crawls for wordle tweets and replies to them or can be invoked in the replies of a tweet to reply with the most common guess prediction and a link to the webpage for it.

maybe allow some regex filtering for each guess.
- for example i think my friend sean always guesses a plural on the second attempt, which means the last letter will be an S
- ....S will filter the graph down to only paths that include this extra little hint i have

set a min and a max for each letter.
- the minimum for each letter starts at 0 since...
- the maximum for each letter should be 5, but we can further narrow this down by finding the word with the most of that letter in it and using that count. idk if this will help speed things up, and i doubt it will make the option pool shrink. but it could be done :P
