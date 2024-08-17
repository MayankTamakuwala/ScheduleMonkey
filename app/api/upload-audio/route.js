import { NextResponse } from "next/server";
import fs, { writeFile } from 'fs';
import path from 'path';

export async function POST(req, res) {

  // Parse the incoming form data
  const formData = await req.formData();

  // Get the file from the form data
  const file = formData.get("file");

  // Check if a file is received
  if (!file) {
    // If no file is received, return a JSON response with an error and a 400 status code
    return NextResponse.json({ error: "No files received." }, { status: 400 });
  }

  // Convert the file data to a Buffer
  const buffer = Buffer.from(await file.arrayBuffer());

  // Replace spaces in the file name with underscores
  const filename = file.name.replaceAll(" ", "_");
  console.log(filename);

  try {
    console.log('path ', path.join(process.cwd(), "uploads/" + filename))
    const writeDir = path.join(process.cwd(), "uploads/");
    if (!fs.existsSync(writeDir)) {
      fs.mkdirSync(writeDir, { recursive: true });
      console.log('Uploads directory created');
    } else {
      console.log('Uploads directory already exists');
    }
    
    // Write the file to the specified directory (public/assets) with the modified filename
    writeFile(
      path.join(process.cwd(), "uploads/" + filename),
      buffer,
      (err) => {
        if (err) {
          // If an error occurs during file writing, log the error and return a JSON response with a failure message and a 500 status code
          console.log("Error occurred ", err);
          return NextResponse.json({ Message: "Failed", status: 500 });
        }
      }
    );

    // Return a JSON response with a success message and a 201 status code
    return NextResponse.json({ Message: "Success", status: 201 });
  } catch (error) {
    // If an error occurs during file writing, log the error and return a JSON response with a failure message and a 500 status code
    console.log("Error occurred ", error);
    return NextResponse.json({ Message: "Failed", status: 500 });
  }

}