# Code Review Report

## 🔴 Critical Issues - Must Fix

### 1. **SQL Injection Vulnerability in `database-utils.ts`**

**File:** `src/lib/database-utils.ts`  
**Lines:** 56, 65, 71

**Issue:** The SQL queries use string interpolation with user-controlled table and column names, which could lead to SQL injection attacks.

```typescript
// VULNERABLE CODE
const dropTableSQL = `DROP TABLE IF EXISTS "${sanitizedTableName}" CASCADE`;
const createTableSQL = `CREATE TABLE IF NOT EXISTS "${sanitizedTableName}" (${columnDefinitions})`;
const insertSQL = `INSERT INTO "${sanitizedTableName}" (${sanitizedColumns.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders})`;
```

**Problem:** While the table/column names are sanitized with a regex, the regex `[^a-zA-Z0-9_]` doesn't protect against all SQL injection scenarios. An attacker could craft a CSV file with carefully crafted column names to break out of the quoted identifiers.

**Solution:** Use PGlite's parameterized identifier quoting or implement more robust sanitization:

```typescript
// Better approach: More strict validation
function sanitizeSqlIdentifier(identifier: string): string {
   // Only allow alphanumeric and underscore, must start with letter or underscore
   const sanitized = identifier.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
   if (!/^[a-z_]/.test(sanitized)) {
      return `_${sanitized}`;
   }
   return sanitized;
}

// Alternative: Use PostgreSQL's quote_ident if available in PGlite
// Or validate against a whitelist of allowed characters
```

**Rationale:** SQL injection is a critical security vulnerability that could allow arbitrary database operations. This needs immediate attention.

---

### 2. **Missing Input Validation and Size Limits**

**File:** `src/components/csv-upload.tsx`  
**Lines:** 142-194, `src/lib/database-utils.ts` Lines: 74-92

**Issue:** No validation on CSV content size or structure before processing.

**Problems:**

1. No row count limits - could cause memory exhaustion
2. No column count limits - could create extremely wide tables
3. No validation of CSV structure integrity
4. Malformed CSV could cause DoS through excessive memory usage

**Solution:**

```typescript
// In csv-upload.tsx processFile function
const MAX_ROWS = 10000;
const MAX_COLUMNS = 100;
const MAX_CELL_SIZE = 10000; // characters

Papa.parse(file, {
  complete: (results) => {
    try {
      console.log("[CSVUpload] Parse complete:", results);
      if (!results.data || results.data.length === 0) {
        throw new Error("CSV file is empty");
      }

      const rows = results.data as string[][];
      const headers = rows[0];

      // ADD VALIDATION HERE
      if (headers.length > MAX_COLUMNS) {
        throw new Error(`Too many columns. Maximum ${MAX_COLUMNS} allowed.`);
      }

      const dataRows = rows
        .slice(1)
        .filter((row) => row.some((cell) => cell !== ""));

      if (dataRows.length > MAX_ROWS) {
        throw new Error(`Too many rows. Maximum ${MAX_ROWS} allowed.`);
      }

      // Validate cell sizes
      for (const row of dataRows) {
        for (const cell of row) {
          if (cell.length > MAX_CELL_SIZE) {
            throw new Error(`Cell too large. Maximum ${MAX_CELL_SIZE} characters allowed.`);
          }
        }
      }

      // ... rest of code
    }
  }
});
```

**Rationale:** Prevent denial-of-service attacks and resource exhaustion.

---

### 3. **Async Component Pattern Anti-pattern**

**File:** `src/routes/tasks.tsx`  
**Line:** 16

**Issue:** The component is declared as `async function` which is not supported in React:

```typescript
export default async function TaskPage() {
   const tasks = await getTasks();
   // ...
}
```

**Problem:** React components cannot be async. This will cause runtime errors or unexpected behavior.

**Solution:** Use proper data loading patterns:

```typescript
// Option 1: Use React Router's loader pattern
export const Route = createFileRoute("/tasks")({
  loader: async () => {
    return { tasks: await getTasks() };
  },
  component: TaskPage,
});

function TaskPage() {
  const { tasks } = Route.useLoaderData();

  return (
    <div className=" h-full flex-1 flex-col space-y-8 p-8 md:flex">
      {/* ... */}
    </div>
  );
}

// Option 2: Use useEffect + useState
function TaskPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTasks().then(data => {
      setTasks(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className=" h-full flex-1 flex-col space-y-8 p-8 md:flex">
      {/* ... */}
    </div>
  );
}
```

**Rationale:** Async components are not supported in React and will cause runtime errors.

---

## 🟡 Suggestions - Improvements to Consider

### 1. **Performance: Inefficient Column Type Detection**

**File:** `src/lib/database-utils.ts`  
**Lines:** 106-143

**Issue:** The `determineColumnType` function samples only the first 100 values but doesn't efficiently handle large datasets.

**Current Code:**

```typescript
const types = nonEmptyValues.slice(0, 100).map(inferDataType);
```

**Suggestion:**

```typescript
// More efficient: Use early exit and streaming approach
function determineColumnType(columnValues: string[]): PostgresColumnType {
   const nonEmptyValues = columnValues.filter(
      (v) => v !== "" && v !== null && v !== undefined
   );

   if (nonEmptyValues.length === 0) {
      return "TEXT";
   }

   const sampleSize = Math.min(100, nonEmptyValues.length);
   const typeCounts: Partial<Record<PostgresColumnType, number>> = {};

   // Early exit if we find text - no need to check all samples
   for (let i = 0; i < sampleSize; i++) {
      const type = inferDataType(nonEmptyValues[i]);
      typeCounts[type] = (typeCounts[type] ?? 0) + 1;

      // If >10% are TEXT, we can exit early
      if (typeCounts.TEXT && typeCounts.TEXT > sampleSize * 0.1) {
         return "TEXT";
      }
   }

   // Rest of logic...
}
```

**Rationale:** Reduce unnecessary type inference operations, especially for large CSV files.

---

### 2. **Error Handling: Silent Failures**

**File:** `src/components/csv-upload.tsx`  
**Lines:** 63, 180-186

**Issue:** Error state `_error` is set but never displayed to the user.

```typescript
const [_error, setError] = React.useState<string | null>(null);
```

**Problem:** Users won't know what went wrong when CSV processing fails.

**Solution:**

```typescript
const [error, setError] = React.useState<string | null>(null);

// In JSX:
return (
  <div className="w-full space-y-4 group">
    {error && (
      <div className="p-4 bg-destructive/10 border border-destructive rounded-lg">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )}

    <label
      // ... rest of code
    >
  </div>
);
```

**Rationale:** Better UX - users should be informed of errors.

---

### 3. **Race Condition in State Updates**

**File:** `src/routes/upload.tsx`  
**Lines:** 31-35

**Issue:** Potential race condition when updating state and reading it immediately:

```typescript
const handleFileProcessed = (data: {...}) => {
  console.log("File processed", data);
  setProcessedData((prev) => {
    const newData = [...prev, data];
    setSelectedTableIndex(newData.length - 1);  // Nested setState!
    return newData;
  });
};
```

**Problem:** `setSelectedTableIndex` is called inside another state update callback, which can cause issues with batching.

**Solution:**

```typescript
const handleFileProcessed = (data: {...}) => {
  console.log("File processed", data);
  setProcessedData((prev) => [...prev, data]);
  // Use functional update to ensure we have the latest state
  setProcessedData((prev) => {
    setSelectedTableIndex(prev.length - 1);
    return prev;
  });
};

// OR better:
const handleFileProcessed = (data: {...}) => {
  console.log("File processed", data);
  setProcessedData((prev) => {
    const newData = [...prev, data];
    // Use useEffect to update selectedTableIndex
    return newData;
  });
};

useEffect(() => {
  if (processedData.length > 0) {
    setSelectedTableIndex(processedData.length - 1);
  }
}, [processedData.length]);
```

**Rationale:** Avoid race conditions and state synchronization issues.

---

### 4. **Memory Leak: Missing Cleanup**

**File:** `src/lib/database-utils.ts`  
**Lines:** 74-92

**Issue:** Inserting rows one-by-one without batching or transactions.

**Problem:**

- Slow performance for large datasets
- No transaction means partial imports on error
- High memory usage

**Solution:**

```typescript
// Use transaction for atomic operations
export async function createTableFromCSV(
   db: PGlite | PGliteWithLive,
   tableName: string,
   columns: string[],
   rows: string[][]
): Promise<TableMetadata> {
   // ... existing code for table creation ...

   // Use transaction for inserting
   await db.exec("BEGIN");
   try {
      const BATCH_SIZE = 500;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
         const batch = rows.slice(i, i + BATCH_SIZE);

         for (const row of batch) {
            const values = row.map((val, i) => {
               // ... existing value transformation
            });
            await db.query(insertSQL, values);
         }
      }
      await db.exec("COMMIT");
   } catch (err) {
      await db.exec("ROLLBACK");
      throw err;
   }

   return {
      // ... metadata
   };
}
```

**Rationale:** Better performance, data integrity, and resource management.

---

### 5. **Type Safety: Loose Type Definitions**

**File:** `src/routes/pglite.tsx`  
**Lines:** 24-25

**Issue:** `PGLiteRow` is too permissive:

```typescript
type PGLiteRow = Record<string, unknown>;
```

**Problem:** No validation of expected row structure.

**Solution:**

```typescript
// Create proper types based on column metadata
interface PGLiteRow {
   [key: string]: string | number | boolean | null | Date;
}

// Add runtime validation
function isValidPGLiteValue(
   value: unknown
): value is string | number | boolean | null | Date {
   return (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value instanceof Date
   );
}
```

**Rationale:** Better type safety and runtime validation.

---

### 6. **Code Quality: Excessive Console Logging**

**Files:** Multiple (`database-utils.ts`, `csv-upload.tsx`, `pglite.tsx`)

**Issue:** Production code contains excessive console.log statements.

**Solution:** Implement proper logging:

```typescript
// lib/logger.ts
const isDev = import.meta.env.DEV;

export const logger = {
   debug: (...args: any[]) => isDev && console.log("[DEBUG]", ...args),
   info: (...args: any[]) => isDev && console.info("[INFO]", ...args),
   warn: (...args: any[]) => console.warn("[WARN]", ...args),
   error: (...args: any[]) => console.error("[ERROR]", ...args),
};

// Usage:
import { logger } from "@/lib/logger";

logger.debug("[databaseUtils] createTableFromCSV called", {
   tableName,
   columns,
   rowCount: rows.length,
});
```

**Rationale:** Better production performance and cleaner console output.

---

## ✅ Good Practices

### 1. **Type Safety with Zod**

**File:** `src/routes/tasks.tsx`  
**Lines:** 12-14

The use of Zod for runtime validation is excellent:

```typescript
async function getTasks() {
   return z.array(taskSchema).parse(tasks);
}
```

This ensures type safety at runtime and catches data inconsistencies early.

---

### 2. **Component Composition**

**File:** `src/routes/upload.tsx`  
**Lines:** 80-122

Good separation of concerns with `CSVDataTable` component:

- Isolated data transformation logic
- Reusable component pattern
- Proper use of useMemo for performance

---

### 3. **Accessible UI Components**

**File:** `src/routes/pglite.tsx`  
**Lines:** 196-223

Good use of accessibility attributes:

```typescript
<Checkbox
  checked={row.getIsSelected()}
  onCheckedChange={(value) => row.toggleSelected(!!value)}
  aria-label="Select row"  // Good!
  className="translate-y-[2px]"
/>
```

---

### 4. **Proper File Validation**

**File:** `src/components/csv-upload.tsx`  
**Lines:** 65-74, 101-111

Multiple validation checks for file type and size:

- MIME type checking
- File extension validation
- Size limits (configurable via props)

---

### 5. **User Feedback with Toasts**

**File:** `src/routes/pglite.tsx`  
**Lines:** 78, 103-106, 113-116

Excellent UX with loading states and toast notifications:

```typescript
const toastId = toast.loading("Creating table and importing data...");
// ... operation
toast.success(`Table "${metadata.sanitizedTableName}" created`, {
   id: toastId,
});
```

This provides clear feedback during async operations.

---

## Architecture & Design Patterns

### Strengths:

1. **Clear separation of concerns** - Database utils are separated from UI components
2. **Reusable components** - CSVUpload, DataTable are well-designed for reuse
3. **React patterns** - Proper use of hooks (useMemo, useState, useEffect)

### Areas for Improvement:

1. **Missing error boundaries** - No error boundaries for graceful error handling
2. **No loading states** - Some components lack proper loading indicators
3. **API worker is incomplete** - `src/worker.ts` has only a placeholder implementation

---

## Testing & Documentation

### Current State:

- ❌ No test files found in the repository
- ❌ No JSDoc or inline documentation
- ❌ No README documentation for components
- ❌ No API documentation

### Recommendations:

1. Add unit tests for critical functions (especially `database-utils.ts`)
2. Add integration tests for CSV upload flow
3. Add JSDoc comments for public APIs
4. Document component props with TypeScript interfaces
5. Create a TESTING.md guide

---

## Summary

### Critical Issues (Fix Immediately):

1. SQL injection vulnerability in database-utils.ts
2. Missing input validation and size limits
3. Async component anti-pattern in tasks.tsx

### High Priority (Fix Soon):

1. Error display to users
2. Race condition in state updates
3. Transaction handling for data imports

### Medium Priority (Consider):

1. Performance optimizations
2. Better logging system
3. Type safety improvements

### Low Priority (Nice to Have):

1. Test coverage
2. Documentation
3. Error boundaries

**Overall Assessment:** The codebase shows good React patterns and component design, but has critical security vulnerabilities that must be addressed immediately. The SQL injection risk and missing input validation could lead to serious security issues in production.
