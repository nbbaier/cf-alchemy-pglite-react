import type { PGlite } from "@electric-sql/pglite";
import type { PGliteWithLive } from "@electric-sql/pglite/live";
import { logger } from "./logger";

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
	logger.debug("[databaseUtils] createTableFromCSV called", {
		tableName,
		columns,
		rowCount: rows.length,
	});

	const sanitizedTableName = sanitizeSqlIdentifier(tableName);
	const sanitizedColumns = columns.map((col) => sanitizeSqlIdentifier(col));

	logger.debug("[databaseUtils] Sanitized names", {
		sanitizedTableName,
		sanitizedColumns,
	});

	const columnTypes: PostgresColumnType[] = [];
	for (let i = 0; i < columns.length; i++) {
		const columnValues = rows.map((row) => row[i]?.toString() ?? "");
		const type = determineColumnType(columnValues);
		columnTypes.push(type);
	}

	logger.debug("[databaseUtils] Column types determined", columnTypes);

	const columnDefinitions = sanitizedColumns
		.map((col, i) => `"${col}" ${columnTypes[i]}`)
		.join(", ");

	const dropTableSQL = `DROP TABLE IF EXISTS "${sanitizedTableName}" CASCADE`;
	logger.debug("[databaseUtils] Dropping table if exists...");
	try {
		await db.exec(dropTableSQL);
		logger.debug("[databaseUtils] Table dropped");
	} catch (err) {
		logger.debug("[databaseUtils] No table to drop or error:", err);
	}

	const createTableSQL = `CREATE TABLE IF NOT EXISTS "${sanitizedTableName}" (${columnDefinitions})`;
	logger.debug("[databaseUtils] Creating table...", createTableSQL);
	await db.exec(createTableSQL);
	logger.debug("[databaseUtils] Table created");

	const placeholders = sanitizedColumns.map((_, i) => `$${i + 1}`).join(", ");
	const insertSQL = `INSERT INTO "${sanitizedTableName}" (${sanitizedColumns.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders})`;

	logger.debug("[databaseUtils] Inserting rows...", insertSQL);

	await db.exec("BEGIN");
	try {
		const BATCH_SIZE = 500;
		for (let i = 0; i < rows.length; i += BATCH_SIZE) {
			const batch = rows.slice(i, i + BATCH_SIZE);
			logger.debug(
				`[databaseUtils] Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(rows.length / BATCH_SIZE)}`,
			);

			for (const row of batch) {
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

				await db.query(insertSQL, values);
			}
		}

		await db.exec("COMMIT");
		logger.debug("[databaseUtils] All rows inserted successfully");
	} catch (err) {
		await db.exec("ROLLBACK");
		logger.error("[databaseUtils] Transaction failed, rolling back:", err);
		throw err;
	}

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

	const sampleSize = Math.min(100, nonEmptyValues.length);
	const typeCounts: Partial<Record<PostgresColumnType, number>> = {};

	for (let i = 0; i < sampleSize; i++) {
		const type = inferDataType(nonEmptyValues[i]);
		typeCounts[type] = (typeCounts[type] ?? 0) + 1;

		if (typeCounts.TEXT && typeCounts.TEXT > sampleSize * 0.1) {
			return "TEXT";
		}
	}

	if (typeCounts.BOOLEAN && typeCounts.BOOLEAN === sampleSize) {
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
