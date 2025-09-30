import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
	component: Index,
});

function Index() {
	const [count, setCount] = useState(0);

	return (
		<div className="flex flex-col gap-4 mt-2">
			<div className="p-8 border border-black rounded-md ">
				<Button type="button" onClick={() => setCount((count) => count + 1)}>
					Count is {count}
				</Button>
			</div>
		</div>
	);
}
