import { access, constants } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { PDFDocument } from "pdf-lib";

type ParsedArgs = {
	outputPath: string;
	inputPaths: string[];
};

function printUsage(): void {
	console.log("Usage: npm run merge -- -o <output.pdf> <input1.pdf> <input2.pdf> [more.pdf...]");
	console.log("Example: npm run merge -- -o merged.pdf file-a.pdf file-b.pdf");
}

function parseArgs(argv: string[]): ParsedArgs {
	if (argv.includes("-h") || argv.includes("--help")) {
		printUsage();
		process.exit(0);
	}

	const outputIndex = argv.findIndex((arg) => arg === "-o" || arg === "--output");

	if (outputIndex === -1 || !argv[outputIndex + 1]) {
		throw new Error("Missing required output path. Pass -o <output.pdf>.");
	}

	const outputPath = argv[outputIndex + 1];
	const inputPaths = argv.filter((_, index) => index !== outputIndex && index !== outputIndex + 1);

	if (inputPaths.length < 2) {
		throw new Error("Provide at least two input PDF files to merge.");
	}

	return { outputPath, inputPaths };
}

async function ensureReadableFile(filePath: string): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		access(filePath, constants.R_OK, (error: NodeJS.ErrnoException | null) => {
			if (error) {
				reject(new Error(`Cannot read input file: ${filePath}`));
				return;
			}

			resolve();
		});
	});
}

async function mergePdfs(outputPath: string, inputPaths: string[]): Promise<void> {
	const mergedPdf = await PDFDocument.create();

	for (const inputPath of inputPaths) {
		await ensureReadableFile(inputPath);
		const inputBytes = await readFile(inputPath);
		const sourcePdf = await PDFDocument.load(inputBytes);
		const pageIndices = sourcePdf.getPageIndices();
		const copiedPages = await mergedPdf.copyPages(sourcePdf, pageIndices);

		for (const page of copiedPages) {
			mergedPdf.addPage(page);
		}
	}

	const outputBytes = await mergedPdf.save();
	await writeFile(outputPath, outputBytes);
}

async function main(): Promise<void> {
	try {
		const { outputPath, inputPaths } = parseArgs(process.argv.slice(2));

		const resolvedOutput = path.resolve(outputPath);
		const resolvedInputs = inputPaths.map((inputPath) => path.resolve(inputPath));

		await mergePdfs(resolvedOutput, resolvedInputs);
		console.log(`Merged ${resolvedInputs.length} files into ${resolvedOutput}`);
	} catch (error) {
		console.error(error instanceof Error ? error.message : "Failed to merge PDF files.");
		printUsage();
		process.exit(1);
	}
}

void main();
