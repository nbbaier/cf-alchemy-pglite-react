import Papa from "papaparse";

const csv = await Bun.file(Bun.argv[2]).text();

const results = Papa.parse(csv, {
	dynamicTyping: true,
	skipEmptyLines: true,
	header: true,
});

if (!results.data || results.data.length === 0) {
	throw new Error("CSV file is empty");
}

const rows = results.data;
const headers = results.meta.fields;
console.log(headers);
