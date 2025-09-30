import { useState } from "react";
import { Button } from "./components/ui/button";

function App() {
	const [count, setCount] = useState(0);

	return (
		<>
			<h1 className="text-5xl">Vite + React</h1>
			<div className="p-8 bordere rounded-md my-4">
				<Button type="button" onClick={() => setCount((count) => count + 1)}>
					Count is {count}
				</Button>
			</div>
			<p className="text-zinc-500">
				Click on the Vite and React logos to learn more
			</p>
		</>
	);
}

export default App;
