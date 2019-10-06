
import tape from "tape"
import Lexer from "./index"

tape('Basic Lexing', (t) => {

	t.plan(4);

	{
		const string = `12 + baby %is %exyaession`;
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

		const tokens = Array.from(lexer.tokenize(string));

		t.equal(tokens[0].type, 'int');
		t.equal(tokens[0].string, '12');

		t.equal(tokens[6].type, 'invalid');
		t.equal(tokens[6].string, '%is');
	}
});

tape('Tokens with custom values', (t) => {

	t.plan(4);

	{
		const string = `baby + 12 food`;
		const lexer = new Lexer([
			{regex: /[\*\/\+\-\^]/},
			{regex: /[ \t\n]+/, type: 'ws'},
			{regex: /[a-z]+/, type: 'id'},
			{
				regex: /[0-9]+/,
				type: 'int',
				value({match}) {
					return parseInt(match, 10);
				}
			}
		]);

		const tokens = Array.from(lexer.tokenize(string));

		t.equal(tokens[4].type, 'int');
		t.equal(tokens[4].string, '12');
		t.equal(typeof tokens[4].value, 'number');
		t.equal(tokens[4].value, 12);
	}
});

tape('Multi-state Lexing', (t) => {
	t.plan(10);

	{
		// lex scaled down html/jsx syntax
		const lexer = new Lexer({
			states: {
				'start': [
					{
						regex: /[^\<\>\{\}]+/,
						type: 'text'
					},
					{
						regex: /\{[a-z]+\}/,
						type: 'expression'
					},
					{
						regex: /\</,
						before(api) {
							api.pushState('tag');
							api.abort();
						}
					}
				],
				"tag": [
					{
						regex: /[\<\>\/]/,
						after(api) {
							if (api.token.type === '>') {
								api.popState();
							}
						}
					},
					{
						regex: /[a-zA-Z]+/,
						type: 'id'
					}
				]
			}
		});
	
		const string = '<hello>this is some {random} text</hello>';
		const tokens = Array.from(lexer.tokenize(string));

		t.equals(tokens[0].type, '<');
		t.equals(tokens[0].value, '<');
		t.equals(tokens[3].type, 'text');
		t.equals(tokens[3].value, 'this is some ');

		t.equals(tokens[4].type, 'expression');
		t.equals(tokens[4].value, '{random}');
		t.equals(tokens[5].type, 'text');
		t.equals(tokens[5].value, ' text');

		t.equals(tokens[7].type, '/');
		t.equals(tokens[7].value, '/');
	}
});