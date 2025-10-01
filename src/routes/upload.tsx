import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { CSVUpload } from "@/components/csv-upload";
import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/upload")({
	component: UploadDemo,
});

type CSVRow = Record<string, string>;

function UploadDemo() {
	const [processedData, setProcessedData] = useState<
		Array<{
			tableName: string;
			columns: string[];
			rows: string[][];
		}>
	>([]);
	const [selectedTableIndex, setSelectedTableIndex] = useState(0);

	const handleFileProcessed = (data: {
		tableName: string;
		columns: string[];
		rows: string[][];
	}) => {
		console.log("File processed", data);
		setProcessedData((prev) => {
			const newData = [...prev, data];
			setSelectedTableIndex(newData.length - 1);
			return newData;
		});
	};

	return (
		<div className="container mx-auto p-8">
			<div className="space-y-8">
				<div className="space-y-4">
					<h2 className="text-2xl font-bold">CSV Upload</h2>
					<CSVUpload
						size="sm"
						onFileProcessed={handleFileProcessed}
						maxSize={5 * 1024 * 1024}
						multiple={true}
					/>
				</div>

				{processedData.length > 0 && (
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<h3 className="text-xl font-semibold">Uploaded Data</h3>
							{processedData.length > 1 && (
								<div className="flex gap-2">
									{processedData.map((data, index) => (
										<Button
											key={`${data.tableName}-${index}`}
											variant={
												selectedTableIndex === index ? "default" : "outline"
											}
											size="sm"
											onClick={() => setSelectedTableIndex(index)}
										>
											{data.tableName}
										</Button>
									))}
								</div>
							)}
						</div>
						<CSVDataTable data={processedData[selectedTableIndex]} />
					</div>
				)}
			</div>
		</div>
	);
}

function CSVDataTable({
	data,
}: {
	data: {
		tableName: string;
		columns: string[];
		rows: string[][];
	};
}) {
	const tableData = useMemo(() => {
		return data.rows.map((row) => {
			const rowObject: CSVRow = {};
			data.columns.forEach((column, index) => {
				rowObject[column] = row[index] || "";
			});
			return rowObject;
		});
	}, [data.columns, data.rows]);

	const columns = useMemo<ColumnDef<CSVRow>[]>(() => {
		return data.columns.map((column) => ({
			accessorKey: column,
			header: ({ column: col }) => (
				<DataTableColumnHeader column={col} title={column} />
			),
			cell: ({ row }) => {
				const value = row.getValue(column) as string;
				return <div className="max-w-[500px] truncate">{value}</div>;
			},
		}));
	}, [data.columns]);

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<p className="text-sm text-muted-foreground">
					{data.rows.length} rows × {data.columns.length} columns
				</p>
			</div>
			<DataTable columns={columns} data={tableData} />
		</div>
	);
}
