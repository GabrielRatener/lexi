
/****************************
 * A lexer in under 350 lines of code
 * Dunno why, but felt like sharing
 ****************************/
export default class Lexer {
    constructor(settings) {
        const states =
          Array.isArray(settings) ?
            {start: settings} :
            settings.states;

        this.states =
          Object.entries(states)
            .reduce((map, [name, patterns]) => {
                map.set(name, patterns);

                return map;
            }, new Map());

        this._regexes = new Map(/* state => pattern list */);
        this._cache = new Map();

        for (const state of this._getStates()) {
            const patterns = this.states.get(state);

            this._regexes.set(state, this._getRegex(patterns));
        }
    }
    
    _getStateRegex(state = 'start') {
        const patterns = this.states.get(state);

        return this._getRegex(patterns);
    }

    _getRegex(patterns) {
        let i = 0, concatenation = "";
        for (let {regex} of patterns) {
            if (i > 0)
                concatenation += '|';
            if (typeof regex === "string")
                concatenation += `(${regex})`;
            else
                concatenation += `(${regex.source})`;
            i++;
        }

        return `(?:${concatenation})`;
    }
    
    _getRemainingRegex(index, state = 'start', cache = this._cache) {
        const key = `${state}-${index}`;

        if (cache.has(key)) {
            return cache.get(key);
        } else {
            const patterns = this.states.get(state);
            const source = this._getRegex(patterns.slice(index + 1));
            const regex = new RegExp(source, 'y');
                        
            cache.set(key, regex);
            
            return regex;
        }
    }
    
    _match(regex, input, getContext, state = 'start', oldgex = regex) {
        let index = regex.lastIndex;
        let match = regex.exec(input);
        
        if (match === null)
            return -1;

        for (let i = 1; i < match.length; i++) {
            if (match[i] !== undefined) {
                
                const pattern = this._getPattern(state, i - 1);
                
                if (pattern.test && !pattern.test(getContext(match[i], index))) {
                    const newgex = this._getRemainingRegex(i - 1, state);
                    newgex.lastIndex = index;
                    return i + this._match(newgex, input, getContext, state, oldgex);
                } else {
                    oldgex.lastIndex = regex.lastIndex;
                    return i - 1;
                }
            }
        }

        return -1;
    }
    
    * _getStates() {
        for (const key in this.states) {
            if (this.states.hasOwnProperty(key)) {
                yield key;
            }
        }
    }

    token({type, value}, source = "", range = [0, 0]) {
        // overwrite this to change default behavior

        return {
            type,
            value,
            range,
            string: source.slice(...range),

            get source() {
                return source;
            }
        }
    }

    _getPattern(state, index) {
        const patterns = this.states.get(state);

        return patterns[index];
    }

    // tokenize a complete input string
    * tokenize(str = '', start = 0) {
        const regexes = new Map();

        const token = (type, range, value = str.slice(...range)) => {
            const base = {type, value};

            return this.token(base, str, range);
        }
        
        const testContext = (match, start = 0) => Object.freeze({
            match,
            start,
            input: str,
            lexer: this,
            
            lastToken() {
                return lastToken;
            },

            get state() {
                return getState();
            }
        });

        const setStateRegex = (state = getState()) => {
            if (!regexes.has(state)) {
                const source = this._getStateRegex(state);
                const regex = new RegExp(source, 'y');

                regexes.set(state, regex);
            }

            if (regex) {
                const {lastIndex} = regex;
                
                regex = regexes.get(state);

                regex.lastIndex = lastIndex;
            } else {
                regex = regexes.get(state);
                regex.lastIndex = start;
            }            
        }

        const getState = () =>
          states.length > 0 ?
            states[states.length - 1] :
            'start';
        
        const stateControlAPI = {
            pushState(state) {
                if (state === 'start') {
                    throw new Error('Cannot push state "start"!');
                } else {
                    states.push(state);

                    setStateRegex(getState());
                }
            },
            popState() {
                if (states.length > 0) {
                    states.pop();

                    setStateRegex(getState());
                } else {
                    throw new Error('Cannot pop state');
                }
            }
        }

        // the state stack
        const states = [];

        let lastToken = null;
        let i = start;
        let regex = null;

        setStateRegex('start');

        while (i < str.length) {
            const start = regex.lastIndex;

            const index = this._match(regex, str, testContext, getState());
            if (index < 0) {
                throw new Error("No valid matches found!");

            } else {
                const match = str.slice(start, regex.lastIndex);            
                const pattern = this._getPattern(getState(), index);

                const sharedAPI = {
                    input: str,
                    lexer: this,

                    get match() {
                        return match;
                    },
                    get state() {
                        return getState();
                    },
                    get position() {
                        return i;
                    }
                }

                let value;
                let abort = false;

                if (pattern.before) {
                    const api = {
                        ...sharedAPI,

                        ...stateControlAPI,

                        abort() {
                            abort = true;
                        }
                    }

                    pattern.before(api);
                }

                if (abort) {
                    i = start;
                    regex.lastIndex = start;

                    continue;
                }

                i = regex.lastIndex;

                if (pattern.fetch) {
                    const getVal = () => str.slice(start, i);
                    const context = Object.freeze({
                        ...sharedAPI,

                        advanceTo(index) {
                            if (index < i) {
                                throw new Error("Cannot advance backwards!");
                            } else {
                                i = index;
                            }
                        },
                        next() {
                            const val = this.peek();

                            this.advanceTo(i + 1);

                            return val;
                        },
                        peek() {
                            if (i < str.length)
                                return str[i];
                            else
                                return null;
                        },
                        back(n = 1) {
                            if (i - n < regex.lastIndex) {
                                throw new Error('Cannot back up before start of string');
                            } else {
                                i -= n;
                            }
                        }
                    });

                    pattern.fetch(context, getVal);
                }

                if (pattern.value) {
                    const api = {
                        ...sharedAPI
                    }

                    value = pattern.value(api);
                }

                {
                    let resolvedType;
                    switch(typeof pattern.type) {
                        case "undefined":
                            resolvedType = match;
                            break;
                        case "string":
                            resolvedType = pattern.type;
                            break;
                        case "function":
                            resolvedType = pattern.type(match);
                            break;
                    }

                    lastToken = (value === undefined) ?
                        token(resolvedType, [start, i]) :
                        token(resolvedType, [start, i], value);
                    yield lastToken;

                    if (pattern.after) {
                        const api = {
                            ...sharedAPI,
                            ...stateControlAPI,

                            get token() {
                                return lastToken;
                            }
                        }

                        pattern.after(api);
                    }   
                }

                regex.lastIndex = i;
            }
        }
    }
}

// to circumnavigate class import bug in node
export const createLexer = (...args) => {
    return new Lexer(...args);
}
