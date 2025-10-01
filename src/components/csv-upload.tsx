import { cva, type VariantProps } from "class-variance-authority";
import { type File, Upload, X } from "lucide-react";
import Papa from "papaparse";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const csvUploadVariants = cva(
	"relative flex flex-col items-center justify-center w-full rounded-lg border-2 border-dashed transition-colors",
	{
		variants: {
			variant: {
				default: "border-input dark:border-input/50",
				active:
					"border-primary border-blue-400 bg-blue-50 dark:border-primary dark:bg-blue-950",
			},
			size: {
				default: "min-h-[200px] p-8",
				sm: "min-h-[150px] p-6",
				lg: "min-h-[250px] p-10",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

interface CSVUploadProps
	extends Omit<React.HTMLAttributes<HTMLLabelElement>, "onChange">,
		VariantProps<typeof csvUploadVariants> {
	onFileProcessed: (data: {
		tableName: string;
		columns: string[];
		rows: string[][];
	}) => void;
	multiple?: boolean;
	maxSize?: number;
	maxFiles?: number;
	disabled?: boolean;
}

const CSVUpload = React.forwardRef<HTMLLabelElement, CSVUploadProps>(
	(
		{
			className,
			variant,
			size,
			onFileProcessed,
			multiple = true,
			maxSize,
			maxFiles,
			disabled = false,
			...props
		},
		ref,
	) => {
		const [isDragging, setIsDragging] = React.useState(false);
		const [files, setFiles] = React.useState<File[]>([]);
		const inputId = React.useId();
		const [isProcessing, setIsProcessing] = React.useState(false);
		const [_error, setError] = React.useState<string | null>(null);

		const isValidCSV = (file: File): boolean => {
			const fileName = file.name.toLowerCase();
			const fileType = file.type;

			return (
				fileName.endsWith(".csv") ||
				fileType === "text/csv" ||
				fileType === "application/csv"
			);
		};

		const handleDragEnter = (e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			if (!disabled) {
				setIsDragging(true);
			}
		};

		const handleDragLeave = (e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setIsDragging(false);
		};

		const handleDragOver = (e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();

			if (disabled) {
				e.dataTransfer.dropEffect = "none";
			} else {
				e.dataTransfer.dropEffect = "copy";
			}
		};

		const validateFile = (file: File): boolean => {
			if (!isValidCSV(file)) {
				console.warn(`File ${file.name} is not a valid CSV file`);
				return false;
			}
			if (maxSize && file.size > maxSize) {
				console.warn(`File ${file.name} exceeds max size of ${maxSize} bytes`);
				return false;
			}
			return true;
		};

		const handleFiles = (newFiles: FileList | null) => {
			if (!newFiles || disabled) return;

			let fileArray = Array.from(newFiles);

			if (!multiple) {
				fileArray = fileArray.slice(0, 1);
			} else if (maxFiles) {
				const remainingSlots = maxFiles - files.length;
				fileArray = fileArray.slice(0, remainingSlots);
			}

			fileArray = fileArray.filter(validateFile);

			const updatedFiles = multiple ? [...files, ...fileArray] : fileArray;
			setFiles(updatedFiles);

			const newFileArray = multiple ? fileArray : updatedFiles;
			for (const file of newFileArray) {
				processFile(file);
			}
		};

		const processFile = (file: File) => {
			console.log("[CSVUpload] Processing file:", file.name);

			setIsProcessing(true);
			setError(null);

			Papa.parse(file, {
				complete: (results) => {
					try {
						console.log("[CSVUpload] Parse complete:", results);
						if (!results.data || results.data.length === 0) {
							throw new Error("CSV file is empty");
						}

						const rows = results.data as string[][];
						const headers = rows[0];
						const dataRows = rows
							.slice(1)
							.filter((row) => row.some((cell) => cell !== ""));

						console.log("[CSVUpload] Headers:", headers);
						console.log("[CSVUpload] Data rows count:", dataRows.length);

						if (!headers || headers.length === 0) {
							throw new Error("CSV file has no headers");
						}

						const tableName = file.name
							.replace(".csv", "")
							.replace(/[^a-zA-Z0-9_]/g, "_")
							.toLowerCase();

						console.log(
							"[CSVUpload] Calling onFileProcessed with table:",
							tableName,
						);

						onFileProcessed({
							tableName,
							columns: headers,
							rows: dataRows,
						});

						setIsProcessing(false);
					} catch (err) {
						console.error("[CSVUpload] Error processing CSV:", err);
						setError(
							err instanceof Error ? err.message : "Failed to process CSV file",
						);
						setIsProcessing(false);
					}
				},
				error: (err) => {
					console.error("[CSVUpload] Parse error:", err);
					setError(err.message);
					setIsProcessing(false);
				},
			});
		};

		const handleDrop = (e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setIsDragging(false);

			handleFiles(e.dataTransfer.files);
		};

		const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
			handleFiles(e.target.files);
		};

		const removeFile = (index: number) => {
			const updatedFiles = files.filter((_, i) => i !== index);
			setFiles(updatedFiles);
		};

		const formatFileSize = (bytes: number): string => {
			if (bytes === 0) return "0 Bytes";
			const k = 1024;
			const sizes = ["Bytes", "KB", "MB", "GB"];
			const i = Math.floor(Math.log(bytes) / Math.log(k));
			return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
		};

		return (
			<div className="w-full space-y-4 group">
				<label
					ref={ref}
					htmlFor={inputId}
					className={cn(
						csvUploadVariants({
							variant: isDragging ? "active" : variant,
							size,
							className,
						}),
						disabled && "opacity-50 cursor-not-allowed",
						!disabled &&
							"cursor-pointer hover:border-primary/50 hover:bg-accent/50 dark:hover:border-primary/50",
					)}
					onDragEnter={handleDragEnter}
					onDragLeave={handleDragLeave}
					onDragOver={handleDragOver}
					onDrop={handleDrop}
					{...props}
				>
					<input
						id={inputId}
						type="file"
						className="hidden"
						onChange={handleInputChange}
						accept=".csv,text/csv,application/csv"
						multiple={multiple}
						disabled={disabled}
					/>

					<div className="flex flex-col items-center justify-center gap-[10px] text-center pointer-events-none">
						<div
							className={cn(
								"rounded-full p-3 transition-colors",
								isDragging
									? "bg-primary/20 text-primary"
									: "bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary",
							)}
						>
							<Upload className="size-6" />
						</div>
						<div className="space-y-2">
							<p className="text-base font-medium">
								{isDragging
									? `Drop ${multiple ? "CSVs" : "CSV"} here`
									: `Drag & drop your ${multiple ? "CSVs" : "CSV"} here, or click to select`}{" "}
								{isProcessing && "Processing..."}
							</p>
							<p className="text-xs text-muted-foreground/75">
								{`Your ${multiple ? "CSVs" : "CSV"} will be automatically
								converted to database tables`}
							</p>
						</div>
					</div>
				</label>

				{/* {files.length > 0 && (
					<div className="space-y-2">
						<p className="text-sm font-medium">
							Selected files ({files.length})
						</p>
						<div className="space-y-2">
							{files.map((file, index) => (
								<div
									key={`${file.name}-${index}`}
									className="flex items-center gap-3 rounded-lg border bg-card p-3 text-card-foreground"
								>
									<div className="rounded-md bg-muted p-2">
										<File className="size-4" />
									</div>
									<div className="flex-1 min-w-0">
										<p className="text-sm font-medium truncate">{file.name}</p>
										<p className="text-xs text-muted-foreground">
											{formatFileSize(file.size)}
										</p>
									</div>
									<Button
										variant="ghost"
										size="icon"
										onClick={(e) => {
											e.stopPropagation();
											removeFile(index);
										}}
										disabled={disabled}
									>
										<X className="size-4" />
										<span className="sr-only">Remove file</span>
									</Button>
								</div>
							))}
						</div>
					</div>
				)} */}
			</div>
		);
	},
);

export { CSVUpload, csvUploadVariants };
