import { promises as fs } from "node:fs";
import path from "node:path";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { columns } from "@/components/columns";
import { DataTable } from "@/components/data-table";
import { UserNav } from "@/components/user-nav";
import { taskSchema } from "@/data/schema";

export const Route = createFileRoute("/tasks")({
	component: TaskPage,
});

function RouteComponent() {
	return <div>Hello "/tasks"!</div>;
}

import tasks from "@/data/tasks.json" with { type: "json" };

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
				<div className="flex items-center space-x-2">
					<UserNav />
				</div>
			</div>
			<DataTable data={tasks} columns={columns} />
		</div>
	);
}
