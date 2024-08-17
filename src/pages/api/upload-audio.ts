import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import formidable from "formidable";
import { File } from "formidable";
import {v4 as uuid4} from 'uuid';

export const config = {
	api: {
		bodyParser: false,
	},
};

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse
) {
	if (req.method === "POST") {
		const uploadDir = path.join(process.cwd(), "uploads");

		// Ensure the upload directory exists
		if (!fs.existsSync(uploadDir)) {
			fs.mkdirSync(uploadDir, { recursive: true });
			console.log("Uploads directory created");
		} else {
			console.log("Uploads directory already exists");
		}

		const form = formidable({
			uploadDir: uploadDir,
			keepExtensions: true,
			maxFileSize: 10 * 1024 * 1024, // 10MB
		});

		return new Promise<void>((resolve) => {
			form.parse(req, async (err, fields, files) => {
				if (err) {
					console.log("Error occurred ", err);
					res.status(500).json({ Message: "Failed to parse form data" });
					resolve();
					return;
				}

				const uploadedFile = files.file;
				let file: File;

				if (
					!uploadedFile ||
					(Array.isArray(uploadedFile) && uploadedFile.length === 0)
				) {
					res.status(400).json({ error: "No file received." });
					resolve();
					return;
				} else{
					file = uploadedFile[0] as File;
				}

				const oldPath = file.filepath;
				const filename =
					file.originalFilename?.replaceAll(" ", "_") || "unknown_file";
				const newPath = path.join(uploadDir, `${uuid4()}_${filename}`);

				try {
					fs.renameSync(oldPath, newPath);
					console.log(`File saved to ${newPath}`);
					res.status(201).json({ Message: "Success", filename: filename });
					resolve();
				} catch (error) {
					console.log("Error occurred ", error);
					res.status(500).json({ Message: "Failed to save file" });
					resolve();
				}
			});
		});

	} else {
		// Handle any other HTTP method
		res.setHeader("Allow", ["POST"]);
		res.status(405).end(`Method ${req.method} Not Allowed`);
	}
}
