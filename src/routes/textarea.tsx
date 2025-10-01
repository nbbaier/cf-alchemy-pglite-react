import { sql } from "@codemirror/lang-sql";
import { createFileRoute } from "@tanstack/react-router";
import CodeMirror from "@uiw/react-codemirror";
import { useState } from "react";

// import { useState } from "react";
// import { Textarea } from "@/components/ui/textarea";

const CodeEditor = ({ content }: { content: string }) => {
	const [value, setValue] = useState(content);

	return (
		<CodeMirror
			className="border rounded-md border-black overflow-hidden"
			height="300px"
			extensions={[sql()]}
			value={value}
			onChange={(value) => {
				setValue(value);
				console.log("value:", value);
			}}
		/>
	);
};

export const Route = createFileRoute("/textarea")({
	component: RouteComponent,
});

function RouteComponent() {
	return <CodeEditor content="" />;
}
