function indentCode() {
	/** User Inputs Start */
	const indentSize = Math.max(0, parseInt(document.getElementById('indentSize').value)) || 4;
	const tabStyle = document.getElementById('tabStyle').value;
	const input = document.getElementById('inputArea').value;
	const lines = input.split('\n');
	/** User Inputs End */

	const indent = tabStyle === 'tabs' ? '	' : ' ';
	let indentCounter = 0;
	let inMultiLineComment = false;
	let moduleParams = false;

	const result = lines.map(line => {
		const trimmedLine = line.trim();

		// Handle comments and multi-line comments (perserve as is.)
		if (trimmedLine.startsWith('//') || inMultiLineComment) {
			if (trimmedLine.endsWith('*/')) {
				inMultiLineComment = false;
			} else if (trimmedLine.startsWith('/*') && !trimmedLine.endsWith('*/')) {
				inMultiLineComment = true;
			}
			return line;
		}

		let indentedLine = indent.repeat(indentCounter * indentSize) + trimmedLine;

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

		// Indent module parameters.
		if (trimmedLine.startsWith('module')) {
			moduleParams = !trimmedLine.endsWith(');');
			indentCounter = 1;
			return trimmedLine;
		}

		const endKeywords = ['end', 'endcase', 'endfunction', 'endtask'];
		const beginKeywords = ['begin', 'else', 'else if', 'case', 'function', 'task'];

		// Logic for begin-end blocks & logical blocks (if, else if, case, function, task).
		if (trimmedLine.endsWith('begin')) {
			indentCounter++;
		} else if (endKeywords.some(keyword => trimmedLine.startsWith(keyword))) {
			indentCounter = Math.max(0, indentCounter - 1);
			// We re-define the indented line here to remove the extra indentation. Since we want the 'end' keywords to be on the same indentation level as the previous block.
			return indent.repeat(indentCounter * indentSize) + line;
		} else {
			if (beginKeywords.some(keyword => trimmedLine.startsWith(keyword))) {
				indentCounter++;
			}
		}

		return indentedLine;
	});

	document.getElementById('outputArea').value = result.join('\n');
}