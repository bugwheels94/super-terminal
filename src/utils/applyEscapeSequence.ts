import stripAnsi from 'strip-ansi';

function hasEscapeSequence(string: string, sequence: string, index: number) {
	if (string.length - index < sequence.length) {
		return false;
	}
	for (let i = 0; i < sequence.length; i++) {
		if (string[index + i] !== sequence[i]) {
			return false;
		}
	}
	return true;
}
export function applyEscapeSequence(command: string) {
	let currentCommand = command;
	const hasCommandEnded = /[^\\](\r|\n)$/.test(currentCommand);
	if (!hasCommandEnded) {
		return false;
	}
	let position = 0;
	const splitByEol = currentCommand
		.split(/\r|\n/g)
		.filter((v) => v)
		.map((line) => {
			const c: string[] = [];
			for (let i = 0; i < line.length; i++) {
				if (line[i] === '\t') {
					return;
				}
				if (hasEscapeSequence(line, '\x1B[A', i)) {
					// Up arrow, ABORT ABORT! we dont know what the temrinal gave to user
					return '';
				} else if (hasEscapeSequence(line, '\x1B[C', i)) {
					// Right arrow
					position = Math.min(position + 1, c.length);
					i += 2;
				} else if (hasEscapeSequence(line, '\x1B[D', i)) {
					// Left arrow
					position = Math.max(position - 1, 0);
					i += 2;
				} else if (hasEscapeSequence(line, '\x1B[3~', i)) {
					if (position) {
						c.splice(position, 1);
					}
					i += 3;
					//\u001b[3~
				} else if (line[i] === '\x7F') {
					if (position > 0) {
						c.splice(position - 1, 1);
						position--;
					}
					//\u001b[3~
				} else {
					c.splice(position, 0, line[i]);
					position++;
				}
			}
			return stripAnsi(c.join(''));
		})
		.filter((v) => v);
	if (splitByEol.find((v) => v === '') !== undefined) {
		return 'UNKNOWN_COMMAND';
	}
	// const previous = sanitized.replace(/((\[\d+~)|(\x1B))/g, '');
	const doesEndWithSlash = /[^\\]+(\\{2})*\\$/;
	const commands: string[] = [];
	let appendToLastCommand = false;
	for (let i = 0; i < splitByEol.length; i++) {
		if (appendToLastCommand) {
			commands[commands.length - 1] += '\r' + splitByEol[i];
			appendToLastCommand = false;
		} else commands.push(splitByEol[i]);
		if (doesEndWithSlash.test(splitByEol[i])) {
			appendToLastCommand = true;
		}
	}
	return commands;
}
