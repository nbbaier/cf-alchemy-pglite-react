import { PGlite, type Results } from "@electric-sql/pglite";
import { live } from "@electric-sql/pglite/live";
import { PGliteProvider, usePGlite } from "@electric-sql/pglite-react";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CSVUpload } from "@/components/csv-upload";
import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { CodeEditor } from "@/components/editor";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	createTableFromCSV,
	sanitizeSqlIdentifier,
} from "@/lib/database-utils";
import { logger } from "@/lib/logger";

const dbGlobal = await PGlite.create({
	extensions: { live },
	dataDir: "idb://csv-analyzer",
});

export const Route = createFileRoute("/pglite")({
	component: RouteComponent,
});

type TableRow = Record<string, string | number | boolean | null>;
type PGLiteRow = Record<string, unknown>;
type CSVData = {
	tableName: string;
	columns: string[];
	rows: string[][];
};

function RouteComponent() {
	const db = usePGlite(dbGlobal);
	const [uploadedData, setUploadedData] = useState<Results | null>(null);
	const [currentTableName, setCurrentTableName] = useState<string | null>(null);
	const [tableList, setTableList] = useState<{ table_name: string }[]>([]);
	const [editorContent, setEditorContent] = useState<string>("");

	useEffect(() => {
		const loadTables = async () => {
			try {
				const tableNames = await db.query<{ table_name: string }>(
					`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`,
				);
				setTableList(tableNames.rows);
			} catch (err) {
				logger.error("[App] Error loading tables:", err);
			}
		};

		loadTables();
	}, [db]);

	const handleTableClick = async (tableName: string) => {
		try {
			const sanitizedTableName = sanitizeSqlIdentifier(tableName);
			const sql = `SELECT * FROM "${sanitizedTableName}" LIMIT 100`;
			setEditorContent(sql);
			const result = await db.query<Record<string, unknown>>(sql);
			setCurrentTableName(tableName);
			setUploadedData(result);
			toast.success(`Loaded data from table "${tableName}"`);
		} catch (err) {
			logger.error("[App] Error loading table:", err);
			toast.error(
				err instanceof Error ? err.message : "Failed to load table data",
			);
		}
	};

	const handleFileProcessed = async (data: CSVData) => {
		logger.debug("[PGUpload] handleFileProcessed called with:", {
			tableName: data.tableName,
			columns: data.columns,
			rowCount: data.rows.length,
		});

		// Create loading toast and store its ID
		const toastId = toast.loading("Creating table and importing data...");

		try {
			logger.debug("[App] Calling createTableFromCSV...");

			const metadata = await createTableFromCSV(
				db,
				data.tableName,
				data.columns,
				data.rows,
			);

			logger.debug("[App] Table created successfully with metadata:", metadata);

			const result = await db.query<Record<string, unknown>>(
				`SELECT * FROM "${metadata.sanitizedTableName}" LIMIT 100`,
			);
			const tableNames = await db.query<{ table_name: string }>(
				`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`,
			);
			setTableList(tableNames.rows);
			setCurrentTableName(metadata.sanitizedTableName);
			setUploadedData(result);

			// Dismiss loading toast and show success
			toast.success(
				`Table "${metadata.sanitizedTableName}" created and data imported`,
				{ id: toastId }, // This replaces the loading toast
			);

			logger.debug("[App] Upload complete!");
		} catch (err) {
			logger.error("[App] Error during upload:", err);

			// Dismiss loading toast and show error
			toast.error(
				err instanceof Error ? err.message : "Failed to process CSV file",
				{ id: toastId }, // This replaces the loading toast
			);
		}
	};

	const handleRunQuery = async (query: string) => {
		try {
			console.log(query);
			const result = await db.query<Record<string, unknown>>(query);
			setUploadedData(result);
			setCurrentTableName(null);
			toast.success("Query executed successfully");
		} catch (err) {
			logger.error("[App] Error executing query:", err);
			toast.error(
				err instanceof Error ? err.message : "Failed to execute query",
			);
		}
	};

	return (
		<PGliteProvider db={db}>
			<div className="container mx-auto p-8">
				<div className="space-y-4">
					<CSVUpload
						size="sm"
						onFileProcessed={handleFileProcessed}
						maxSize={5 * 1024 * 1024}
						multiple={true}
					/>
					<hr />
					<CodeEditor content={editorContent} onRunQuery={handleRunQuery} />
					<hr />
					{tableList.length > 0 && (
						<div className="flex flex-wrap gap-2">
							{tableList.map((table) => (
								<Button
									key={table.table_name}
									variant={
										table.table_name === currentTableName
											? "default"
											: "outline"
									}
									size="sm"
									onClick={() => handleTableClick(table.table_name)}
									className="font-mono"
								>
									{table.table_name}
								</Button>
							))}
						</div>
					)}
					<hr />
					{uploadedData && <PGLiteResultsTable data={uploadedData} />}
				</div>
			</div>
		</PGliteProvider>
	);
}

function PGLiteResultsTable({ data }: { data: Results }) {
	const tableData = useMemo<TableRow[]>(() => {
		logger.debug("[PGLiteResultsTable] Processing data:", {
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

		logger.debug("[PGLiteResultsTable] Processed table data:", processed);
		return processed;
	}, [data.fields, data.rows]);

	const columns = useMemo<ColumnDef<TableRow>[]>(() => {
		const select: ColumnDef<TableRow>[] = [
			{
				id: "select",
				header: ({ table }) => (
					<div className="mx-1">
						<Checkbox
							checked={
								table.getIsAllPageRowsSelected() ||
								(table.getIsSomePageRowsSelected() && "indeterminate")
							}
							onCheckedChange={(value) =>
								table.toggleAllPageRowsSelected(!!value)
							}
							aria-label="Select all"
							className="translate-y-[2px]"
						/>
					</div>
				),
				cell: ({ row }) => (
					<div className="mx-1">
						<Checkbox
							checked={row.getIsSelected()}
							onCheckedChange={(value) => row.toggleSelected(!!value)}
							aria-label="Select row"
							className="translate-y-[2px]"
						/>
					</div>
				),
				enableSorting: false,
				enableHiding: false,
			},
		];
		const intermediate: ColumnDef<TableRow>[] = data.fields.map((column) => ({
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
		return [...select, ...intermediate];
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
