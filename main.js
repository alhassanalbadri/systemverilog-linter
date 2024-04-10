function indentCode() {
	const indentSize = 4;

	const input = document.getElementById('inputArea').value;
	const lines = input.split('\n');

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

		let indentedLine = ' '.repeat(indentCounter * indentSize) + line;

		// Make sure the ending bracket of module defn. is on the same line as the module declaration.
		if (moduleParams && trimmedLine.endsWith(');')) {
			moduleParams = false;
			return trimmedLine;
		}

		// No indentation for 'endmodule' keyword, return the defn as a trimmed line.
		if (trimmedLine == 'endmodule') {
			return trimmedLine;
		}

		// Indent module parameters.
		if (trimmedLine.includes('module')) {
			moduleParams = true;
			indentCounter++;
			return indentedLine;
		}

		const endKeywords = ['end', 'endcase', 'endfunction', 'endtask'];
		const beginKeywords = ['begin', 'else', 'else if', 'case', 'function', 'task'];

		// Logic for begin-end blocks & logical blocks (if, else if, case, function, task).
		if (trimmedLine.endsWith('begin')) {
			indentCounter++;
		} else if (endKeywords.some(keyword => trimmedLine.startsWith(keyword))) {
			indentCounter = Math.max(0, indentCounter - 1);
			// We re-define the indented line here to remove the extra indentation. Since we want the 'end' keywords to be on the same indentation level as the previous block.
			return ' '.repeat(indentCounter * indentSize) + line;
		} else {
			if (beginKeywords.some(keyword => trimmedLine.startsWith(keyword))) {
				indentCounter++;
			}
		}

		return indentedLine;
	});

	document.getElementById('outputArea').value = result.join('\n');
}