function normalizeCode(code) {
	// Step 1: Remove all inline comments to simplify parsing (optional and can be adjusted)
	let normalized = code.replace(/=\s*\n/g, '= ')
		.replace(/,\s*\n/g, ', ')
		.replace(/\[\s*\n/g, '[')
		.replace(/\n\s*\]/g, ']')
		.replace(/\{\s*\n/g, '{')
		.replace(/\n\s*\}/g, '} ');

	// Step 2: Consolidate multiline variable declarations into a single line
	// Use a loop to handle cases where multiple newlines may be involved
	while (/\b(int|logic|bit|byte|shortint|longint|real|shortreal|enum|struct|union|wire|reg)\s+[^;]*?\n[^;]*?;/.test(normalized)) {
		normalized = normalized.replace(/(\b(int|logic|bit|byte|shortint|longint|real|shortreal|enum|struct|union|wire|reg)\s+[^;]*?)\s*\n\s*([^;]*?;)/g, '$1 $3');
	}
	/**
	 * Regex Operations:
	 * ! First Regex: `([^\s])\s*\b(begin|end)\b` (Flags: 'gi' - Global, Case-Insensitive)
	 *	- Matches a non-whitespace character followed by any number of whitespace characters and then a whole word 'begin' or 'end'.
	 *	- Examples: 'if begin' matches 'f' followed by ' begin', 'endcase end' matches 'e' followed by ' end'.
	 *	- Use: Ensures 'begin' and 'end' keywords start on new lines, separating them from preceding text.
	 * ! Second Regex: `\b(begin|end)\b\s*(\w)` (Flags: 'g' - Global)
	 *	- Matches the whole words 'begin' or 'end', followed optionally by whitespace and then any word character.
	 *	- Example: 'begin always' becomes 'begin\nalways', moving 'always' to a new line.
	 * 
	 */
	// Step 3: Ensure 'begin' and 'end' keywords are on their own lines
	normalized = normalized.replace(/([^\s])\s*\b(begin|end)\b/gi, '$1\n$2').replace(/\b(begin|end)\b\s*(\w)/g, '$1\n$2');

	// Step 4: Normalize module instantiations to have one port per line
	normalized = normalized.replace(/(\.\w+\s*\([^)]+\))/g, function (match) {
		return '\n' + match;
	});

	return normalized;
}


function indentCode() {
	/** User Inputs Start */
	const indentSize = Math.max(0, parseInt(document.getElementById('indentSize').value)) || 4;
	const tabStyle = document.getElementById('tabStyle').value;
	let input = document.getElementById('inputArea').value;

	input = normalizeCode(input);
	const lines = input.split('\n');
	/** User Inputs End */

	const indent = tabStyle === 'tabs' ? '\t'.repeat(indentSize) : ' '.repeat(indentSize);
	let indentCounter = 0;
	let inMultiLineComment = false;
	let moduleParams = false;
	let inModule = false;
	let indentStack = [];
	let errors = []

	const formattedCode = lines.map(function (line, index) {
		let trimmedLine = line.trim();

		// Handle multi-line comments (preserve as is.), format single-line comments as per indent.
		if (trimmedLine.includes('/*')) inMultiLineComment = true;

		if (inMultiLineComment) {
			if (trimmedLine.includes('*/')) inMultiLineComment = false;
			return line;
		}

		const indentedLine = indent.repeat(indentCounter) + trimmedLine;

		// ? Begin-end keywords and their decorators which are optional, can be seperated by one or more spaces, and must precede the keyword.
		const keywordPairs = {
			'module': { endKey: 'endmodule', decorators: ['extern', 'protected'] },
			'case': { endKey: 'endcase', decorators: ['unique', 'priority'] },
			'function': { endKey: 'endfunction', decorators: ['automatic', 'static', 'protected'] },
			'task': { endKey: 'endtask', decorators: ['automatic', 'static', 'protected'] },
			'class': { endKey: 'endclass', decorators: ['virtual', 'protected'] },
			'package': { endKey: 'endpackage', decorators: [] },
			'begin': { endKey: 'end', decorators: [] },
			/** Logical Blocks */
			'if': { endKey: '', decorators: [], logical: true },
			'else': { endKey: '', decorators: [], logical: true },
			'else if': { endKey: '', decorators: [], logical: true }
		};

		let matchedBeginKeyword;
		const isBeginKeyword = Object.keys(keywordPairs).some(keyword => {
			const { decorators } = keywordPairs[keyword];

			const regex = new RegExp(`^(\\w+)\\s+${keyword}\\b`);
			const match = regex.exec(trimmedLine);

			// Check if the line starts with a decorator for the keyword.
			if (decorators.length > 0 && match) {
				const matchedDecorator = match[1];
				if (decorators.includes(matchedDecorator)) {
					matchedBeginKeyword = keyword;
					return true;
				} else {
					errors.push({ message: `Invalid decorator '${matchedDecorator}' for '${keyword}'.`, lineNumber: index + 1 });
				}
			}

			// If no decorators matched or needed, check if the line simply starts with the keyword
			if (trimmedLine.startsWith(keyword)) {
				matchedBeginKeyword = keyword;
				return true;
			}

			return false;
		});

		const isEndKeyword = Object.values(keywordPairs).some(keyword => trimmedLine.startsWith(keyword.endKey) && !keyword.logical);
		const controlStructureConfig = Object.entries(keywordPairs).find(([keyword, config]) => { return trimmedLine.startsWith(keyword) })?.[1];

		if (moduleParams && trimmedLine.endsWith(');')) {
			moduleParams = false;
			indentCounter = indentCounter > 0 ? indentCounter - 1 : 0;
			return indent.repeat(indentCounter) + trimmedLine;
		}

		if (isEndKeyword) {
			const lastBlock = indentStack[indentStack.length - 1];
			const endKey = trimmedLine.split(/\s/)[0];

			if (!lastBlock) {
				// Here we cannot find a matching begin keyword for the end keyword.
				errors.push({ message: 'Unexpected end statement.', lineNumber: index + 1 })
			} else {
				// ! Check for mismatched begin-end blocks. Ex: 'end' for 'function'.
				const expectedEndKey = keywordPairs[lastBlock.keyword].endKey;

				if (expectedEndKey === endKey) {
					indentCounter = lastBlock.indentCounter;
					indentStack.pop();
				} else {
					errors.push({
						message: `Expected '${expectedEndKey}' but found '${endKey}'.`, lineNumber: index + 1
					});
				}
			}

			// ? If the end keyword is 'endmodule', reset the module flag and indent counter.
			if (endKey === 'endmodule') {
				inModule = false;
				indentCounter = 0;
				trimmedLine += '\n';

				// ? Remove the module block from the indent stack. This is to not show it as an open block in the error list.
				const moduleIndex = indentStack.findIndex(item => item.keyword === 'module');
				if (moduleIndex !== -1) indentStack.splice(moduleIndex, 1);
			}

			return indent.repeat(indentCounter || 0) + trimmedLine;
		} else if (isBeginKeyword) {

			// ? In a logical block, the indentation level is defined as the same as the previous block (plus one for module blocks).
			if (controlStructureConfig?.logical) {
				const lastBlock = indentStack[indentStack.length - 1];
				indentCounter = (lastBlock?.indentCounter || 0) + (inModule ? 1 : 0);
				return indent.repeat(indentCounter++) + trimmedLine;
			}

			if (matchedBeginKeyword === 'module') {
				inModule = true;
				moduleParams = !trimmedLine.endsWith(');');
			}

			indentStack.push({ index, indentCounter, keyword: matchedBeginKeyword });
			indentCounter++;
		}

		return indentedLine;
	});

	// ! Check for unclosed logical blocks.
	if (indentStack.length > 0) {
		indentStack.forEach((item) => {
			errors.push({ message: 'Missing closing statement.', lineNumber: item.index + 1 });
		});
	}

	// ? Display errors
	clearErrorOverlays();
	highlightErrorLines([...errors, ...findUninstantiatedVariables(formattedCode)]);

	document.getElementById('outputArea').value = formattedCode.join('\n');
}

function findUninstantiatedVariables(code) {
	const codeAsString = code.join('\n');
	const { errors, variables } = findVariables(code, codeAsString);
	const usedVariables = [];

	// TODO: Extend scope of variables we can detect. Currently, only module instantiations.
	let moduleName, instanceName;
	code.forEach(function (line, index) {
		// ? Detect a module instantation START: mips mips_instance(
		const moduleInstantiation = /(\w+)\s+(\w+)\s*\(/.exec(line);

		if (moduleInstantiation) {
			moduleName = moduleInstantiation[1];
			instanceName = moduleInstantiation[2];
		}

		if (!moduleName || !instanceName) return;

		const portConnections = /\.(\w+)\s*\((\w+)\)/g.exec(line);
		if (portConnections) {
			// ? Detect a module port & input: .clk(clock)
			const portName = portConnections[1];
			const variableName = portConnections[2];

			if (!usedVariables.some(v => v.name === variableName && v.module === moduleName)) {
				usedVariables.push({ name: variableName, module: moduleName, lineNumber: index });
			}
		}

		// Module instantiation ends, reset module and instance names.
		if (line.endsWith(';')) {
			moduleName = undefined;
			instanceName = undefined;
		}
	});

	const moduleErrorPair = {};
	const uninitializedVariables = usedVariables.forEach(variable => {
		if (!variables.some(v => v.name === variable.name)) {
			const lineNumber = codeAsString.split('\n').findIndex(line => line.includes(variable.name));
			const findModuleLine = code.find(line => line.includes(variable.module));

			if (moduleErrorPair[variable.module]) {
				moduleErrorPair[variable.module].push(variable.name);
			} else {
				moduleErrorPair[variable.module] = [variable.name];
			}
		}
	});


	errors.push(...Object.entries(moduleErrorPair).map(([module, variables]) => ({
		message: `Uninstantiated variable(s) '${variables.join(', ')}' in module '${module}'.`,
		lineNumber: codeAsString.split('\n').findIndex(line => line.includes(module)) + 1
	})));

	return errors;
}


// TODO: Add support for following types: 'struct', 'union', 'enum'. These are complex types and need to be handled separately, since they can contain multiple variables within them. It would probably be more convenient to loop through each line and check for these types separately instead of using a regex.
function findVariables(code, codeAsString) {
	// ? Regex to match variable declarations. Supports types: logic, bit, int, longint, shortint, byte, real, shortreal, wire, reg. Also supports multiple-variable declarations such as 'int a, b, c;'
	const regex = /\b(logic|bit|int|longint|shortint|byte|real|shortreal|wire|reg)\s*(?:\[\d*:\d*\])?\s*([\w\s,]+)(?:\[\d*\])?\s*(?:=\s*[^;]+)?;/g;

	const errors = [];
	const variables = [];

	let match;
	while (match = regex.exec(code)) {
		const wholeMatch = match[0];
		const type = match[1];
		// ? Split the variable names by comma and trim any whitespace. Ex: 'int a, b, c;' becomes ['a', 'b', 'c']
		const nameList = match[2].split(',').map(n => n.trim());

		const matchStartIndex = match.index;
		const lineNumber = codeAsString.substring(0, matchStartIndex).split('\n').length;

		if (variables.find(variable => nameList.indexOf(variable.name) !== -1)) {
			errors.push({ message: `Variable '${nameList}' has been already defined.`, lineNumber });
			continue;
		}

		nameList.forEach(name => variables.push({ wholeMatch, type, name }));
	}

	return { errors, variables };
}

function highlightErrorLines(errorList) {
	if (errorList.length === 0) return;
	const outputArea = document.getElementById('outputArea');

	const lineHeight = parseInt(window.getComputedStyle(outputArea).lineHeight);
	const container = document.querySelector('#lineHighlights');

	errorList.forEach(function (error) {
		let overlay = document.createElement('div');
		overlay.className = 'line-highlight';
		overlay.dataset.lineNumber = error.lineNumber;
		overlay.style.top = `${calculatePX(error.lineNumber)}px`;
		container.appendChild(overlay);

		addErrorOverlay(error.lineNumber, error.message);
	});
}

function addErrorOverlay(lineNumber, message) {
	const overlaysContainer = document.getElementById('errorOverlays');
	const overlay = document.createElement('div');
	overlay.className = 'error-overlay';
	overlay.dataset.lineNumber = lineNumber;
	overlay.style.top = `${calculatePX(lineNumber)}px`

	const tooltip = document.createElement('span');
	tooltip.className = 'tooltip';
	tooltip.textContent = message;
	overlay.appendChild(tooltip);

	overlaysContainer.appendChild(overlay);
}

function clearErrorOverlays() {
	const overlaysContainer = document.getElementById('errorOverlays');
	overlaysContainer.innerHTML = '';

	const lineHighlightsContainer = document.getElementById('lineHighlights');
	lineHighlightsContainer.innerHTML = '';
}

function calculatePX(lineNumber) {
	const lineHeight = parseInt(window.getComputedStyle(outputArea).lineHeight);
	return (lineNumber - 1) * lineHeight + 9;
}

document.addEventListener('DOMContentLoaded', function () {
	// ? Add event listener to the indent button & make sure the input area is focused and a tab is inserted on tab press, not focus loss.
	document.getElementById('inputArea').addEventListener('keydown', function (e) {
		if (e.key === 'Tab') {
			e.preventDefault();
			const start = this.selectionStart;
			const end = this.selectionEnd;

			this.value = this.value.substring(0, start) + '\t' + this.value.substring(end);
			this.selectionStart = this.selectionEnd = start + 1;
		}
	});

});
