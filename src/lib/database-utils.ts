import type { PGlite } from "@electric-sql/pglite";
import type { PGliteWithLive } from "@electric-sql/pglite/live";

type ColumnMetadata = {
	originalName: string;
	sanitizedName: string;
	type: PostgresColumnType;
};

type TableMetadata = {
	tableName: string;
	sanitizedTableName: string;
	columns: ColumnMetadata[];
	rowCount: number;
};

type PostgresColumnType = "TEXT" | "INTEGER" | "REAL" | "DATE" | "BOOLEAN";

export function sanitizeSqlIdentifier(identifier: string): string {
	// Only allow alphanumeric and underscore, must start with letter or underscore
	const sanitized = identifier.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
	if (!/^[a-z_]/.test(sanitized)) {
		return `_${sanitized}`;
	}
	return sanitized;
}

export async function createTableFromCSV(
	db: PGlite | PGliteWithLive,
	tableName: string,
	columns: string[],
	rows: string[][],
): Promise<TableMetadata> {
	console.log("[databaseUtils] createTableFromCSV called", {
		tableName,
		columns,
		rowCount: rows.length,
	});

	const sanitizedTableName = sanitizeSqlIdentifier(tableName);
	const sanitizedColumns = columns.map((col) => sanitizeSqlIdentifier(col));

	console.log("[databaseUtils] Sanitized names", {
		sanitizedTableName,
		sanitizedColumns,
	});

	const columnTypes: PostgresColumnType[] = [];
	for (let i = 0; i < columns.length; i++) {
		const columnValues = rows.map((row) => row[i]?.toString() ?? "");
		const type = determineColumnType(columnValues);
		columnTypes.push(type);
	}

	console.log("[databaseUtils] Column types determined", columnTypes);

	const columnDefinitions = sanitizedColumns
		.map((col, i) => `"${col}" ${columnTypes[i]}`)
		.join(", ");

	const dropTableSQL = `DROP TABLE IF EXISTS "${sanitizedTableName}" CASCADE`;
	console.log("[databaseUtils] Dropping table if exists...");
	try {
		await db.exec(dropTableSQL);
		console.log("[databaseUtils] Table dropped");
	} catch (err) {
		console.log("[databaseUtils] No table to drop or error:", err);
	}

	const createTableSQL = `CREATE TABLE IF NOT EXISTS "${sanitizedTableName}" (${columnDefinitions})`;
	console.log("[databaseUtils] Creating table...", createTableSQL);
	await db.exec(createTableSQL);
	console.log("[databaseUtils] Table created");

	const placeholders = sanitizedColumns.map((_, i) => `$${i + 1}`).join(", ");
	const insertSQL = `INSERT INTO "${sanitizedTableName}" (${sanitizedColumns.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders})`;

	console.log("[databaseUtils] Inserting rows...", insertSQL);
	for (const row of rows) {
		const values = row.map((val, i) => {
			if (val === "" || val === null || val === undefined) {
				return null;
			}
			if (columnTypes[i] === "INTEGER" || columnTypes[i] === "REAL") {
				const num = Number(val);
				return Number.isNaN(num) ? null : num;
			}
			if (columnTypes[i] === "BOOLEAN") {
				const trimmedVal = val.toString().trim().toLowerCase();
				return ["true", "yes", "1", "t", "y"].includes(trimmedVal);
			}
			return val.toString();
		});

		console.log("[databaseUtils] Inserting row with values:", values);
		await db.query(insertSQL, values);
	}
	console.log("[databaseUtils] All rows inserted");

	return {
		tableName,
		sanitizedTableName,
		columns: columns.map((originalName, i) => ({
			originalName,
			sanitizedName: sanitizedColumns[i],
			type: columnTypes[i],
		})),
		rowCount: rows.length,
	};
}
function determineColumnType(columnValues: string[]): PostgresColumnType {
	const nonEmptyValues = columnValues.filter(
		(v) => v !== "" && v !== null && v !== undefined,
	);

	if (nonEmptyValues.length === 0) {
		return "TEXT";
	}

	const types = nonEmptyValues.slice(0, 100).map(inferDataType);
	const typeCounts: Partial<Record<PostgresColumnType, number>> = {};

	for (const type of types) {
		typeCounts[type] = (typeCounts[type] ?? 0) + 1;
	}

	if (typeCounts.TEXT && typeCounts.TEXT > types.length * 0.1) {
		return "TEXT";
	}

	if (typeCounts.BOOLEAN && typeCounts.BOOLEAN === types.length) {
		return "BOOLEAN";
	}

	if (typeCounts.REAL) {
		return "REAL";
	}

	if (typeCounts.INTEGER) {
		return "INTEGER";
	}

	if (typeCounts.DATE) {
		return "DATE";
	}

	return "TEXT";
}

function inferDataType(value: string): PostgresColumnType {
	if (value === "" || value === null || value === undefined) {
		return "TEXT";
	}

	const trimmedValue = value.trim().toLowerCase();
	const booleanValues = [
		"true",
		"false",
		"yes",
		"no",
		"1",
		"0",
		"t",
		"f",
		"y",
		"n",
	];
	if (booleanValues.includes(trimmedValue)) {
		return "BOOLEAN";
	}

	if (!Number.isNaN(Number(value)) && value.trim() !== "") {
		if (value.includes(".")) {
			return "REAL";
		}
		return "INTEGER";
	}

	const datePattern = /^\d{4}-\d{2}-\d{2}$/;
	if (datePattern.test(value)) {
		return "DATE";
	}

	return "TEXT";
}
