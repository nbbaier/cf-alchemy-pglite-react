import { PGlite, type Results } from "@electric-sql/pglite";
import { live } from "@electric-sql/pglite/live";
import { PGliteProvider, usePGlite } from "@electric-sql/pglite-react";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { CSVUpload } from "@/components/csv-upload";
import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { createTableFromCSV } from "@/lib/database-utils";

const dbGlobal = await PGlite.create({
	dataDir: "idb://csv-analyzer",
	extensions: {
		live,
	},
});

export const Route = createFileRoute("/pg-upload")({
	component: UploadDemo,
});

type TableRow = Record<string, string | number | boolean | null>;
type PGLiteRow = Record<string, unknown>;
type CSVData = {
	tableName: string;
	columns: string[];
	rows: string[][];
};

function UploadDemo() {
	const db = usePGlite(dbGlobal);
	const [uploadedData, setUploadedData] = useState<Results | null>(null);
	const [currentTableName, setCurrentTableName] = useState<string | null>(null);

	const handleFileProcessed = async (data: CSVData) => {
		console.log("[PGUpload] handleFileProcessed called with:", {
			tableName: data.tableName,
			columns: data.columns,
			rowCount: data.rows.length,
		});

		try {
			console.log("[App] Calling createTableFromCSV...");

			const metadata = await createTableFromCSV(
				db,
				data.tableName,
				data.columns,
				data.rows,
			);

			console.log("[App] Table created successfully with metadata:", metadata);

			const result = await db.query<Record<string, unknown>>(
				`SELECT * FROM "${metadata.sanitizedTableName}" LIMIT 100`,
			);

			console.log("result", result);

			console.log("[App] Query result:", result);
			setUploadedData(result);
			setCurrentTableName(metadata.sanitizedTableName);
			console.log("[App] Upload complete!");
		} catch (err) {
			console.error("[App] Error during upload:", err);
		}
	};

	return (
		<PGliteProvider db={db}>
			<div className="container mx-auto p-8">
				<div className="space-y-8">
					<div className="space-y-4">
						<h2 className="text-2xl font-bold">Upload to PGlite</h2>
						<CSVUpload
							size="sm"
							onFileProcessed={handleFileProcessed}
							maxSize={5 * 1024 * 1024}
							multiple={true}
						/>
					</div>

					{currentTableName && (
						<div className="rounded-md border p-4">
							<p className="text-sm font-medium">Table: {currentTableName}</p>
						</div>
					)}

					{uploadedData && <PGLiteResultsTable data={uploadedData} />}
				</div>
			</div>
		</PGliteProvider>
	);
}

function PGLiteResultsTable({ data }: { data: Results }) {
	const tableData = useMemo<TableRow[]>(() => {
		console.log("[PGLiteResultsTable] Processing data:", {
			rowCount: data.rows.length,
			fieldCount: data.fields.length,
			fields: data.fields.map((f) => f.name),
			sampleRow: data.rows[0],
		});

		const processed = data.rows.map((row) => {
			const pgliteRow = row as PGLiteRow;
			const rowObject: TableRow = {};

			data.fields.forEach((column) => {
				const value = pgliteRow[column.name];
				if (value === undefined || value === null) {
					rowObject[column.name] = null;
				} else if (typeof value === "boolean") {
					rowObject[column.name] = value;
				} else if (typeof value === "number") {
					rowObject[column.name] = value;
				} else {
					rowObject[column.name] = String(value);
				}
			});

			return rowObject;
		});

		console.log("[PGLiteResultsTable] Processed table data:", processed);
		return processed;
	}, [data.fields, data.rows]);

	const columns = useMemo<ColumnDef<TableRow>[]>(() => {
		return data.fields.map((column) => ({
			accessorKey: column.name,
			header: ({ column: col }) => (
				<DataTableColumnHeader column={col} title={column.name} />
			),
			cell: ({ row }) => {
				const value = row.getValue<string | number | boolean | null>(
					column.name,
				);
				const displayValue = value === null ? "" : String(value);
				return <div className="max-w-[500px] truncate">{displayValue}</div>;
			},
		}));
	}, [data.fields]);

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<p className="text-sm text-muted-foreground">
					{data.rows.length} rows × {data.fields.length} columns
				</p>
			</div>
			<DataTable columns={columns} data={tableData} />
		</div>
	);
}
