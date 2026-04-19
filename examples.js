const devExamples = [
	{
		scorecard: `Wordle 1,763 4/6*\n\n⬛⬛🟨⬛⬛\n🟩⬛⬛⬛🟩\n🟩⬛🟩⬛🟩\n🟩🟩🟩🟩🟩`,
		path: [],
	},
	{
		scorecard: `Wordle 1,763 6/6*\n\n⬛⬛⬛⬛⬛\n⬛🟨⬛⬛⬛\n⬛⬛🟩⬛🟩\n⬛🟩🟩⬛🟩\n⬛🟩🟩⬛🟩\n🟩🟩🟩🟩🟩`,
		path: [],
	},
	{
		scorecard: `Wordle 1,764 4/6*\n\n🟩⬛⬛⬛⬛\n🟩⬛⬛⬛⬛\n🟩🟨⬛⬛⬛\n🟩🟩🟩🟩🟩`,
		path: [],
	},
    {
		scorecard: `Wordle 1,765 3/6*\n\n🟨⬛⬛⬛⬛\n🟩🟩⬛🟨⬛\n🟩🟩🟩🟩🟩`,
		path: ["thick", "stand"],
	},
];

if (typeof module !== 'undefined') module.exports = devExamples;
