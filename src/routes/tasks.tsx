import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { columns } from "@/components/columns";
import { DataTable } from "@/components/data-table";
import { taskSchema } from "@/data/schema";
import tasks from "@/data/tasks.json" with { type: "json" };

export const Route = createFileRoute("/tasks")({
	component: TaskPage,
});

async function getTasks() {
	return z.array(taskSchema).parse(tasks);
}

export default async function TaskPage() {
	const tasks = await getTasks();

	return (
		<div className=" h-full flex-1 flex-col space-y-8 p-8 md:flex">
			<div className="flex items-center justify-between space-y-2">
				<div>
					<h2 className="text-2xl font-bold tracking-tight">Welcome back!</h2>
					<p className="text-muted-foreground">
						Here&apos;s a list of your tasks for this month!
					</p>
				</div>
			</div>
			<DataTable data={tasks} columns={columns} />
		</div>
	);
}
