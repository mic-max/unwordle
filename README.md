WebAssembly
- 2x to 5x performance

creates a graph

attempt to parse the wordle scorecard input field onchange.
- have a button to load an example scorecard. easier testing and for people on the site just playing around with it.
- have multiple examples you can switch between

when the user clicks on a starting word it can only show the paths from that word
- for example, i know some people who use the same first word each time and this can help find a more probably path they took

do nothing if
- no hard mode enabled
- guess was made in a single attempt 1/6
- the first guess was an all gray - it will take ~8 minutes to compute and 2gb ram.

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
- there should be a pinned method for each step in the path. so for a solution that has 4 guesses before solving, there would be an input box to filter the words at that stage in the path. probably with a regex. `s....` to indicate this node's stage starts with an S
- the user should also be able to lock these pinned words in place before the computation, in which cases it might actually be possible to compute in a reasonable amount of time.

Make sure we treat letters from the user as lowercase. everything else is lowercase.

I can generate the size of each first pool for every single possible first guess pattern.
- which is 3^5=243, since each position has 3 options of tiles: green, yellow, grey. 
- only the all gray, and 1 green in all pos (5 total) and a yellow in all pos (5 total) - so 11 are actually needed?? since these will have the largest values.
- I can use this to quickly set a threshold on what pool sizes I should actually attempt to compute. (will take less than a minute on my PC)
```
Pool 1 sizes by single-tile pattern (largest = most computation):
  All gray (current): 2339
  Yellow at position 2: 1433
  Green  at position 2 (letter 'o'): 931
  Yellow at position 5: 864
  Yellow at position 4: 853
  Yellow at position 3: 707
  Yellow at position 1: 675
  Green  at position 3 (letter 'a'): 665
  Green  at position 5 (letter 'y'): 438
  Green  at position 1 (letter 't'): 234
  Green  at position 4 (letter 'd'): 124
```

cache the allowed word list? as long as it doesn't change. idk if i want to store data on my user's PC.

don't work with strings on the javascript side, instead work with the binary data
- other than converting user input to strings and the information I want to output from the 5bit format to a user readable string. then i can perform faster binary operations instead of string manipulation work which will be slower.

## Usage

1. `pip install wordfreq`
1. `python scripts/frequencies-gen.py > words.js`
1. `npm install`
1. `npm test`
1. `npm run bench`
1. `npm start`
1. `npm run serve`
1. `npm run build`
