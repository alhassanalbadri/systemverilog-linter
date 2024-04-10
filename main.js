function indentCode() {
	/** User Inputs Start */
	const indentSize = Math.max(0, parseInt(document.getElementById('indentSize').value)) || 4;
	const tabStyle = document.getElementById('tabStyle').value;
	let input = document.getElementById('inputArea').value;
	input = input.replace(/([^\s])\s*(begin|end[\w]*)/gi, '$1\n$2').replace(/(begin|end[\w]*)\s*(\w)/g, '$1\n$2');
	const lines = input.split('\n');
	/** User Inputs End */

	const indent = tabStyle === 'tabs' ? '\t'.repeat(indentSize) : ' '.repeat(indentSize);
	let indentCounter = 0;
	let inMultiLineComment = false;
	let moduleParams = false;
	let indentStack = [];

	const result = lines.map((line, index) => {
		const trimmedLine = line.trim();

		// Handle multi-line comments (preserve as is.), format single-line comments as per indent.
		if (inMultiLineComment) {
			if (trimmedLine.endsWith('*/')) {
				inMultiLineComment = false;
			} else if (trimmedLine.startsWith('/*') && !trimmedLine.endsWith('*/')) {
				inMultiLineComment = true;
			}
			return line;
		}

		let indentedLine = indent.repeat(indentCounter) + trimmedLine;

		// Make sure the ending bracket of module defn. is on the same line as the module declaration.
		if (moduleParams) {
			if (trimmedLine.endsWith(');')) {
				moduleParams = false;
				return trimmedLine;
			}
			return indentedLine;
		}

		// No indentation for 'endmodule' keyword, return the defn as a trimmed line.
		if (trimmedLine == 'endmodule') {
			indentCounter = 0;
			return trimmedLine;
		}

		// If module, increment indent counter and return the line as is.
		if (trimmedLine.startsWith('module')) {
			moduleParams = !trimmedLine.endsWith(');');
			indentCounter = 1;
			return trimmedLine;
		}

		const endKeywords = ['end', 'endcase', 'endfunction', 'endtask'];
		const beginKeywords = ['begin', 'if', 'else', 'else if', 'case', 'function', 'task'];

		// Logic for begin-end blocks & logical blocks (if, else if, case, function, task).
		if (trimmedLine.endsWith('begin')) {
			// Begin is handled seperately as it has a matching end keyword.
			indentStack.push(indentCounter);
			indentCounter++;
		} else if (endKeywords.some(keyword => trimmedLine.startsWith(keyword))) {
			indentCounter = indentStack.pop() || 0; // Pop from stack or reset to 0 if stack is empty
			return indent.repeat(indentCounter) + trimmedLine;
		} else {
			if (beginKeywords.some(keyword => trimmedLine.startsWith(keyword))) {
				if(trimmedLine.startsWith('else if') || trimmedLine.startsWith('else')) {
					return indent.repeat(indentCounter - 1) + trimmedLine;
				}
				indentCounter++;
			}
		}

		return indentedLine;
	});

	document.getElementById('outputArea').value = result.join('\n');
}