import type { Table } from "@tanstack/react-table";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DataTableToolbarProps<TData> {
	table: Table<TData>;
}

export function DataTableToolbar<TData>({
	table,
}: DataTableToolbarProps<TData>) {
	const isFiltered = table.getState().globalFilter
		? table.getState().globalFilter.length > 0
		: false;

	return (
		<div className="flex items-center justify-between">
			<div className="flex flex-1 items-center space-x-2">
				<Input
					placeholder="Search..."
					value={(table.getState().globalFilter as string) ?? ""}
					onChange={(e) => table.setGlobalFilter(String(e.target.value))}
					className="text-sm h-8 w-[150px] lg:w-[250px]"
				/>

				{isFiltered && (
					<Button
						variant="ghost"
						onClick={() => table.resetGlobalFilter()}
						className="h-8 -ml-2"
					>
						<X />
					</Button>
				)}
			</div>
		</div>
	);
}
