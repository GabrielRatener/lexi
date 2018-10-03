
// Not a test suite or anything, just an informal test script

import Lexer from "./index"

const text = `
	12 + 987 + baby %is %exyaession
	a b c %yello 77 + 9 -
`;

const lexer = new Lexer([
	{regex: /[\*\/\+\-\^]/},
	{regex: /[ \t\n]+/, type: 'ws'},
	{regex: /[a-z]+/, type: 'id'},
	{regex: /[0-9]+/, type: 'int'},
	{
		regex: /\%[a-z]+/,
		type: (val) => val.slice(1),
		test(ctxt) {
			return ctxt.match.includes('ya');
		}
	},
	{
		regex: /\%[a-z]+/,
		type: 'invalid'
	}
]);

for (let {type, value} of lexer.tokenize(text)) {
	console.log(type, value);
}