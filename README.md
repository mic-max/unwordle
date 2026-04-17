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

it would be rare for someone to guess a word with double letters in the beginning of the game
- less rare as it progresses

rank each path as being good or not.
- a path that has a very poor narrowing down rate is probably less likely to be the one chosen by the user unless they performed quite bad.

maybe i should have a single json file with the key being the valid word
- then the object can be {freq: 203232, ...} and maybe I add more fields as I go

It should be quick to lookup the wordle for a given day. O(1)

There are 40,000 paths. Which words are the most common start points? For example are there 200 paths that start with the same word? that seems like it would make it a better guess for what the user actually typed out.

maybe we can offset some computation onto the server by sending more data to the user
// TODO: I could actually only ever need to compute these once and store them in a database file.
// then everyday when the new wordle is announced i add more scores.
// or maybe i can see the wordle in advance...
for example in the above we might send them the score of all accepted words for the given day they have specified.
it would take a little bit of computation to find, but would only be about 19KB of data. since there would be 14855 possible words and each one can be represented as 2 bits per letter - 10 bits each. and if we treat that as a stream of bits then we can pack it tight and not waste much data!
worth doing speed tests on super low CPU hardware to see how long that takes to generate the scores locally vs sending over internet.

generate a mermaid graph?

generate a threejs sce

my current implementation is actually more strict than the actual hard mode.

accept multiple users scores for the same day.
- show them all together in the same graph.

Better scoring/ranking
  - Weight scores by guess position (first guess matters more — it's the least constrained)
  - Use letter frequency at each position (positional bigrams) instead of just word frequency
  - Penalize words that share many letters with the answer (a skilled player would avoid "wasting" letters they already know)

Better path analysis
  - Show the top path per unique starting word (not just top 50 globally) — avoids one starter dominating the list
  - Show what percentage of paths contain each word at each position
  - Show the "most surprising" path (highest score but lowest rank, or vice versa)

Input improvements
  - Accept the actual guess words if the user knows some of them, and pin those slots — then only search the remaining unknown rows
  - Support multiple examples in one run and aggregate starter word statistics across games

Validation
  - Verify myPath is actually a valid hard-mode sequence and explain why if not (which constraint it violates)

The most practically useful next feature is probably pinning known words — if you already know one or two guesses, you can lock those and only search the rest. That would dramatically cut the path space and make the rankings much more meaningful.

add unit tests
