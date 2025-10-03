import { sql } from "@codemirror/lang-sql";
import { keymap } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "./ui/button";

interface CodeEditorProps {
	content: string;
	onRunQuery?: (query: string) => void;
}

export const CodeEditor = ({ content, onRunQuery }: CodeEditorProps) => {
	const [value, setValue] = useState(content);

	useEffect(() => {
		setValue(content);
	}, [content]);

	const handleRunQuery = useCallback(() => {
		if (onRunQuery && value.trim()) {
			onRunQuery(value);
		}
	}, [value, onRunQuery]);

	const extensions = useMemo(
		() => [
			sql(),
			keymap.of([
				{
					key: "Mod-Enter",
					run: () => {
						handleRunQuery();
						return true;
					},
				},
			]),
		],
		[handleRunQuery],
	);

	return (
		<div className="space-y-2">
			<CodeMirror
				className="border rounded-md overflow-hidden"
				height="300px"
				extensions={extensions}
				value={value}
				onChange={(value) => {
					setValue(value);
				}}
			/>
			<div className="flex justify-end">
				<Button
					onClick={handleRunQuery}
					disabled={!value.trim()}
					size="sm"
					className="gap-2"
				>
					Run SQL
				</Button>
			</div>
		</div>
	);
};
