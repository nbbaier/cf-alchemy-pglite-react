import { PGlite } from "@electric-sql/pglite";
import { live, type PGliteWithLive } from "@electric-sql/pglite/live";
import { PGliteProvider } from "@electric-sql/pglite-react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import PGLiteComponent from "@/components/pglite-component";

let dbGlobal: PGliteWithLive | undefined;

export const Route = createFileRoute("/pglite")({
	component: Index,
});

function Index() {
	const [db, setDb] = useState<PGliteWithLive | undefined>();

	useEffect(() => {
		async function setupDb() {
			console.log("setupDb");
			dbGlobal ??= await PGlite.create({
				extensions: { live },
			});
			dbGlobal.query(`CREATE TABLE IF NOT EXISTS my_table (
          id SERIAL PRIMARY KEY NOT NULL,
          name TEXT,
          number INT,
          "insertDateTime" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );`);
			setDb(dbGlobal);
		}
		setupDb();
	}, []);

	return (
		<div className="flex flex-col gap-4 mt-2">
			<div className="p-8 border border-black rounded-md">
				{db ? (
					<PGliteProvider db={db}>
						<PGLiteComponent />
					</PGliteProvider>
				) : (
					<div>Loading PGlite...</div>
				)}
			</div>
		</div>
	);
}
